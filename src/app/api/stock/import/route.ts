import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

interface ImportItem {
  sku: string;
  goodStock: number;
  defectiveStock?: number;
  model?: string;
  color?: string;
  size?: string;
  barcode?: string;
  binLocation?: string;
  isNew?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, operator, notes, zeroOutMissing } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "لا توجد أصناف صالحة للاستيراد في الملف" },
        { status: 400 }
      );
    }

    const opName = String(operator || "").trim() || "لجنة الجرد الفعلي";
    const noteText = String(notes || "استيراد جرد فعلي وتحديث أرصدة من ملف إكسيل").trim();

    let updatedCount = 0;
    let createdCount = 0;
    let totalGoodSum = 0;
    let totalDefSum = 0;

    const executeImport = db.transaction(() => {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const importedSkus = new Set<string>();

      // 1. Process items
      for (const item of items as ImportItem[]) {
        const sku = String(item.sku || "").trim().toUpperCase();
        if (!sku) continue;

        importedSkus.add(sku);

        const goodStock = Math.max(0, Number(item.goodStock ?? 0));
        const defectiveStock = Math.max(0, Number(item.defectiveStock ?? 0));
        totalGoodSum += goodStock;
        totalDefSum += defectiveStock;

        // Check if product exists
        const existing = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;

        if (existing) {
          // Update existing product
          if (item.binLocation && item.binLocation !== "UNASSIGNED") {
            db.prepare(`
              UPDATE products 
              SET good_stock = ?, defective_stock = ?, bin_location = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE sku = ?
            `).run(goodStock, defectiveStock, item.binLocation.trim().toUpperCase(), sku);
          } else {
            db.prepare(`
              UPDATE products 
              SET good_stock = ?, defective_stock = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE sku = ?
            `).run(goodStock, defectiveStock, sku);
          }
          updatedCount++;
        } else {
          // Insert new product if model/color/size provided
          const model = String(item.model || sku.split("-")[0] || "GENERAL").trim().toUpperCase();
          const color = String(item.color || "STANDARD").trim().toUpperCase();
          const size = String(item.size || "STANDARD").trim().toUpperCase();
          let barcode = String(item.barcode || "").trim();
          if (!barcode) {
            barcode = `890${sku.replace(/[^A-Za-z0-9]/g, "")}`;
          }
          const binLocation = String(item.binLocation || "UNASSIGNED").trim().toUpperCase();

          db.prepare(`
            INSERT INTO products (sku, model, color, size, barcode, good_stock, defective_stock, bin_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(sku, model, color, size, barcode, goodStock, defectiveStock, binLocation);

          createdCount++;
        }

        // Record Audit Movement
        const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
        const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

        const currentProduct = existing || {
          model: item.model || sku,
          color: item.color || "",
          size: item.size || "",
        };

        db.prepare(`
          INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
          VALUES (?, ?, ?, 'EXCEL-AUDIT', ?, ?, ?, ?, ?, 'PHYSICAL_AUDIT', ?, ?)
        `).run(
          movId,
          dateStr,
          timeStr,
          sku,
          currentProduct.model,
          currentProduct.color,
          currentProduct.size,
          goodStock,
          opName,
          `استيراد جرد إكسيل: سليم=${goodStock}، تالف=${defectiveStock}. ${noteText}`
        );
      }

      // 2. Zero out unmentioned items if requested
      if (zeroOutMissing) {
        const allProducts = db.prepare("SELECT sku FROM products").all() as any[];
        for (const p of allProducts) {
          if (!importedSkus.has(p.sku.toUpperCase())) {
            db.prepare(`
              UPDATE products 
              SET good_stock = 0, defective_stock = 0, updated_at = CURRENT_TIMESTAMP 
              WHERE sku = ?
            `).run(p.sku);
          }
        }
      }
    });

    executeImport();

    let msg = `تم بنجاح استيراد وتحديث أرصدة (${updatedCount}) صنف بالمخزن!`;
    if (createdCount > 0) {
      msg += ` وإضافة (${createdCount}) صنف جديد.`;
    }

    return NextResponse.json({
      success: true,
      message: msg,
      totalUpdated: updatedCount,
      totalCreated: createdCount,
      totalGood: totalGoodSum,
      totalDefective: totalDefSum,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
