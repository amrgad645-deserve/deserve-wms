import Database from "better-sqlite3";
import path from "path";
import seedData from "../data/seed_products.json";

const dbPath = path.join(process.cwd(), "deserve_wms.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
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

// Migration for existing databases without bin_location
try {
  db.exec("ALTER TABLE products ADD COLUMN bin_location TEXT DEFAULT 'UNASSIGNED'");
} catch (e) {
  // Column already exists or table freshly created
}

// Migration: factory-return (RMA) fields on repairs
const addRepairCol = (name: string, def: string) => {
  try {
    db.exec(`ALTER TABLE repairs ADD COLUMN ${name} ${def}`);
  } catch (e) {
    // Column already exists
  }
};
addRepairCol("repair_type", "TEXT DEFAULT 'INTERNAL'");
addRepairCol("factory_name", "TEXT");
addRepairCol("factory_ref", "TEXT");
addRepairCol("sent_to_factory_at", "TEXT");
addRepairCol("outcome", "TEXT");

// Seed products if empty
const rowCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (rowCount.count === 0) {
  console.log("Seeding initial 118 DESERVE official products with 0 stock...");
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, model, color, size, barcode, good_stock, defective_stock, bin_location)
    VALUES (?, ?, ?, ?, ?, 0, 0, 'UNASSIGNED')
  `);

  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      insertProduct.run(item.sku, item.model, item.color, item.size, item.barcode);
    }
  });

  insertMany(seedData);
  console.log("Successfully seeded 118 products with 0 opening stock!");
}

export default db;
