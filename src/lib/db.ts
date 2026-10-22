import initSqlJs from "sql.js";
import path from "path";
import fs from "fs";
import seedData from "../data/seed_products.json";

const dbPath = path.join(process.cwd(), "deserve_wms.db");
const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist");

const SQL = await initSqlJs({
  locateFile: (file) => path.join(wasmPath, file),
});

let sqlDb: any;
let inTransaction = false;
let lastDbMtime = 0;

if (fs.existsSync(dbPath)) {
  const buffer = fs.readFileSync(dbPath);
  sqlDb = new SQL.Database(buffer);
  try {
    lastDbMtime = fs.statSync(dbPath).mtimeMs;
  } catch (e) {}
} else {
  sqlDb = new SQL.Database();
}

function syncFromDiskIfNeeded() {
  if (inTransaction) return;
  if (!fs.existsSync(dbPath)) return;
  try {
    const stat = fs.statSync(dbPath);
    if (stat.mtimeMs > lastDbMtime) {
      const buffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(buffer);
      lastDbMtime = stat.mtimeMs;
    }
  } catch (e) {}
}

function saveDb() {
  if (inTransaction) return;
  try {
    const data = sqlDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    try {
      lastDbMtime = fs.statSync(dbPath).mtimeMs;
    } catch (e) {}
  } catch (err) {
    console.error("Failed to save database to disk:", err);
  }
}


// Ensure schema
sqlDb.exec(`
  CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    barcode TEXT,
    good_stock INTEGER DEFAULT 0,
    defective_stock INTEGER DEFAULT 0,
    bin_location TEXT DEFAULT 'UNASSIGNED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mov_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    ref_order TEXT,
    sku TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL,
    type TEXT NOT NULL,
    operator TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sku) REFERENCES products(sku)
  );

  CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL,
    defect_reason TEXT,
    spare_parts TEXT,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    repair_type TEXT DEFAULT 'INTERNAL',
    factory_name TEXT,
    factory_ref TEXT,
    sent_to_factory_at TEXT,
    outcome TEXT,
    operator TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sku) REFERENCES products(sku)
  );

  CREATE TABLE IF NOT EXISTS manifests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manifest_id TEXT NOT NULL,
    courier TEXT NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    car_number TEXT,
    orders_json TEXT NOT NULL,
    total_orders INTEGER NOT NULL,
    operator TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'أمين مخزن',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  sqlDb.exec("ALTER TABLE products ADD COLUMN bin_location TEXT DEFAULT 'UNASSIGNED'");
} catch (e) {}

const addRepairCol = (name: string, def: string) => {
  try {
    sqlDb.exec(`ALTER TABLE repairs ADD COLUMN ${name} ${def}`);
  } catch (e) {}
};
addRepairCol("repair_type", "TEXT DEFAULT 'INTERNAL'");
addRepairCol("factory_name", "TEXT");
addRepairCol("factory_ref", "TEXT");
addRepairCol("sent_to_factory_at", "TEXT");
addRepairCol("outcome", "TEXT");

// Check seed
const checkRes = sqlDb.exec("SELECT COUNT(*) as count FROM products");
const count = checkRes && checkRes[0] && checkRes[0].values && checkRes[0].values[0] ? Number(checkRes[0].values[0][0]) : 0;
if (count === 0) {
  console.log("Seeding initial 118 DESERVE official products with 0 stock...");
  for (const item of (seedData as any[])) {
    const stmt = sqlDb.prepare(`
      INSERT OR IGNORE INTO products (sku, model, color, size, barcode, good_stock, defective_stock, bin_location)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'UNASSIGNED')
    `);
    stmt.run([item.sku, item.model, item.color, item.size, item.barcode]);
    stmt.free();
  }
  saveDb();
  console.log("Successfully seeded 118 products with 0 opening stock!");
}

const db = {
  prepare(sql: string) {
    syncFromDiskIfNeeded();
    return {
      all(...params: any[]) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = sqlDb.prepare(sql);
        if (flatParams.length > 0) {
          stmt.bind(flatParams);
        }
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      get(...params: any[]) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = sqlDb.prepare(sql);
        if (flatParams.length > 0) {
          stmt.bind(flatParams);
        }
        let result: any = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      run(...params: any[]) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = sqlDb.prepare(sql);
        if (flatParams.length > 0) {
          stmt.bind(flatParams);
        }
        stmt.step();
        stmt.free();
        if (!inTransaction) {
          saveDb();
        }
        return { changes: 1 };
      },
    };
  },
  exec(sql: string) {
    syncFromDiskIfNeeded();
    sqlDb.exec(sql);
    if (!inTransaction) {
      saveDb();
    }
  },
  transaction(fn: Function) {
    return (...args: any[]) => {
      syncFromDiskIfNeeded();
      inTransaction = true;
      try {
        sqlDb.exec("BEGIN TRANSACTION;");
      } catch (e) {}
      try {
        const res = fn(...args);
        try {
          sqlDb.exec("COMMIT;");
        } catch (e) {
          console.error("Failed to commit SQLite transaction:", e);
        }
        inTransaction = false;
        saveDb();
        return res;
      } catch (e) {
        try {
          sqlDb.exec("ROLLBACK;");
        } catch (rbErr) {}
        inTransaction = false;
        throw e;
      }
    };
  },
  reload() {
    reloadDb();
  },
  exportData() {
    return sqlDb.export();
  },
};

export function reloadDb() {
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
    try {
      lastDbMtime = fs.statSync(dbPath).mtimeMs;
    } catch (e) {}
  }
}

export default db;


