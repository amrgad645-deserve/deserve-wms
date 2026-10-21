import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, qty, reason, operator, notes } = body;

    if (!sku) {
      return NextResponse.json({ success: false, error: "كود الصنف مطلوب" }, { status: 400 });
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      return NextResponse.json({ success: false, error: "الكمية المعيبة يجب أن تكون 1 أو أكثر" }, { status: 400 });
    }

    const executeDefect = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
      if (!product) {
        throw new Error(`الصنف ${sku} غير موجود`);
      }

      if (product.good_stock < numQty) {
        throw new Error(`لا يمكن عزل ${numQty} قطعة لأن الرصيد السليم المتاح هو ${product.good_stock} فقط!`);
      }

      // Move from good to defective
      db.prepare("UPDATE products SET good_stock = good_stock - ?, defective_stock = defective_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(numQty, numQty, sku);

      const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
      const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

      db.prepare(`
        INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
        VALUES (?, ?, ?, 'PICK-DEFECT', ?, ?, ?, ?, ?, 'PICKING_DEFECT', ?, ?)
      `).run(
        movId,
        dateStr,
        timeStr,
        sku,
        product.model,
        product.color,
        product.size,
        numQty,
        operator ? operator.trim() : "Warehouse Lead",
        (reason ? `Reason: ${reason}. ` : "") + (notes ? notes.trim() : "")
      );
    });

    executeDefect();
    return NextResponse.json({ success: true, message: "تم عزل القطع المعيبة ونقلها لرصيد التالف بنجاح" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}