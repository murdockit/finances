import cors from "cors";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 8080;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

await waitForDb();
await initDb();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/imports", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, file_name AS \"fileName\", imported_at AS \"importedAt\" FROM imports ORDER BY imported_at DESC"
  );
  res.json(result.rows);
});

app.delete("/imports", async (_req, res) => {
  await pool.query("DELETE FROM transactions");
  await pool.query("DELETE FROM imports");
  res.json({ ok: true });
});

app.delete("/imports/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Missing import id." });
    return;
  }

  await pool.query("DELETE FROM transactions WHERE import_id = $1", [id]);
  const result = await pool.query("DELETE FROM imports WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Import not found." });
    return;
  }
  res.json({ ok: true });
});

app.post("/imports", async (req, res) => {
  const { import: importRecord, transactions } = req.body ?? {};
  if (!importRecord || !Array.isArray(transactions)) {
    res.status(400).json({ error: "Missing import or transactions." });
    return;
  }

  const importId = importRecord.id || crypto.randomUUID();
  const importedAt = importRecord.importedAt || new Date().toISOString();
  const fileName = importRecord.fileName || "import.csv";

  await pool.query(
    "INSERT INTO imports (id, file_name, imported_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
    [importId, fileName, importedAt]
  );

  if (transactions.length > 0) {
    const values = [];
    const placeholders = [];
    let idx = 1;
    for (const tx of transactions) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      values.push(
        tx.id,
        importId,
        tx.date,
        tx.description,
        tx.amount,
        tx.category,
        tx.manual ?? false,
        tx.rawType ?? "",
        tx.location ?? ""
      );
    }
    await pool.query(
      `INSERT INTO transactions (id, import_id, date, description, amount, category, manual, raw_type, location)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        manual = EXCLUDED.manual`,
      values
    );
  }

  res.json({ id: importId, fileName, importedAt });
});

app.get("/transactions", async (req, res) => {
  const { from, to, importIds } = req.query;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (from) {
    conditions.push(`date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`date <= $${idx++}`);
    values.push(to);
  }
  if (importIds) {
    const ids = String(importIds)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) {
      conditions.push(`import_id = ANY($${idx++})`);
      values.push(ids);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT id,
      import_id AS "importId",
      date,
      description,
      amount,
      category,
      manual,
      raw_type AS "rawType",
      location
    FROM transactions
    ${whereClause}
    ORDER BY date DESC
  `;
  const result = await pool.query(query, values);
  res.json(
    result.rows.map((row) => ({
      ...row,
      date: new Date(row.date).toISOString(),
    }))
  );
});

app.patch("/transactions/:id", async (req, res) => {
  const { id } = req.params;
  const { category, manual } = req.body ?? {};
  if (!category) {
    res.status(400).json({ error: "Missing category." });
    return;
  }
  await pool.query(
    "UPDATE transactions SET category = $1, manual = $2 WHERE id = $3",
    [category, manual ?? true, id]
  );
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS imports (
      id uuid PRIMARY KEY,
      file_name text NOT NULL,
      imported_at timestamptz NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id text PRIMARY KEY,
      import_id uuid REFERENCES imports(id),
      date date NOT NULL,
      description text NOT NULL,
      amount numeric NOT NULL,
      category text NOT NULL,
      manual boolean NOT NULL DEFAULT false,
      raw_type text NOT NULL,
      location text NOT NULL
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS transactions_import_idx ON transactions(import_id);"
  );
}

async function waitForDb() {
  const maxAttempts = 12;
  const delayMs = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1;");
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
