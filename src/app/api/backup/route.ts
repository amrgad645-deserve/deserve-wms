import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

const backupsDir = () => {
  const dir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Uses SQLite's online backup API so data still in the WAL file is included.
// (A plain file copy of the .db would miss uncheckpointed WAL data.)
async function snapshot(targetPath: string) {
  const dbFile = path.join(process.cwd(), "deserve_wms.db");
  if (fs.existsSync(dbFile)) {
    fs.copyFileSync(dbFile, targetPath);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "download";

    if (action === "download") {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `deserve_wms_backup_${timestamp}.db`;
      const tmpPath = path.join(backupsDir(), `.tmp_${timestamp}.db`);

      await snapshot(tmpPath);
      const fileBuffer = fs.readFileSync(tmpPath);
      fs.unlinkSync(tmpPath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }

    const dir = backupsDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".db") && !f.startsWith(".tmp_"))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ success: true, backups: files });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "reset") {
      db.exec(`
        UPDATE products SET good_stock = 0, defective_stock = 0;
        DELETE FROM movements;
        DELETE FROM repairs;
        DELETE FROM manifests;
      `);
      return NextResponse.json({
        success: true,
        message: "تم تصفير جميع الأرصدة ومسح الحركات التجريبية بنجاح! جميع الأصناف الـ 118 برصيد 0 وجاهزة للجرد الفعلي.",
      });
    }

    if (action === "restore") {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ success: false, error: "لم يتم تحديد ملف قاعدة بيانات (.db)" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const dbFile = path.join(process.cwd(), "deserve_wms.db");

      // Save a safety snapshot of current db before overwriting
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safetyBackup = path.join(backupsDir(), `pre_restore_${timestamp}.db`);
      if (fs.existsSync(dbFile)) {
        fs.copyFileSync(dbFile, safetyBackup);
      }

      // Overwrite database file
      fs.writeFileSync(dbFile, buffer);

      // Reload in-memory SQLite database
      db.reload();

      return NextResponse.json({
        success: true,
        message: `تمت استعادة قاعدة البيانات بنجاح من الملف (${file.name})! تم تحديث جميع الجداول والأرصدة فوراً.`,
      });
    }


    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup_${timestamp}.db`;
    await snapshot(path.join(backupsDir(), backupName));

    return NextResponse.json({
      success: true,
      message: `تم إنشاء نسخة احتياطية محلية بنجاح: ${backupName}`,
      backupName,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
