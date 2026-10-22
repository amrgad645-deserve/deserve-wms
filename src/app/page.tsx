"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Inbox, 
  RotateCcw, 
  ArrowUpRight, 
  TrendingDown,
  Layers,
  Sparkles,
  ClipboardCheck,
  RefreshCw
} from "lucide-react";
import { KPIStats } from "@/lib/types";

export default function Dashboard() {
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLowStock(data.lowStockItems);
        setRecentMovements(data.recentMovements);
      }
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              نظام إدارة مخازن DESERVE
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">لوحة تحكم العمليات والمخزون</h1>
          <p className="text-slate-400 text-sm mt-1">تتبع المخزون اللحظي، شحن الأوردرات، استلام الموردين، والمرتجعات بدقة متكاملة</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث لحظي</span>
          </button>
          <Link
            href="/defective"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-sm shadow-sm transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>عزل تالف</span>
          </Link>
          <Link
            href="/audit"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-md transition"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>الجرد الفعلي الافتتاحي</span>
          </Link>
          <Link
            href="/dispatch"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition"
          >
            <Truck className="w-4 h-4" />
            <span>صرف وشحن أوردر</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sellable Stock */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">المخزون السليم المتاح للبيع</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {stats?.totalSellable ?? 0} <span className="text-sm font-bold text-slate-400">قطعة</span>
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span>جاهز للشحن الفوري</span>
            </div>
          </div>
        </div>

        {/* Defective Stock */}
        <Link
          href="/defective"
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-amber-800 transition">مخزون التالف والمحجوز</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-600">
              {stats?.totalDefective ?? 0} <span className="text-sm font-bold text-slate-400">قطعة</span>
            </div>
            <div className="text-xs text-amber-700 font-semibold mt-1 flex items-center justify-between">
              <span>في الحجر / معيب تحضير</span>
              <span className="text-[10px] text-amber-600 font-bold group-hover:underline">فتح العزل ⬅️</span>
            </div>
          </div>
        </Link>

        {/* Total Physical Units */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">إجمالي القطع بأرض المخزن</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {stats?.totalPhysical ?? 0} <span className="text-sm font-bold text-slate-400">قطعة</span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              سليم + تالف (إجمالي 118 SKU)
            </div>
          </div>
        </div>

        {/* Out of stock warning */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">أصناف نفدت أو أوشكت</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-rose-600">
              {(stats?.outOfStockSkus ?? 0) + (stats?.lowStockSkus ?? 0)} <span className="text-sm font-bold text-slate-400">صنف</span>
            </div>
            <div className="text-xs text-rose-600 font-semibold mt-1">
              {stats?.outOfStockSkus ?? 0} نفدت | {stats?.lowStockSkus ?? 0} نواقص (&le; 3)
            </div>
          </div>
        </div>
      </div>

      {/* Today Operations Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">حركات اليوم (Today Operations)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 font-medium">وحدات شحنت اليوم</div>
            <div className="text-xl font-extrabold text-blue-600 mt-0.5">{stats?.todayDispatchedUnits ?? 0} قطعة</div>
            <div className="text-[11px] text-slate-400">({stats?.todayDispatchedOrders ?? 0} أوردر)</div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 font-medium">استلامات الموردين اليوم</div>
            <div className="text-xl font-extrabold text-emerald-600 mt-0.5">{stats?.todayReceivedUnits ?? 0} قطعة</div>
            <div className="text-[11px] text-slate-400">توريدات جديدة</div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 font-medium">مرتجعات سليمة أعيدت للبيع</div>
            <div className="text-xl font-extrabold text-indigo-600 mt-0.5">{stats?.todayReturnedGoodUnits ?? 0} قطعة</div>
            <div className="text-[11px] text-slate-400">Restocked</div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 font-medium">تالف عُزل اليوم</div>
            <div className="text-xl font-extrabold text-amber-600 mt-0.5">{stats?.todayDefectiveUnits ?? 0} قطعة</div>
            <div className="text-[11px] text-slate-400">معيب أو مرتجع تالف</div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Low Stock Alert & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Warning Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h3 className="font-bold text-slate-900 text-sm">تنبيه النواقص والأصناف المنتهية</h3>
            </div>
            <Link href="/stock?status=low" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              <span>عرض كل الأصناف</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">كود الصنف SKU</th>
                  <th className="py-2.5 px-3">الموديل واللون</th>
                  <th className="py-2.5 px-3">المقاس</th>
                  <th className="py-2.5 px-3 text-center">الرصيد المتاح</th>
                  <th className="py-2.5 px-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      لا توجد نواقص حالياً
                    </td>
                  </tr>
                ) : (
                  lowStock.slice(0, 8).map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.sku}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{p.model} - {p.color}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.size}</td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-sm">
                        {p.good_stock === 0 ? (
                          <span className="text-rose-600">0</span>
                        ) : (
                          <span className="text-amber-600">{p.good_stock}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p.good_stock === 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            نفد من المخزن
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            منخفض (&le; 3)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Movements */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">آخر حركات المخزن الموثقة</h3>
            <Link href="/movements" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              <span>عرض سجل الحركات كاملاً</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">نوع الحركة</th>
                  <th className="py-2.5 px-3">المرجع / الأوردر</th>
                  <th className="py-2.5 px-3">الصنف</th>
                  <th className="py-2.5 px-3 text-center">الكمية</th>
                  <th className="py-2.5 px-3">الوقت والموظف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      لا توجد حركات مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  recentMovements.map((m) => {
                    let badge: { text: string; bg: string } = { text: m.type, bg: "bg-slate-100 text-slate-700" };
                    if (m.type === "DISPATCH") badge = { text: "خروج أوردر", bg: "bg-blue-100 text-blue-800" };
                    else if (m.type === "RECEIVE") badge = { text: "استلام مورد", bg: "bg-emerald-100 text-emerald-800" };
                    else if (m.type === "RETURN_GOOD") badge = { text: "مرتجع سليم", bg: "bg-indigo-100 text-indigo-800" };
                    else if (m.type === "RETURN_DEFECTIVE") badge = { text: "مرتجع تالف", bg: "bg-amber-100 text-amber-800" };
                    else if (m.type === "PICKING_DEFECT") badge = { text: "معيب تحضير", bg: "bg-rose-100 text-rose-800" };
                    else if (m.type === "PHYSICAL_AUDIT") badge = { text: "جرد فعلي", bg: "bg-purple-100 text-purple-800" };
                    else if (m.type === "BUNDLE_ASSEMBLE") badge = { text: "تجميع طقم", bg: "bg-indigo-100 text-indigo-800" };
                    else if (m.type === "BUNDLE_DISASSEMBLE") badge = { text: "فك طقم", bg: "bg-indigo-100 text-indigo-800" };
                    else if (m.type === "REPAIR_IN") badge = { text: "دخول ورشة", bg: "bg-amber-100 text-amber-800" };
                    else if (m.type === "REPAIR_OUT") badge = { text: "خروج من الورشة", bg: "bg-emerald-100 text-emerald-800" };
                    else if (m.type === "FACTORY_SEND") badge = { text: "إرسال للمصنع", bg: "bg-violet-100 text-violet-800" };
                    else if (m.type === "FACTORY_RETURN") badge = { text: "رجوع من المصنع", bg: "bg-violet-100 text-violet-800" };

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{m.ref_order || "—"}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {m.sku} <span className="text-slate-400 text-[11px]">({m.model})</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">{m.qty}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <div>{m.date} {m.time}</div>
                          <div className="text-[10px] text-slate-400">{m.operator}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}