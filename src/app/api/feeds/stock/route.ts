import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = db.prepare(`
      SELECT sku, barcode, model, color, size, good_stock as available_stock, defective_stock, bin_location, updated_at
      FROM products
      ORDER BY model, color, size
    `).all();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_skus: products.length,
      feed: products,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
