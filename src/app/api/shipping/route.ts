import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const manifests = db.prepare("SELECT * FROM manifests ORDER BY id DESC LIMIT 50").all();
    return NextResponse.json({ success: true, manifests });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courier, driver_name, driver_phone, car_number, orders, operator } = body;

    if (!courier) throw new Error("اسم شركة الشحن مطلوب");
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      throw new Error("يجب إضافة أوردر واحد على الأقل في الكشف");
    }

    const countRes = db.prepare("SELECT COUNT(*) as count FROM manifests").get() as any;
    const manifestId = "MAN-" + ("0000" + (countRes.count + 1)).slice(-4);

    const ordersJson = JSON.stringify(orders);

    db.prepare(`
      INSERT INTO manifests (manifest_id, courier, driver_name, driver_phone, car_number, orders_json, total_orders, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      manifestId,
      courier.trim(),
      driver_name ? driver_name.trim() : "",
      driver_phone ? driver_phone.trim() : "",
      car_number ? car_number.trim() : "",
      ordersJson,
      orders.length,
      operator || "مسؤول الشحن"
    );

    return NextResponse.json({
      success: true,
      manifestId,
      message: `تم إنشاء كشف تسليم المندوب (${manifestId}) بعدد ${orders.length} شحنة بنجاح`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
