import Papa from "papaparse";
import { Transaction } from "./types";

type ParseResult = {
  transactions: Transaction[];
  errors: string[];
};

export function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const errors: string[] = [];
        const transactions: Transaction[] = [];

        for (let i = 0; i < rows.length; i += 1) {
          const row = rows[i];
          if (row.length < 5) {
            errors.push(`Row ${i + 1} has too few columns.`);
            continue;
          }

          const date = parseDate(row[0]);
          if (!date) {
            errors.push(`Row ${i + 1} has an invalid date.`);
            continue;
          }

          const amount = parseAmount(row[4]);
          if (amount === null) {
            errors.push(`Row ${i + 1} has an invalid amount.`);
            continue;
          }

          transactions.push({
            id: `${i}-${row[2] ?? ""}`.replace(/\s+/g, "-"),
            importId: "",
            date,
            rawType: row[1] ?? "",
            description: row[2] ?? "",
            location: row[3] ?? "",
            amount,
            category: "Uncategorized",
            manual: false,
          });
        }

        resolve({ transactions, errors });
      },
    });
  });
}

function parseDate(value: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split("/");
  if (parts.length !== 3) {
    return null;
  }
  const [month, day, year] = parts.map((part) => Number(part));
  if (!month || !day || !year) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function parseAmount(value: string): number | null {
  if (!value) {
    return null;
  }
  let text = value.trim();
  const hasParens = text.startsWith("(") && text.endsWith(")");
  text = text.replace(/[(),$]/g, "").replace(/\s+/g, "");
  text = text.replace(/,/g, "");
  const parsed = Number(text);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const negative = hasParens || text.startsWith("-");
  return negative ? -Math.abs(parsed) : parsed;
}
