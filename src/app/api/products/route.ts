import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const model = searchParams.get("model") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";

    let query = "SELECT * FROM products WHERE 1=1";
    const params: any[] = [];

    // Category filter
    if (category === "sets") {
      query += " AND (sku LIKE '%-SET' OR size LIKE '%SET%' OR model LIKE '%SET%')";
    } else if (category === "singles") {
      query += " AND sku NOT LIKE '%-SET' AND model NOT LIKE '%COVER%'";
    } else if (category === "covers") {
      query += " AND model LIKE '%COVER%'";
    }

    if (model) {
      if (model === "ALL_SETS") {
        query += " AND (sku LIKE '%-SET' OR size LIKE '%SET%' OR model LIKE '%SET%')";
      } else {
        query += " AND model = ?";
        params.push(model);
      }
    }

    if (search) {
      const clean = search.toLowerCase();
      const isSetSearch = ["طقم", "اطقم", "أطقم", "مجموعة", "مجموعه", "set"].some((k) => clean.includes(k));

      // Color synonyms in Arabic
      const colorArabicMap: Record<string, string[]> = {
        black: ["اسود", "أسود", "بلاك"],
        beige: ["بيج"],
        navy: ["كحلي", "كحلى", "ازرق داكن"],
        "olive green": ["زيتي", "زيتى", "اخضر"],
        pink: ["وردي", "وردى", "بينك", "زهري"],
        "dark mauve": ["موف", "موف غامق", "بنفسجي"],
        lemon: ["ليموني", "اصفر", "أصفر"],
        silver: ["فضي", "فضى", "سيلفر", "رمادي"],
        turquoise: ["تركواز", "فيروزي"],
        orange: ["برتقالي", "اورنج"],
        "rose gold": ["روز", "روز جولد"],
        "denim blue": ["جينز", "دينم", "ازرق"],
        purple: ["بيربل", "بنفسجي", "موف"],
      };

      const matchedColors: string[] = [];
      for (const [engColor, arList] of Object.entries(colorArabicMap)) {
        if (arList.some((ar) => clean.includes(ar))) {
          matchedColors.push(`%${engColor}%`);
        }
      }

      let searchClauses = "(sku LIKE ? OR barcode LIKE ? OR model LIKE ? OR color LIKE ? OR size LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);

      if (isSetSearch) {
        searchClauses += " OR (sku LIKE '%-SET' OR size LIKE '%SET%' OR model LIKE '%SET%')";
      }

      if (matchedColors.length > 0) {
        for (const col of matchedColors) {
          searchClauses += " OR color LIKE ?";
          params.push(col);
        }
      }

      query += ` AND (${searchClauses})`;
    }

    if (status === "out") {
      query += " AND good_stock = 0";
    } else if (status === "low") {
      query += " AND good_stock > 0 AND good_stock <= 3";
    } else if (status === "healthy") {
      query += " AND good_stock > 3";
    } else if (status === "defective") {
      query += " AND defective_stock > 0";
    }

    query += " ORDER BY model ASC, color ASC, size ASC";
    const products = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. CREATE NEW PRODUCT(S)
    if (action === "create") {
      const items = Array.isArray(body.products) ? body.products : [body];
      if (!items || items.length === 0) {
        return NextResponse.json({ success: false, error: "بيانات الصنف مطلوبة" }, { status: 400 });
      }

      const operator = String(body.operator || "").trim() || "مشرف المخزن";
      const createdSkus: string[] = [];

      const tx = db.transaction(() => {
        for (const item of items) {
          const sku = String(item.sku || "").trim().toUpperCase();
          const model = String(item.model || "").trim().toUpperCase();
          const color = String(item.color || "").trim().toUpperCase();
          const size = String(item.size || "").trim().toUpperCase();
          const binLocation = String(item.binLocation || item.bin_location || "UNASSIGNED").trim().toUpperCase();
          const goodStock = Math.max(0, Number(item.goodStock ?? item.good_stock ?? 0));
          const defectiveStock = Math.max(0, Number(item.defectiveStock ?? item.defective_stock ?? 0));

          if (!sku || !model || !color || !size) {
            throw new Error("يرجى ملء جميع الحقول الإلزامية: الموديل، اللون، المقاس، وكود الصنف (SKU)");
          }

          // Check duplicate SKU
          const existing = db.prepare("SELECT sku FROM products WHERE sku = ?").get(sku) as any;
          if (existing) {
            throw new Error(`كود الصنف (${sku}) موجود مسبقاً في النظام!`);
          }

          // Auto-generate or validate barcode
          let barcode = String(item.barcode || "").trim();
          if (!barcode) {
            barcode = `890${sku.replace(/[^A-Za-z0-9]/g, "")}`;
          }

          // Check duplicate Barcode
          const existingBc = db.prepare("SELECT sku FROM products WHERE barcode = ?").get(barcode) as any;
          if (existingBc) {
            throw new Error(`الباركود (${barcode}) مسجل بالفعل لصنف آخر (${existingBc.sku})!`);
          }

          // Insert product
          db.prepare(`
            INSERT INTO products (sku, model, color, size, barcode, good_stock, defective_stock, bin_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(sku, model, color, size, barcode, goodStock, defectiveStock, binLocation);

          createdSkus.push(sku);

          // If opening stock > 0, record initial movement
          if (goodStock > 0 || defectiveStock > 0) {
            const now = new Date();
            const dateStr = now.toISOString().split("T")[0];
            const timeStr = now.toTimeString().split(" ")[0];

            const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
            const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

            db.prepare(`
              INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
              VALUES (?, ?, ?, 'OPENING_STOCK', ?, ?, ?, ?, ?, 'INITIAL_STOCK', ?, ?)
            `).run(
              movId,
              dateStr,
              timeStr,
              sku,
              model,
              color,
              size,
              goodStock + defectiveStock,
              operator,
              `رصيد افتتاحي عند إضافة الصنف: سليم (${goodStock})، تالف (${defectiveStock})`
            );
          }
        }
      });

      tx();

      return NextResponse.json({
        success: true,
        message: createdSkus.length === 1 
          ? `تم إضافة الصنف (${createdSkus[0]}) بنجاح إلى الكتالوج`
          : `تم إضافة عدد (${createdSkus.length}) أصناف بنجاح إلى الكتالوج`,
        createdSkus,
      });
    }

    // 2. DELETE PRODUCT
    if (action === "delete") {
      const { sku } = body;
      if (!sku) {
        return NextResponse.json({ success: false, error: "كود الصنف مطلوب للحذف" }, { status: 400 });
      }

      const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
      if (!product) {
        return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
      }

      if (product.good_stock > 0 || product.defective_stock > 0) {
        return NextResponse.json({
          success: false,
          error: `لا يمكن حذف الصنف (${sku}) لوجود رصيد حالي بالمخزن (${product.good_stock + product.defective_stock} قطعة). يرجى تصفير الرصيد أولاً قبل الحذف.`,
        }, { status: 400 });
      }

      db.transaction(() => {
        db.prepare("DELETE FROM movements WHERE sku = ?").run(sku);
        db.prepare("DELETE FROM repairs WHERE sku = ?").run(sku);
        db.prepare("DELETE FROM products WHERE sku = ?").run(sku);
      })();

      return NextResponse.json({
        success: true,
        message: `تم حذف الصنف (${sku}) من الكتالوج بنجاح`,
      });
    }

    // 3. STOCK ADJUSTMENT (Default fallback)
    const { sku, goodStock, defectiveStock, operator, reason } = body;

    if (!sku) {
      return NextResponse.json({ success: false, error: "كود الصنف مطلوب" }, { status: 400 });
    }

    const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
    if (!product) {
      return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
    }

    const newGood = Math.max(0, Number(goodStock ?? product.good_stock));
    const newDef = Math.max(0, Number(defectiveStock ?? product.defective_stock));
    const diffGood = newGood - product.good_stock;
    const diffDef = newDef - product.defective_stock;

    const op = String(operator || "").trim() || "مشرف المخزن";
    const notes = String(reason || "تسوية مخزنية يدوية مباشرة").trim();

    const tx = db.transaction(() => {
      // 1. Update product stock
      db.prepare(`
        UPDATE products 
        SET good_stock = ?, defective_stock = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE sku = ?
      `).run(newGood, newDef, sku);

      // 2. Record movement
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const countRes = db.prepare("SELECT COUNT(*) as count FROM movements").get() as any;
      const movId = "MOV-" + ("0000" + (countRes.count + 1)).slice(-4);

      db.prepare(`
        INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
        VALUES (?, ?, ?, 'MANUAL-ADJUST', ?, ?, ?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?)
      `).run(
        movId,
        dateStr,
        timeStr,
        sku,
        product.model,
        product.color,
        product.size,
        Math.abs(diffGood) + Math.abs(diffDef),
        op,
        `تسوية يدوية: سليم (${product.good_stock} ← ${newGood})، تالف (${product.defective_stock} ← ${newDef}). ${notes}`
      );
    });

    tx();

    return NextResponse.json({
      success: true,
      message: `تم تحديث رصيد الصنف (${sku}) بنجاح: سليم (${newGood})، تالف (${newDef})`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}