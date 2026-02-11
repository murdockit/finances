import { useMemo, useState } from "react";
import { Transaction } from "../lib/types";

type TransactionTableProps = {
  transactions: Transaction[];
  categories: string[];
  onCategoryChange: (id: string, category: string) => void;
};

export function TransactionTable({
  transactions,
  categories,
  onCategoryChange,
}: TransactionTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return transactions;
    }
    return transactions.filter((tx) =>
      `${tx.description} ${tx.category}`.toLowerCase().includes(needle)
    );
  }, [query, transactions]);

  return (
    <div className="table-card">
      <div className="table-header">
        <h3>Transactions</h3>
        <input
          type="search"
          placeholder="Search description or category"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date.toLocaleDateString()}</td>
                <td>{tx.description}</td>
                <td className={tx.amount < 0 ? "negative" : "positive"}>
                  {formatMoney(tx.amount)}
                </td>
                <td>
                  <select
                    value={tx.category}
                    onChange={(event) =>
                      onCategoryChange(tx.id, event.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No matching transactions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMoney(amount: number): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return formatter.format(amount);
}
