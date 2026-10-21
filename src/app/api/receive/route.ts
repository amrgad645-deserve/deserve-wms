import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poNum, supplier, operator, notes, items } = body;

    if (!poNum || !poNum.trim()) {
      return NextResponse.json({ success: false, error: "رقم إذن الاستلام أو الفاتورة مطلوب" }, { status: 400 });
    }
    if (!operator || !operator.trim()) {
      return NextResponse.json({ success: false, error: "اسم الموظف المستلم مطلوب" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "يجب اختيار صنف واحد على الأقل للاستلام" }, { status: 400 });
    }

    const executeReceive = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      for (const item of items) {
        const sku = String(item.sku).trim();
        const qty = Number(item.qty);

        if (qty <= 0) {
          throw new Error(`الكمية المستلمة للصنف ${sku} يجب أن تكون أكبر من 0`);
        }

        const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
        if (!product) {
          throw new Error(`الصنف ${sku} غير موجود`);
        }

        // Increase Stock
        db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku);

        const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
        const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

        db.prepare(`
          INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVE', ?, ?)
        `).run(
          movId,
          dateStr,
          timeStr,
          poNum.trim(),
          sku,
          product.model,
          product.color,
          product.size,
          qty,
          operator.trim(),
          (supplier ? `Supplier: ${supplier} | ` : "") + (notes ? notes.trim() : "")
        );
      }
    });

    executeReceive();
    return NextResponse.json({ success: true, message: "تم استلام الشحنة وإضافة الكميات للمخزون بنجاح" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}