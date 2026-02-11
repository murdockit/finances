import { CategoryRule } from "./types";

const STORAGE_KEY = "finances_rules_v1";

export function loadRules(): CategoryRule[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CategoryRule[];
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRules(rules: CategoryRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}
