import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, bin_location } = body;

    if (!sku) {
      return NextResponse.json({ success: false, error: "كود الصنف مطلوب" }, { status: 400 });
    }

    const cleanLocation = String(bin_location || "").trim().toUpperCase() || "UNASSIGNED";

    db.prepare("UPDATE products SET bin_location = ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(
      cleanLocation,
      sku
    );

    return NextResponse.json({ success: true, message: `تم تحديث مكان الرف للصنف ${sku} إلى (${cleanLocation})` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
