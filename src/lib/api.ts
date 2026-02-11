import { ImportRecord, Transaction } from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://192.168.1.13:8081";

export async function fetchImports(): Promise<ImportRecord[]> {
  const response = await fetch(`${API_BASE}/imports`);
  if (!response.ok) {
    throw new Error("Failed to load imports.");
  }
  return response.json();
}

export async function fetchTransactions(params?: {
  from?: string;
  to?: string;
  importIds?: string[];
}): Promise<Transaction[]> {
  const search = new URLSearchParams();
  if (params?.from) {
    search.set("from", params.from);
  }
  if (params?.to) {
    search.set("to", params.to);
  }
  if (params?.importIds && params.importIds.length > 0) {
    search.set("importIds", params.importIds.join(","));
  }
  const response = await fetch(`${API_BASE}/transactions?${search.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load transactions.");
  }
  const rows = (await response.json()) as Transaction[];
  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
}

export async function saveImportPayload(payload: {
  import: ImportRecord;
  transactions: Transaction[];
}): Promise<ImportRecord> {
  const response = await fetch(`${API_BASE}/imports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      import: payload.import,
      transactions: payload.transactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString(),
      })),
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save import.");
  }
  return response.json();
}

export async function updateTransactionCategory(
  id: string,
  category: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, manual: true }),
  });
  if (!response.ok) {
    throw new Error("Failed to update transaction.");
  }
}
