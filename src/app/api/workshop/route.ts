import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * Repair lifecycle
 *
 *   defective_stock ──START (INTERNAL)──► IN_PROGRESS ──COMPLETE──► good_stock
 *          │                                  │  └──SCRAP──► SCRAPPED (written off)
 *          │                                  └──ESCALATE──► AT_FACTORY
 *          └──────START (FACTORY)──────────────────────────► AT_FACTORY
 *
 *   AT_FACTORY ──FACTORY_RETURN──► REPAIRED / REPLACED → good_stock   (COMPLETED)
 *                                 CREDIT              → no stock back (CREDITED)
 *                                 REJECTED            → defective_stock (REJECTED)
 *
 * Partial factory returns are supported: the received qty is split into a
 * closed record and the remainder stays open AT_FACTORY.
 */

const nowParts = () => {
  const now = new Date();
  return { dateStr: now.toISOString().split("T")[0], timeStr: now.toTimeString().split(" ")[0] };
};

const nextRepairId = () => {
  const r = db.prepare("SELECT COUNT(*) as c FROM repairs").get() as any;
  return "REP-" + ("0000" + (r.c + 1)).slice(-4);
};

const logMovement = (
  ref: string,
  rep: { sku: string; model: string; color: string; size: string },
  qty: number,
  type: string,
  operator: string,
  notes: string
) => {
  const { dateStr, timeStr } = nowParts();
  const c = db.prepare("SELECT COUNT(*) as c FROM movements").get() as any;
  const movId = "MOV-" + ("0000" + (c.c + 1)).slice(-4);
  db.prepare(`
    INSERT INTO movements (mov_id, date, time, ref_order, sku, model, color, size, qty, type, operator, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(movId, dateStr, timeStr, ref, rep.sku, rep.model, rep.color, rep.size, qty, type, operator, notes);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const search = (searchParams.get("search") || "").trim();
    const factory = (searchParams.get("factory") || "").trim();
    const defect = (searchParams.get("defect") || "").trim();

    let query = "SELECT * FROM repairs WHERE 1=1";
    const params: any[] = [];

    if (status === "CLOSED") {
      query += " AND status IN ('SCRAPPED','CREDITED','REJECTED')";
    } else if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (factory) {
      query += " AND factory_name = ?";
      params.push(factory);
    }

    if (defect) {
      query += " AND defect_reason = ?";
      params.push(defect);
    }

    if (search) {
      query += " AND (sku LIKE ? OR model LIKE ? OR color LIKE ? OR size LIKE ? OR defect_reason LIKE ? OR factory_name LIKE ? OR factory_ref LIKE ? OR repair_id LIKE ? OR notes LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s);
    }

    query += " ORDER BY id DESC";
    const repairs = db.prepare(query).all(...params);

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status='IN_PROGRESS' THEN qty END),0) as internalUnits,
        COALESCE(SUM(CASE WHEN status='AT_FACTORY' THEN qty END),0) as factoryUnits,
        MIN(CASE WHEN status='AT_FACTORY' THEN sent_to_factory_at END) as oldestFactorySend
      FROM repairs
    `).get();

    // Factory stock aggregated insights (grouped by SKU, defect reason, and factory)
    const factoryAggregated = db.prepare(`
      SELECT
        sku, model, color, size, defect_reason, factory_name,
        SUM(qty) as total_qty,
        COUNT(*) as records_count,
        MIN(sent_to_factory_at) as earliest_send
      FROM repairs
      WHERE status = 'AT_FACTORY'
      GROUP BY sku, defect_reason, factory_name
      ORDER BY total_qty DESC
    `).all();

    // Factory stock grouped by defect reason
    const factoryByReason = db.prepare(`
      SELECT defect_reason, SUM(qty) as units, COUNT(*) as count
      FROM repairs
      WHERE status = 'AT_FACTORY'
      GROUP BY defect_reason
      ORDER BY units DESC
    `).all();

    // List of distinct factories
    const distinctFactories = db.prepare(`
      SELECT DISTINCT factory_name FROM repairs WHERE factory_name IS NOT NULL AND factory_name != ''
    `).all().map((r: any) => r.factory_name);

    return NextResponse.json({
      success: true,
      repairs,
      summary,
      factoryAggregated,
      factoryByReason,
      distinctFactories,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, repair_id, operator, notes } = body;
    const op = (operator || "").trim() || "مشرف الصيانة";
    const { dateStr, timeStr } = nowParts();
    const stamp = `${dateStr} ${timeStr}`;

    // ── START: pull from defective stock or directly from good stock into internal repair or straight to factory
    if (action === "START_REPAIR") {
      const { sku, defect_reason, spare_parts, factory_name, factory_ref } = body;
      const repairType = body.repair_type === "FACTORY" ? "FACTORY" : "INTERNAL";
      const numQty = Number(body.qty || 1);
      if (numQty <= 0) throw new Error("الكمية يجب أن تكون أكبر من 0");
      if (repairType === "FACTORY" && !String(factory_name || "").trim()) {
        throw new Error("اسم المصنع مطلوب عند الإرسال للمصنع");
      }

      const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
      if (!product) throw new Error(`الصنف ${sku} غير موجود`);

      // Determine stock deduction:
      const source = body.source === "GOOD" ? "GOOD" : (product.defective_stock >= numQty ? "DEFECTIVE" : "GOOD");

      if (source === "GOOD") {
        if (product.good_stock < numQty) {
          throw new Error(`رصيد المخزن السليم (${product.good_stock}) لا يكفي لسحب (${numQty}) قطعة`);
        }
        db.prepare("UPDATE products SET good_stock = good_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(numQty, sku);
      } else {
        if (product.defective_stock < numQty) {
          throw new Error(`رصيد التالف المعزول (${product.defective_stock}) لا يكفي لسحب (${numQty}) قطعة`);
        }
        db.prepare("UPDATE products SET defective_stock = defective_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(numQty, sku);
      }

      const repId = nextRepairId();
      db.prepare(`
        INSERT INTO repairs (repair_id, sku, model, color, size, qty, defect_reason, spare_parts, status, repair_type,
                             factory_name, factory_ref, sent_to_factory_at, operator, started_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        repId, sku, product.model, product.color, product.size, numQty,
        defect_reason || "غير محدد",
        repairType === "INTERNAL" ? spare_parts || "" : "",
        repairType === "INTERNAL" ? "IN_PROGRESS" : "AT_FACTORY",
        repairType,
        repairType === "FACTORY" ? factory_name.trim() : null,
        repairType === "FACTORY" ? (factory_ref || "").trim() : null,
        repairType === "FACTORY" ? stamp : null,
        op, stamp, notes || ""
      );

      logMovement(
        repId, product, numQty,
        repairType === "INTERNAL" ? "REPAIR_IN" : "FACTORY_SEND",
        op,
        repairType === "INTERNAL"
          ? `تحويل للصيانة الداخلية (سحب من ${source === "GOOD" ? "السليم" : "التالف"}): ${defect_reason || ""}`
          : `إرسال للمصنع (${factory_name})${factory_ref ? ` رقم ${factory_ref}` : ""} (سحب من ${source === "GOOD" ? "السليم" : "التالف"}): ${defect_reason || ""}`
      );

      return NextResponse.json({
        success: true,
        message: repairType === "INTERNAL"
          ? `تم فتح أمر صيانة داخلية ${repId}`
          : `تم تسجيل إرسال ${numQty} قطعة للمصنع (${factory_name}) برقم ${repId}`,
      });
    }

    const repair = db.prepare("SELECT * FROM repairs WHERE repair_id = ?").get(repair_id) as any;
    if (!repair) throw new Error("أمر الصيانة غير موجود");

    // ── Internal repair done → sellable
    if (action === "COMPLETE_REPAIR") {
      if (repair.status !== "IN_PROGRESS") throw new Error("هذا الأمر ليس في الصيانة الداخلية");
      db.prepare("UPDATE repairs SET status='COMPLETED', outcome='REPAIRED', completed_at=?, notes = COALESCE(notes,'') || ? WHERE repair_id=?")
        .run(stamp, notes ? ` | ${notes}` : "", repair_id);
      db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(repair.qty, repair.sku);
      logMovement(repair_id, repair, repair.qty, "REPAIR_OUT", op, `تم الإصلاح داخلياً وإعادة للرصيد السليم. قطع غيار: ${repair.spare_parts || "—"}`);
      return NextResponse.json({ success: true, message: "تم الإصلاح وإعادة القطعة لرصيد البيع" });
    }

    // ── Technician couldn't fix → send to factory
    if (action === "ESCALATE_TO_FACTORY") {
      if (repair.status !== "IN_PROGRESS") throw new Error("يمكن التحويل للمصنع من الصيانة الداخلية فقط");
      const factoryName = String(body.factory_name || "").trim();
      if (!factoryName) throw new Error("اسم المصنع مطلوب");
      db.prepare(`UPDATE repairs SET status='AT_FACTORY', repair_type='FACTORY', factory_name=?, factory_ref=?, sent_to_factory_at=?,
                  notes = COALESCE(notes,'') || ? WHERE repair_id=?`)
        .run(factoryName, (body.factory_ref || "").trim(), stamp, " | تعذر الإصلاح داخلياً، تم التحويل للمصنع", repair_id);
      logMovement(repair_id, repair, repair.qty, "FACTORY_SEND", op, `تحويل من الصيانة الداخلية إلى المصنع (${factoryName})`);
      return NextResponse.json({ success: true, message: `تم تحويل ${repair_id} إلى المصنع (${factoryName})` });
    }

    // ── Factory sent something back (supports partial qty)
    if (action === "FACTORY_RETURN") {
      if (repair.status !== "AT_FACTORY") throw new Error("هذا الأمر ليس عند المصنع");
      const outcome = String(body.outcome || "");
      if (!["REPAIRED", "REPLACED", "CREDIT", "REJECTED"].includes(outcome)) throw new Error("نتيجة المصنع غير صالحة");
      const qty = Number(body.qty || repair.qty);
      if (qty <= 0 || qty > repair.qty) throw new Error(`الكمية يجب أن تكون بين 1 و ${repair.qty}`);

      const newStatus =
        outcome === "CREDIT" ? "CREDITED" : outcome === "REJECTED" ? "REJECTED" : "COMPLETED";
      const outcomeLabel: Record<string, string> = {
        REPAIRED: "رجعت من المصنع متصلحة",
        REPLACED: "المصنع بدّلها بقطعة جديدة",
        CREDIT: "المصنع عوّض (خصم/رصيد) بدون إرجاع",
        REJECTED: "المصنع رفض الضمان ورجعت تالفة",
      };

      let closedId = repair_id;
      if (qty < repair.qty) {
        // Partial: keep remainder open, record the received part as its own closed row
        db.prepare("UPDATE repairs SET qty = qty - ? WHERE repair_id = ?").run(qty, repair_id);
        closedId = nextRepairId();
        db.prepare(`
          INSERT INTO repairs (repair_id, sku, model, color, size, qty, defect_reason, spare_parts, status, repair_type,
                               factory_name, factory_ref, sent_to_factory_at, outcome, operator, started_at, completed_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FACTORY', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          closedId, repair.sku, repair.model, repair.color, repair.size, qty, repair.defect_reason, repair.spare_parts,
          newStatus, repair.factory_name, repair.factory_ref, repair.sent_to_factory_at, outcome, op,
          repair.started_at, stamp, `استلام جزئي من ${repair_id}${notes ? ` | ${notes}` : ""}`
        );
      } else {
        db.prepare("UPDATE repairs SET status=?, outcome=?, completed_at=?, notes = COALESCE(notes,'') || ? WHERE repair_id=?")
          .run(newStatus, outcome, stamp, notes ? ` | ${notes}` : "", repair_id);
      }

      if (outcome === "REPAIRED" || outcome === "REPLACED") {
        db.prepare("UPDATE products SET good_stock = good_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, repair.sku);
      } else if (outcome === "REJECTED") {
        db.prepare("UPDATE products SET defective_stock = defective_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?").run(qty, repair.sku);
      }
      // CREDIT: unit stays with factory, no stock change

      logMovement(closedId, repair, qty, "FACTORY_RETURN", op, `${outcomeLabel[outcome]} (${repair.factory_name})${notes ? ` | ${notes}` : ""}`);

      const msg: Record<string, string> = {
        REPAIRED: `تم استلام ${qty} قطعة متصلحة وإضافتها لرصيد البيع`,
        REPLACED: `تم استلام ${qty} قطعة بديلة وإضافتها لرصيد البيع`,
        CREDIT: `تم تسجيل تعويض المصنع عن ${qty} قطعة`,
        REJECTED: `تم إرجاع ${qty} قطعة لرصيد التالف (رفض المصنع)`,
      };
      return NextResponse.json({ success: true, message: msg[outcome] });
    }

    // ── Write-off
    if (action === "SCRAP") {
      if (repair.status !== "IN_PROGRESS") throw new Error("التكهين متاح من الصيانة الداخلية فقط");
      db.prepare("UPDATE repairs SET status='SCRAPPED', completed_at=?, notes = COALESCE(notes,'') || ? WHERE repair_id=?")
        .run(stamp, notes ? ` | تكهين: ${notes}` : " | غير قابلة للإصلاح (تكهين)", repair_id);
      return NextResponse.json({ success: true, message: "تم تكهين القطعة" });
    }

    throw new Error("نوع الإجراء غير صالح");
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
