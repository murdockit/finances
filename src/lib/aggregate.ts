import { Transaction } from "./types";

export function groupByCategory(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.amount >= 0) {
      continue;
    }
    const current = totals.get(tx.category) ?? 0;
    totals.set(tx.category, current + Math.abs(tx.amount));
  }
  return totals;
}

export function groupByMonth(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.amount >= 0) {
      continue;
    }
    const key = formatMonth(tx.date);
    const current = totals.get(key) ?? 0;
    totals.set(key, current + Math.abs(tx.amount));
  }
  return totals;
}

export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
