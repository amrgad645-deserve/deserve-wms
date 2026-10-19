import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, source, customer_name, items } = body;

    if (!order_id) throw new Error("رقم الأوردر (order_id) مطلوب");
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("قائمة الأصناف (items) مطلوبة وتتضمن على الأقل صنفاً واحداً");
    }

    const tx = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      for (const item of items) {
        const sku = String(item.sku).trim();
        const qty = Number(item.qty || 1);

        const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
        if (!product) {
          throw new Error(`الصنف ${sku} غير موجود في المستودع`);
        }

        if (product.good_stock < qty) {
          throw new Error(`المخزون غير كافٍ للصنف ${sku}! المتاح: ${product.good_stock}، المطلوب: ${qty}`);
        }

        // Deduct
        db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, sku);

        // Record Movement
        const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
        const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

        db.prepare(`
          INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCH', 'Online Webhook', ?)
        `).run(
          movId,
          dateStr,
          timeStr,
          String(order_id).trim(),
          sku,
          product.model,
          product.color,
          product.size,
          qty,
          `خصم تلقائي عبر الويب هوك (${source || "E-commerce"}). العميل: ${customer_name || "Online Order"}`
        );
      }
    });

    tx();

    return NextResponse.json({
      success: true,
      message: `تم معالجة أوردر المتجر (${order_id}) وخصم المخزون بنجاح`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
