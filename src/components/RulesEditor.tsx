import { useState } from "react";
import { CategoryRule } from "../lib/types";

type RulesEditorProps = {
  rules: CategoryRule[];
  onChange: (rules: CategoryRule[]) => void;
};

export function RulesEditor({ rules, onChange }: RulesEditorProps) {
  const [newCategory, setNewCategory] = useState("");

  function updateRule(index: number, updates: Partial<CategoryRule>) {
    const next = rules.map((rule, idx) =>
      idx === index ? { ...rule, ...updates } : rule
    );
    onChange(next);
  }

  function removeRule(index: number) {
    const next = rules.filter((_, idx) => idx !== index);
    onChange(next);
  }

  function addRule() {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      return;
    }
    onChange([...rules, { category: trimmed, keywords: [] }]);
    setNewCategory("");
  }

  return (
    <div className="rules">
      <div className="rules-header">
        <h3>Category Rules</h3>
        <div className="rules-new">
          <input
            type="text"
            placeholder="New category"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          />
          <button type="button" onClick={addRule}>
            Add
          </button>
        </div>
      </div>
      <div className="rules-list">
        {rules.map((rule, index) => (
          <div key={`${rule.category}-${index}`} className="rule-row">
            <input
              className="rule-category"
              type="text"
              value={rule.category}
              onChange={(event) =>
                updateRule(index, { category: event.target.value })
              }
            />
            <input
              className="rule-keywords"
              type="text"
              placeholder="Comma-separated keywords"
              value={rule.keywords.join(", ")}
              onChange={(event) =>
                updateRule(index, {
                  keywords: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
            <button type="button" onClick={() => removeRule(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
