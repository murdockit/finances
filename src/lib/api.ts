import { ImportRecord, Transaction } from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://192.168.1.13:8081";

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < retries) {
        attempt += 1;
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * Math.pow(2, attempt))
        );
        continue;
      }
      return response;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * Math.pow(2, attempt))
      );
    }
  }
}

export async function fetchImports(): Promise<ImportRecord[]> {
  const response = await fetchWithRetry(`${API_BASE}/imports`);
  if (!response.ok) {
    throw new Error("Failed to load imports.");
  }
  return response.json();
}

export async function deleteImport(id: string): Promise<void> {
  const response = await fetchWithRetry(`${API_BASE}/imports/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete import.");
  }
}

export async function deleteAllImports(): Promise<void> {
  const response = await fetchWithRetry(`${API_BASE}/imports`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete imports.");
  }
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
  const response = await fetchWithRetry(
    `${API_BASE}/transactions?${search.toString()}`
  );
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
  const response = await fetchWithRetry(`${API_BASE}/imports`, {
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
  const response = await fetchWithRetry(`${API_BASE}/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, manual: true }),
  });
  if (!response.ok) {
    throw new Error("Failed to update transaction.");
  }
}
