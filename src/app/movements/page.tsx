"use client";

import { useState, useEffect } from "react";
import { History, Search, Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { Movement } from "@/lib/types";

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedType) params.set("type", selectedType);

      const res = await fetch(`/api/movements?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMovements(data.movements);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [search, selectedType]);

  const exportToExcel = () => {
    const exportData = movements.map((m) => ({
      "كود الحركة": m.mov_id,
      "التاريخ": m.date,
      "الوقت": m.time,
      "المرجع / الأوردر": m.ref_order,
      "كود الصنف SKU": m.sku,
      "الموديل": m.model,
      "اللون": m.color,
      "المقاس": m.size,
      "الكمية": m.qty,
      "نوع العملية": m.type,
      "المسؤول": m.operator,
      "ملاحظات": m.notes
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DESERVE_Movement_Audit");
    XLSX.writeFile(wb, `DESERVE_Audit_Log_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">سجل الحركات التاريخي الشامل (Audit Trail Log)</h1>
            <p className="text-slate-500 text-xs">توثيق دقيق لكل عملية صرف، استلام، مرتجع، أو جرد بالتاريخ والوقت ورقم المرجع</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMovements}
            className="p-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
          >
            <Download className="w-4 h-4" />
            <span>تصدير السجل لإكسيل</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الحركة، رقم الأوردر، كود SKU، أو اسم الموظف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
        >
          <option value="">جميع أنواع العمليات</option>
          <option value="DISPATCH">خروج أوردر (DISPATCH)</option>
          <option value="RECEIVE">استلام موردين (RECEIVE)</option>
          <option value="RETURN_GOOD">مرتجع سليم (RETURN_GOOD)</option>
          <option value="RETURN_DEFECTIVE">مرتجع تالف (RETURN_DEFECTIVE)</option>
          <option value="PICKING_DEFECT">معيب تحضير (PICKING_DEFECT)</option>
          <option value="PHYSICAL_AUDIT">جرد فعلي (PHYSICAL_AUDIT)</option>
          <option value="BUNDLE_ASSEMBLE">تجميع طقم</option>
          <option value="BUNDLE_DISASSEMBLE">فك طقم</option>
          <option value="REPAIR_IN">دخول ورشة</option>
          <option value="REPAIR_OUT">خروج من الورشة</option>
          <option value="FACTORY_SEND">إرسال للمصنع</option>
          <option value="FACTORY_RETURN">رجوع من المصنع</option>
        </select>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="py-3 px-4">كود الحركة</th>
                <th className="py-3 px-4">نوع العملية</th>
                <th className="py-3 px-4">المرجع / الأوردر</th>
                <th className="py-3 px-4">الصنف (SKU)</th>
                <th className="py-3 px-4">الموديل والمقاس</th>
                <th className="py-3 px-4 text-center">الكمية</th>
                <th className="py-3 px-4">المسؤول</th>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    لا توجد حركات مسجلة مطابقة للبحث
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
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
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{m.mov_id}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{m.ref_order || "—"}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{m.sku}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {m.model} - {m.color} ({m.size})
                      </td>
                      <td className="py-3 px-4 text-center font-black text-sm text-slate-900">{m.qty}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{m.operator}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                        {m.date} {m.time}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">{m.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}