export type Transaction = {
  id: string;
  importId: string;
  date: Date;
  description: string;
  amount: number;
  category: string;
  manual: boolean;
  rawType: string;
  location: string;
};

export type CategoryRule = {
  category: string;
  keywords: string[];
};

export type ImportRecord = {
  id: string;
  fileName: string;
  importedAt: string;
};
