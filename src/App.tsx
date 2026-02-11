import { useEffect, useMemo, useState } from "react";
import { parseCsv } from "./lib/csv";
import { applyRules, categorizeTransaction } from "./lib/rules";
import { defaultRules } from "./lib/sampleRules";
import { loadRules, saveRules } from "./lib/storage";
import { createUuid } from "./lib/uuid";
import {
  fetchImports,
  fetchTransactions,
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
                    <label key={item.id} className="import-item">
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
                  ))}
                </div>
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

        <div className="actions">
          <button type="button" onClick={reapplyRules}>
            Reapply Rules
          </button>
          <button type="button" onClick={resetManualOverrides}>
            Reset Manual Overrides
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
