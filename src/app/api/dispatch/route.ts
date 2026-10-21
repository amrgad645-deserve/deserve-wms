import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderNum, courier, operator, notes, items } = body;

    if (!orderNum || !orderNum.trim()) {
      return NextResponse.json({ success: false, error: "رقم الأوردر أو البوليصة مطلوب" }, { status: 400 });
    }
    if (!operator || !operator.trim()) {
      return NextResponse.json({ success: false, error: "اسم الموظف مطلوب" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "يجب اختيار صنف واحد على الأقل" }, { status: 400 });
    }

    // Atomic Transaction
    const executeDispatch = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      for (const item of items) {
        const sku = String(item.sku).trim();
        const qty = Number(item.qty);

        if (qty <= 0) {
          throw new Error(`الكمية للصنف ${sku} يجب أن تكون أكبر من 0`);
        }

        // Fetch current stock
        const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
        if (!product) {
          throw new Error(`الصنف ${sku} غير موجود بقاعدة البيانات`);
        }

        if (product.good_stock < qty) {
          throw new Error(`رصيد غير كافٍ للصنف ${product.model} ${product.color} (${sku})! المتاح: ${product.good_stock}، المطلوب: ${qty}`);
        }

        // Deduct Good Stock
        db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku);

        // Record Movement
        const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
        const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

        db.prepare(`
          INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCH', ?, ?)
        `).run(
          movId,
          dateStr,
          timeStr,
          orderNum.trim(),
          sku,
          product.model,
          product.color,
          product.size,
          qty,
          operator.trim(),
          (courier ? `Courier: ${courier}. ` : "") + (notes ? notes.trim() : "")
        );
      }
    });

    executeDispatch();
    return NextResponse.json({ success: true, message: "تم صرف الأوردر وخصم المخزون بنجاح" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}