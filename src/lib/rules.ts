import { CategoryRule, Transaction } from "./types";

export function categorizeTransaction(
  transaction: Transaction,
  rules: CategoryRule[]
): string {
  const text = transaction.description.toLowerCase();
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const needle = keyword.trim().toLowerCase();
      if (!needle) {
        continue;
      }
      if (text.includes(needle)) {
        return rule.category;
      }
    }
  }
  return "Uncategorized";
}

export function applyRules(
  transactions: Transaction[],
  rules: CategoryRule[]
): Transaction[] {
  return transactions.map((tx) => {
    if (tx.manual) {
      return tx;
    }
    return { ...tx, category: categorizeTransaction(tx, rules) };
  });
}
