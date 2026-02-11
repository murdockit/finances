import { useEffect, useMemo, useState } from "react";
import { parseCsv } from "./lib/csv";
import { applyRules, categorizeTransaction } from "./lib/rules";
import { defaultRules } from "./lib/sampleRules";
import { loadRules, saveRules } from "./lib/storage";
import { createUuid } from "./lib/uuid";
import {
  fetchImports,
  fetchTransactions,
  deleteImport,
  deleteAllImports,
  saveImportPayload,
  updateTransactionCategory,
} from "./lib/api";
import { Charts } from "./components/Charts";
import { RulesEditor } from "./components/RulesEditor";
import { TransactionTable } from "./components/TransactionTable";
import { CategoryRule, ImportRecord, Transaction } from "./lib/types";

const initialRules = loadRules() ?? defaultRules;

export default function App() {
  const [rules, setRules] = useState<CategoryRule[]>(initialRules);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("Upload a CSV to begin.");
  const [backendError, setBackendError] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [merchantQuery, setMerchantQuery] = useState<string>("");
  const [merchantSelections, setMerchantSelections] = useState<
    Record<string, string>
  >({});
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let isMounted = true;
    async function loadStoredData() {
      try {
        const [storedImports, storedTransactions] = await Promise.all([
          fetchImports(),
          fetchTransactions(),
        ]);
        if (!isMounted) {
          return;
        }
        setImports(storedImports);
        setAllTransactions(storedTransactions);
        setSelectedImportIds(new Set(storedImports.map((item) => item.id)));
        const [minDate, maxDate] = getDateBounds(storedTransactions);
        if (minDate && maxDate) {
          setDateFrom(minDate);
          setDateTo(maxDate);
        }
        if (storedTransactions.length > 0) {
          setStatus(
            `Loaded ${storedTransactions.length} saved transactions.`
          );
        }
        setBackendError("");
      } catch (error) {
        console.error(error);
        setBackendError("Backend unavailable. Check the API container.");
      }
    }
    loadStoredData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const categories = useMemo(() => {
    const list = rules.map((rule) => rule.category);
    if (!list.includes("Uncategorized")) {
      list.push("Uncategorized");
    }
    return list;
  }, [rules]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (imports.length > 0 && selectedImportIds.size === 0) {
        return false;
      }
      if (selectedImportIds.size > 0 && !selectedImportIds.has(tx.importId)) {
        return false;
      }
      if (dateFrom && tx.date < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && tx.date > new Date(`${dateTo}T23:59:59`)) {
        return false;
      }
      return true;
    });
  }, [allTransactions, dateFrom, dateTo, imports.length, selectedImportIds]);

  const totalSpending = useMemo(() => {
    const total = filteredTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return total;
  }, [filteredTransactions]);

  const uncategorizedMerchants = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; count: number; sample: string }
    >();
    for (const tx of allTransactions) {
      if (tx.category !== "Uncategorized") {
        continue;
      }
      const key = toMerchantKeyword(tx.description);
      if (!key) {
        continue;
      }
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { key, count: 1, sample: tx.description });
      }
    }
    const list = Array.from(groups.values()).sort(
      (a, b) => b.count - a.count
    );
    if (!merchantQuery.trim()) {
      return list;
    }
    const needle = merchantQuery.trim().toLowerCase();
    return list.filter(
      (item) =>
        item.key.toLowerCase().includes(needle) ||
        item.sample.toLowerCase().includes(needle)
    );
  }, [allTransactions, merchantQuery]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setStatus("Parsing CSV...");
    const result = await parseCsv(file);
    const importRecord: ImportRecord = {
      id: createUuid(),
      fileName: file.name,
      importedAt: new Date().toISOString(),
    };
    const withImport = result.transactions.map((tx) => ({
      ...tx,
      importId: importRecord.id,
    }));
    const categorized = applyRules(withImport, rules);
    try {
      const savedImport = await saveImportPayload({
        import: importRecord,
        transactions: categorized,
      });
      setImports((current) => [...current, savedImport]);
      setSelectedImportIds((current) => new Set(current).add(savedImport.id));
      const merged = [...allTransactions, ...categorized];
      setAllTransactions(merged);
      setBackendError("");
    } catch (error) {
      console.error(error);
      setBackendError("Failed to save to backend.");
    }
    setErrors(result.errors);
    setStatus(`Loaded ${categorized.length} transactions.`);

    const [minDate, maxDate] = getDateBounds(merged);
    if (minDate && maxDate) {
      setDateFrom(minDate);
      setDateTo(maxDate);
    }
  }

  function handleRulesChange(nextRules: CategoryRule[]) {
    setRules(nextRules);
    saveRules(nextRules);
    const updated = applyRules(allTransactions, nextRules);
    setAllTransactions(updated);
  }

  function handleCategoryChange(id: string, category: string) {
    setAllTransactions((current) =>
      current.map((tx) =>
        tx.id === id ? { ...tx, category, manual: true } : tx
      )
    );
    updateTransactionCategory(id, category).catch((error) => {
      console.error(error);
      setBackendError("Failed to update transaction.");
    });
  }

  function reapplyRules() {
    const updated = applyRules(allTransactions, rules);
    setAllTransactions(updated);
  }

  function resetManualOverrides() {
    const updated = allTransactions.map((tx) => ({
      ...tx,
      manual: false,
      category: categorizeTransaction(tx, rules),
    }));
    setAllTransactions(updated);
  }

  function addMerchantRule(keyword: string, category: string) {
    if (!keyword || !category) {
      return;
    }
    const normalizedKeyword = keyword.toLowerCase();
    const existingIndex = rules.findIndex(
      (rule) => rule.category === category
    );
    let nextRules = rules;
    if (existingIndex >= 0) {
      const rule = rules[existingIndex];
      if (
        rule.keywords.some(
          (item) => item.trim().toLowerCase() === normalizedKeyword
        )
      ) {
        return;
      }
      const updatedRule = {
        ...rule,
        keywords: [...rule.keywords, normalizedKeyword],
      };
      nextRules = [
        ...rules.slice(0, existingIndex),
        updatedRule,
        ...rules.slice(existingIndex + 1),
      ];
    } else {
      nextRules = [
        ...rules,
        { category, keywords: [normalizedKeyword] },
      ];
    }
    setRules(nextRules);
    saveRules(nextRules);
    setAllTransactions(applyRules(allTransactions, nextRules));
  }

  function toggleImportSelection(id: string) {
    setSelectedImportIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteImport(id: string) {
    const target = imports.find((item) => item.id === id);
    const confirmText = target
      ? `Delete ${target.fileName} and its transactions?`
      : "Delete this import and its transactions?";
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      await deleteImport(id);
      setImports((current) => current.filter((item) => item.id !== id));
      setAllTransactions((current) =>
        current.filter((tx) => tx.importId !== id)
      );
      setSelectedImportIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setBackendError("");
    } catch (error) {
      console.error(error);
      setBackendError("Failed to delete import.");
    }
  }

  function handleApplyMerchantRule(keyword: string) {
    const selection = merchantSelections[keyword];
    if (!selection) {
      setBackendError("Choose a category before adding a rule.");
      return;
    }
    addMerchantRule(keyword, selection);
    setBackendError("");
    setMerchantSelections((current) => {
      const next = { ...current };
      delete next[keyword];
      return next;
    });
  }

  function handleApplyAllMerchantRules() {
    const entries = Object.entries(merchantSelections).filter(
      ([, category]) => category
    );
    if (entries.length === 0) {
      setBackendError("Select at least one merchant category.");
      return;
    }
    for (const [keyword, category] of entries) {
      addMerchantRule(keyword, category);
    }
    setBackendError("");
    setMerchantSelections({});
  }

  async function handleDeleteAllImports() {
    if (!window.confirm("Delete all imports and transactions?")) {
      return;
    }
    try {
      await deleteAllImports();
      setImports([]);
      setAllTransactions([]);
      setSelectedImportIds(new Set());
      setBackendError("");
      setStatus("All imports deleted.");
    } catch (error) {
      console.error(error);
      setBackendError("Failed to delete all imports.");
    }
  }

  function handleExportJson() {
    const payload = {
      exportsAt: new Date().toISOString(),
      imports,
      transactions: allTransactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finances-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCsv() {
    const rows = [
      [
        "id",
        "importId",
        "date",
        "description",
        "amount",
        "category",
        "manual",
        "rawType",
        "location",
      ],
      ...filteredTransactions.map((tx) => [
        tx.id,
        tx.importId,
        tx.date.toISOString(),
        tx.description,
        tx.amount.toString(),
        tx.category,
        String(tx.manual ?? false),
        tx.rawType ?? "",
        tx.location ?? "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finances-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Local-only CSV Insights</p>
          <h1>Finances</h1>
          <p className="subtitle">
            Upload your bank CSV to see spending by category and monthly trend.
            Data stays in your browser.
          </p>
        </div>
        <div className="upload-card">
          <label className="upload">
            <input type="file" accept=".csv" onChange={handleFileChange} />
            <span>Choose CSV</span>
          </label>
          {!isOnline && (
            <p className="error-text">
              Offline: changes will not sync to the backend.
            </p>
          )}
          <p className="muted">{status}</p>
          {backendError && <p className="error-text">{backendError}</p>}
          {filteredTransactions.length > 0 && (
            <p className="total">
              Total spending: {formatMoney(totalSpending)}
            </p>
          )}
        </div>
      </header>

      <section className="content">
        <div className="filters">
          <div>
            <h3>Filters</h3>
            <p className="muted">Select imports and date range.</p>
          </div>
          <div className="filters-grid">
            <div className="filter-card">
              <h4>Imports</h4>
              {imports.length === 0 ? (
                <p className="muted">No saved imports yet.</p>
              ) : (
                <div className="import-list">
                  {imports.map((item) => (
                    <div key={item.id} className="import-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedImportIds.has(item.id)}
                          onChange={() => toggleImportSelection(item.id)}
                        />
                        <span>
                          {item.fileName}
                          <small>
                            {new Date(item.importedAt).toLocaleDateString()}
                          </small>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleDeleteImport(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imports.length > 0 && (
                <button type="button" onClick={handleDeleteAllImports}>
                  Delete All Imports
                </button>
              )}
            </div>
            <div className="filter-card">
              <h4>Date Range</h4>
              <div className="date-range">
                <label>
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <Charts transactions={filteredTransactions} />

        <div className="merchant-card">
          <div className="merchant-header">
            <div>
              <h3>Merchant Auto-Categorize</h3>
              <p className="muted">
                Search uncategorized merchants and add rules with one click.
              </p>
            </div>
            <div className="merchant-actions">
              <input
                type="text"
                placeholder="Search merchants"
                value={merchantQuery}
                onChange={(event) => setMerchantQuery(event.target.value)}
              />
              <button type="button" onClick={handleApplyAllMerchantRules}>
                Apply Selected
              </button>
            </div>
          </div>
          {uncategorizedMerchants.length === 0 ? (
            <p className="muted">No uncategorized merchants found.</p>
          ) : (
            <div className="merchant-list">
              {uncategorizedMerchants.slice(0, 20).map((item) => (
                <div key={item.key} className="merchant-row">
                  <div>
                    <strong>{item.key}</strong>
                    <small>{item.count} transactions</small>
                  </div>
                  <select
                    value={merchantSelections[item.key] ?? ""}
                    onChange={(event) =>
                      setMerchantSelections((current) => ({
                        ...current,
                        [item.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => handleApplyMerchantRule(item.key)}
                  >
                    Add Rule
                  </button>
                </div>
              ))}
            </div>
          )}
          {uncategorizedMerchants.length > 20 && (
            <p className="muted">
              Showing top 20 merchants. Refine the search to find more.
            </p>
          )}
        </div>

        <div className="actions">
          <button type="button" onClick={reapplyRules}>
            Reapply Rules
          </button>
          <button type="button" onClick={resetManualOverrides}>
            Reset Manual Overrides
          </button>
          <button type="button" onClick={handleExportJson}>
            Export JSON
          </button>
          <button type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>

        <RulesEditor rules={rules} onChange={handleRulesChange} />
        <TransactionTable
          transactions={filteredTransactions}
          categories={categories}
          onCategoryChange={handleCategoryChange}
        />

        {errors.length > 0 && (
          <div className="errors">
            <h3>Parsing Notes</h3>
            <ul>
              {errors.slice(0, 8).map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
            {errors.length > 8 && (
              <p className="muted">Showing first 8 issues.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function getDateBounds(transactions: Transaction[]): [string, string] {
  if (transactions.length === 0) {
    return ["", ""];
  }
  let min = transactions[0].date;
  let max = transactions[0].date;
  for (const tx of transactions) {
    if (tx.date < min) {
      min = tx.date;
    }
    if (tx.date > max) {
      max = tx.date;
    }
  }
  return [toDateInput(min), toDateInput(max)];
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(amount: number): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return formatter.format(amount);
}

function toMerchantKeyword(description: string): string {
  const cleaned = description
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }

  let tokens = cleaned.split(" ").filter((word) => word.length > 1);

  if (tokens.length === 0) {
    return "";
  }

  const last = tokens[tokens.length - 1];
  if (STATE_CODES.has(last)) {
    tokens = tokens.slice(0, -1);
    const maybeCity = tokens[tokens.length - 1];
    if (maybeCity && /^[a-z]+$/.test(maybeCity) && maybeCity.length >= 3) {
      tokens = tokens.slice(0, -1);
    }
  }

  const filtered: string[] = [];
  for (const token of tokens) {
    if (/\d/.test(token)) {
      continue;
    }
    if (!/[a-z]/.test(token)) {
      continue;
    }
    if (token === "pos" || token === "wdr" || token === "dbt") {
      continue;
    }
    if (!filtered.includes(token)) {
      filtered.push(token);
    }
  }

  return filtered.slice(0, 3).join(" ");
}

const STATE_CODES = new Set([
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "id",
  "il",
  "in",
  "ia",
  "ks",
  "ky",
  "la",
  "me",
  "md",
  "ma",
  "mi",
  "mn",
  "ms",
  "mo",
  "mt",
  "ne",
  "nv",
  "nh",
  "nj",
  "nm",
  "ny",
  "nc",
  "nd",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "vt",
  "va",
  "wa",
  "wv",
  "wi",
  "wy",
]);
