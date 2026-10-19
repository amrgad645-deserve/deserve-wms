import db from "./db";
import { BundleDefinition } from "./types";

/**
 * Retrieves all bundle SET definitions from database and their current stock
 */
export function getAvailableBundles() {
  const setProducts = db.prepare("SELECT * FROM products WHERE sku LIKE '%-SET' ORDER BY model, color").all() as any[];

  return setProducts.map((set) => {
    const prefix = set.sku.replace(/-SET$/, "");
    const sku21 = `${prefix}-21`;
    const sku25 = `${prefix}-25`;
    const sku29 = `${prefix}-29`;

    const item21 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku21) as any;
    const item25 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku25) as any;
    const item29 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku29) as any;

    const availableToAssemble = Math.min(
      item21?.good_stock ?? 0,
      item25?.good_stock ?? 0,
      item29?.good_stock ?? 0
    );

    return {
      setSku: set.sku,
      setName: `${set.model} (${set.color})`,
      model: set.model,
      color: set.color,
      setGoodStock: set.good_stock,
      availableToAssemble,
      items: [
        { sku: sku21, size: "21 INCH", goodStock: item21?.good_stock ?? 0, exists: !!item21 },
        { sku: sku25, size: "25 INCH", goodStock: item25?.good_stock ?? 0, exists: !!item25 },
        { sku: sku29, size: "29 INCH", goodStock: item29?.good_stock ?? 0, exists: !!item29 },
      ],
    };
  });
}

/**
 * Disassembles 1 or more SETs into their 3 individual pieces (21, 25, 29)
 */
export function disassembleSet(setSku: string, qty: number, operator: string, notes?: string) {
  if (qty <= 0) throw new Error("الكمية يجب أن تكون أكبر من 0");

  const setProduct = db.prepare("SELECT * FROM products WHERE sku = ?").get(setSku) as any;
  if (!setProduct) throw new Error(`كود الطقم ${setSku} غير موجود`);

  if (setProduct.good_stock < qty) {
    throw new Error(`رصيد الأطقم المتاح غير كافٍ! المتاح: ${setProduct.good_stock}، المطلوب فكه: ${qty}`);
  }

  const prefix = setSku.replace(/-SET$/, "");
  const sku21 = `${prefix}-21`;
  const sku25 = `${prefix}-25`;
  const sku29 = `${prefix}-29`;

  const item21 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku21) as any;
  const item25 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku25) as any;
  const item29 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku29) as any;

  if (!item21 || !item25 || !item29) {
    throw new Error("لم يتم العثور على المقاسات الفردية التابعة لهذا الطقم في الكتالوج");
  }

  const tx = db.transaction(() => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    // 1. Deduct SET stock
    db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, setSku);

    // 2. Add to 21, 25, 29
    db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku21);
    db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku25);
    db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku29);

    // 3. Record Movement
    const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
    const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

    db.prepare(`
      INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
      VALUES (?, ?, ?, 'DISASSEMBLE', ?, ?, ?, ?, ?, 'BUNDLE_DISASSEMBLE', ?, ?)
    `).run(
      movId,
      dateStr,
      timeStr,
      setSku,
      setProduct.model,
      setProduct.color,
      setProduct.size,
      qty,
      operator || "Warehouse Lead",
      `فك طقم كامل إلى 3 شنط فردية (21 و 25 و 29). ` + (notes ? notes.trim() : "")
    );
  });

  tx();
  return { success: true };
}

/**
 * Assembles individual pieces (21, 25, 29) into a complete SET
 */
export function assembleSet(setSku: string, qty: number, operator: string, notes?: string) {
  if (qty <= 0) throw new Error("الكمية يجب أن تكون أكبر من 0");

  const setProduct = db.prepare("SELECT * FROM products WHERE sku = ?").get(setSku) as any;
  if (!setProduct) throw new Error(`كود الطقم ${setSku} غير موجود`);

  const prefix = setSku.replace(/-SET$/, "");
  const sku21 = `${prefix}-21`;
  const sku25 = `${prefix}-25`;
  const sku29 = `${prefix}-29`;

  const item21 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku21) as any;
  const item25 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku25) as any;
  const item29 = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku29) as any;

  if (!item21 || !item25 || !item29) {
    throw new Error("لم يتم العثور على المقاسات الفردية التابعة لهذا الطقم في الكتالوج");
  }

  if (item21.good_stock < qty || item25.good_stock < qty || item29.good_stock < qty) {
    throw new Error(
      `رصيد الشنط الفردية غير كافٍ للتجميع! مقاس 21: (${item21.good_stock})، مقاس 25: (${item25.good_stock})، مقاس 29: (${item29.good_stock})`
    );
  }

  const tx = db.transaction(() => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    // 1. Deduct from 21, 25, 29
    db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku21);
    db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku25);
    db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku29);

    // 2. Add to SET stock
    db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, setSku);

    // 3. Record Movement
    const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
    const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

    db.prepare(`
      INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
      VALUES (?, ?, ?, 'ASSEMBLE', ?, ?, ?, ?, ?, 'BUNDLE_ASSEMBLE', ?, ?)
    `).run(
      movId,
      dateStr,
      timeStr,
      setSku,
      setProduct.model,
      setProduct.color,
      setProduct.size,
      qty,
      operator || "Warehouse Lead",
      `تجميع 3 شنط فردية (21 و 25 و 29) لتكوين طقم كامل. ` + (notes ? notes.trim() : "")
    );
  });

  tx();
  return { success: true };
}
