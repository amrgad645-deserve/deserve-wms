import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const limit = Number(searchParams.get("limit") || 100);

    let query = "SELECT * FROM movements WHERE 1=1";
    const params: any[] = [];

    if (search) {
      query += " AND (sku LIKE ? OR ref_order LIKE ? OR mov_id LIKE ? OR model LIKE ? OR operator LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY id DESC LIMIT ?";
    params.push(limit);

    const movements = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, movements });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}