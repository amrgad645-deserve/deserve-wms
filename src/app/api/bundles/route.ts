import { NextResponse } from "next/server";
import { getAvailableBundles, assembleSet, disassembleSet } from "@/lib/bundles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bundles = getAvailableBundles();
    return NextResponse.json({ success: true, bundles });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, setSku, qty, operator, notes } = body;

    const numQty = Number(qty || 1);
    if (!setSku) throw new Error("كود الطقم مطلوب");

    if (action === "ASSEMBLE") {
      assembleSet(setSku, numQty, operator, notes);
      return NextResponse.json({ success: true, message: `تم تجميع عدد (${numQty}) طقم كامل بنجاح وإضافته لرصيد البيع` });
    } else if (action === "DISASSEMBLE") {
      disassembleSet(setSku, numQty, operator, notes);
      return NextResponse.json({ success: true, message: `تم فك عدد (${numQty}) طقم وإضافة المقاسات الفردية (21 و 25 و 29) لرصيد البيع` });
    } else {
      throw new Error("نوع الإجراء غير صالح (يجب أن يكون ASSEMBLE أو DISASSEMBLE)");
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
