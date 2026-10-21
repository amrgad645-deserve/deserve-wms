import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { counts, operator, notes } = body;

    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json({ success: false, error: "لا توجد أصناف مدخلة للجرد" }, { status: 400 });
    }

    const executeAudit = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      for (const item of counts) {
        const sku = String(item.sku).trim();
        const countedGood = Number(item.goodStock ?? 0);
        const countedDefective = Number(item.defectiveStock ?? 0);

        const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
        if (!product) continue;

        // Update product to match physical count directly
        db.prepare(`
          UPDATE products 
          SET good_stock = ?, defective_stock = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE sku = ?
        `).run(countedGood, countedDefective, sku);

        // Record Audit Movement
        const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
        const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

        db.prepare(`
          INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
          VALUES (?, ?, ?, 'PHYSICAL-AUDIT', ?, ?, ?, ?, ?, 'PHYSICAL_AUDIT', ?, ?)
        `).run(
          movId,
          dateStr,
          timeStr,
          sku,
          product.model,
          product.color,
          product.size,
          countedGood,
          operator ? operator.trim() : "Warehouse Lead",
          `الجرد الفعلي الافتتاحي: سليم=${countedGood}، تالف=${countedDefective}. ` + (notes ? notes.trim() : "")
        );
      }
    });

    executeAudit();
    return NextResponse.json({ success: true, message: "تم حفظ واعتماد الجرد الفعلي للمخزن بنجاح وتحديث الأرصدة!" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}