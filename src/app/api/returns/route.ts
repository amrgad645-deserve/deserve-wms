import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origOrder, sku, qty, condition, operator, notes } = body;

    if (!sku) {
      return NextResponse.json({ success: false, error: "كود الصنف مطلوب" }, { status: 400 });
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      return NextResponse.json({ success: false, error: "الكمية المرتجعة يجب أن تكون 1 أو أكثر" }, { status: 400 });
    }
    if (condition !== "GOOD" && condition !== "DEFECTIVE") {
      return NextResponse.json({ success: false, error: "حالة المرتجع يجب أن تكون سليم (GOOD) أو تالف (DEFECTIVE)" }, { status: 400 });
    }

    const executeReturn = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
      if (!product) {
        throw new Error(`الصنف ${sku} غير موجود`);
      }

      if (condition === "GOOD") {
        db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(numQty, sku);
      } else {
        db.prepare("UPDATE products SET defective_stock = defective_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(numQty, sku);
      }

      const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
      const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

      db.prepare(`
        INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        movId,
        dateStr,
        timeStr,
        origOrder ? origOrder.trim() : "RETURN",
        sku,
        product.model,
        product.color,
        product.size,
        numQty,
        condition === "GOOD" ? "RETURN_GOOD" : "RETURN_DEFECTIVE",
        operator ? operator.trim() : "Warehouse Staff",
        notes ? notes.trim() : ""
      );
    });

    executeReturn();
    return NextResponse.json({ success: true, message: `تم تسجيل المرتجع بنجاح كـ (${condition === "GOOD" ? "سليم متاح للبيع" : "تالف محجوز"})` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}