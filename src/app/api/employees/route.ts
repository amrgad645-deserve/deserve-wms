import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const employees = db.prepare("SELECT * FROM employees WHERE active = 1 ORDER BY id ASC").all();
    return NextResponse.json({ success: true, employees });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const role = String(body.role || "أمين مخزن").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "اسم الموظف مطلوب" }, { status: 400 });
    }

    const existing = db.prepare("SELECT * FROM employees WHERE name = ?").get(name) as any;
    if (existing) {
      if (existing.active === 0) {
        db.prepare("UPDATE employees SET active = 1, role = ? WHERE id = ?").run(role, existing.id);
        return NextResponse.json({ success: true, message: `تمت إعادة تفعيل الموظف (${name})` });
      }
      return NextResponse.json({ success: false, error: "الموظف مسجل بالفعل في القائمة" }, { status: 400 });
    }

    const res = db.prepare("INSERT INTO employees (name, role, active) VALUES (?, ?, 1)").run(name, role);

    return NextResponse.json({
      success: true,
      message: `تمت إضافة الموظف (${name}) بنجاح`,
      employee: { id: res.lastInsertRowid, name, role, active: 1 },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const name = String(body.name || "").trim();
    const role = String(body.role || "أمين مخزن").trim();

    if (!id || !name) {
      return NextResponse.json({ success: false, error: "معرف واسم الموظف مطلوبان" }, { status: 400 });
    }

    db.prepare("UPDATE employees SET name = ?, role = ? WHERE id = ?").run(name, role, id);
    return NextResponse.json({ success: true, message: `تم تحديث بيانات الموظف (${name})` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearDefaults = searchParams.get("clear_defaults");
    const all = searchParams.get("all");

    if (clearDefaults === "true") {
      const defaults = ["أحمد حسن", "محمد علي", "محمود إبراهيم", "كريم عادل", "لجنة الجرد الفعلي"];
      db.prepare(`DELETE FROM employees WHERE name IN (${defaults.map(() => "?").join(",")})`).run(...defaults);
      return NextResponse.json({ success: true, message: "تم حذف جميع الأسماء التجريبية الافتراضية بنجاح" });
    }

    if (all === "true") {
      db.prepare("DELETE FROM employees").run();
      return NextResponse.json({ success: true, message: "تم إفراغ قائمة الموظفين بالكامل" });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "معرف الموظف مطلوب" }, { status: 400 });
    }

    db.prepare("DELETE FROM employees WHERE id = ?").run(Number(id));
    return NextResponse.json({ success: true, message: "تم حذف الموظف من القائمة بنجاح" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
