import { CategoryRule } from "./types";

export const defaultRules: CategoryRule[] = [
  {
    category: "Groceries",
    keywords: ["kroger", "walmart", "aldi", "costco", "meijer", "whole foods"],
  },
  {
    category: "Dining",
    keywords: ["mcdonald", "wendy", "chipotle", "restaurant", "cafe", "coffee"],
  },
  {
    category: "Shopping",
    keywords: ["amazon", "target", "best buy", "home depot", "lowes"],
  },
  {
    category: "Gas",
    keywords: ["shell", "exxon", "bp", "chevron", "sunoco", "marathon"],
  },
];
