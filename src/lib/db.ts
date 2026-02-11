import { ImportRecord, Transaction } from "./types";

const DB_NAME = "finances_db";
const DB_VERSION = 1;
const IMPORT_STORE = "imports";
const TRANSACTION_STORE = "transactions";

type DbTransaction = Omit<Transaction, "date"> & { date: string };

export async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMPORT_STORE)) {
        db.createObjectStore(IMPORT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(TRANSACTION_STORE)) {
        const store = db.createObjectStore(TRANSACTION_STORE, { keyPath: "id" });
        store.createIndex("date", "date");
        store.createIndex("importId", "importId");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveImport(record: ImportRecord): Promise<void> {
  const db = await openDb();
  await withStore(db, IMPORT_STORE, "readwrite", (store) => {
    store.put(record);
  });
}

export async function saveTransactions(
  transactions: Transaction[]
): Promise<void> {
  if (transactions.length === 0) {
    return;
  }
  const db = await openDb();
  await withStore(db, TRANSACTION_STORE, "readwrite", (store) => {
    for (const tx of transactions) {
      store.put(toDbTransaction(tx));
    }
  });
}

export async function getImports(): Promise<ImportRecord[]> {
  const db = await openDb();
  return withStore(db, IMPORT_STORE, "readonly", (store) => {
    return requestToPromise<ImportRecord[]>(store.getAll());
  });
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await openDb();
  const rows = await withStore(db, TRANSACTION_STORE, "readonly", (store) => {
    return requestToPromise<DbTransaction[]>(store.getAll());
  });
  return rows.map(fromDbTransaction);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const db = await openDb();
  await withStore(db, TRANSACTION_STORE, "readwrite", async (store) => {
    const existing = await requestToPromise<DbTransaction | undefined>(
      store.get(id)
    );
    if (!existing) {
      return;
    }
    const merged: DbTransaction = {
      ...existing,
      ...toDbTransaction({
        ...fromDbTransaction(existing),
        ...updates,
      }),
    };
    store.put(merged);
  });
}

function toDbTransaction(tx: Transaction): DbTransaction {
  return {
    ...tx,
    date: tx.date.toISOString(),
  };
}

function fromDbTransaction(tx: DbTransaction): Transaction {
  return {
    ...tx,
    date: new Date(tx.date),
  };
}

function withStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result: T;
    try {
      result = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
