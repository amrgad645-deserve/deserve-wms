import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Inventory Totals
    const totals = db.prepare(`
      SELECT 
        COALESCE(SUM(good_stock), 0) as totalSellable,
        COALESCE(SUM(defective_stock), 0) as totalDefective,
        COALESCE(SUM(good_stock + defective_stock), 0) as totalPhysical,
        COUNT(sku) as totalSkus,
        COUNT(CASE WHEN good_stock = 0 THEN 1 END) as outOfStockSkus,
        COUNT(CASE WHEN good_stock > 0 AND good_stock <= 3 THEN 1 END) as lowStockSkus
      FROM products
    `).get() as any;

    // Today Operations
    const todayOps = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'DISPATCH' THEN qty ELSE 0 END), 0) as todayDispatchedUnits,
        COUNT(DISTINCT CASE WHEN type = 'DISPATCH' THEN ref_order END) as todayDispatchedOrders,
        COALESCE(SUM(CASE WHEN type = 'RECEIVE' THEN qty ELSE 0 END), 0) as todayReceivedUnits,
        COALESCE(SUM(CASE WHEN type = 'RETURN_GOOD' THEN qty ELSE 0 END), 0) as todayReturnedGoodUnits,
        COALESCE(SUM(CASE WHEN type = 'RETURN_DEFECTIVE' OR type = 'PICKING_DEFECT' THEN qty ELSE 0 END), 0) as todayDefectiveUnits
      FROM movements
      WHERE date = ?
    `).get(today) as any;

    // Low stock items list (< 3)
    const lowStockItems = db.prepare(`
      SELECT sku, model, color, size, barcode, good_stock, defective_stock
      FROM products
      WHERE good_stock <= 3
      ORDER BY good_stock ASC, model ASC
      LIMIT 15
    `).all();

    // Recent movements
    const recentMovements = db.prepare(`
      SELECT * FROM movements
      ORDER BY id DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      success: true,
      stats: {
        ...totals,
        ...todayOps,
      },
      lowStockItems,
      recentMovements
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}