"use client";

import React, { useState, useEffect } from "react";
import { 
  Wrench, 
  Factory, 
  CheckCircle, 
  PlusCircle, 
  PackageCheck, 
  Clock, 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  FileSpreadsheet, 
  Layers, 
  Tag, 
  AlertCircle,
  TrendingUp,
  FileText
} from "lucide-react";
import * as XLSX from "xlsx";
import { Product, RepairItem } from "@/lib/types";
import OperatorSelect from "@/components/OperatorSelect";

type Tab = "IN_PROGRESS" | "AT_FACTORY" | "COMPLETED" | "CLOSED" | "";

const DEFECTS = [
  "كسر في العجلات السفلية",
  "تلف أو خروج السحاب (السوستة)",
  "عطل بذراع السحب التلسكوبي",
  "كسر في المقبض العلوي/الجانبي",
  "عطل بقفل الأمان TSA",
  "خدش أو كسر سطحي",
  "كسر في جسم الشنطة (الشل)",
  "عيب تصنيع",
];

const COMMON_FACTORIES = [
  "مصنع DESERVE الرئيسي",
  "مصنع العاشر من رمضان",
  "ورشة الشاسيهات والقفل",
  "مصنع كفر الدوار",
];

const daysSince = (stamp?: string) => {
  if (!stamp) return 0;
  const d = new Date(stamp.replace(" ", "T"));
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

export default function WorkshopPage() {
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [summary, setSummary] = useState<{ internalUnits: number; factoryUnits: number; oldestFactorySend?: string }>({
    internalUnits: 0,
    factoryUnits: 0,
  });
  const [factoryAggregated, setFactoryAggregated] = useState<any[]>([]);
  const [factoryByReason, setFactoryByReason] = useState<any[]>([]);
  const [distinctFactories, setDistinctFactories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("AT_FACTORY"); // Default to AT_FACTORY for direct visibility!
  const [search, setSearch] = useState("");
  const [selectedFactory, setSelectedFactory] = useState("");
  const [selectedDefect, setSelectedDefect] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [operator, setOperator] = useState("");

  // New item modal
  const [newOpen, setNewOpen] = useState(false);
  const [repairType, setRepairType] = useState<"INTERNAL" | "FACTORY">("FACTORY");
  const [selectedSku, setSelectedSku] = useState("");
  const [qty, setQty] = useState(1);
  const [defectReason, setDefectReason] = useState(DEFECTS[0]);
  const [spareParts, setSpareParts] = useState("");
  const [factoryName, setFactoryName] = useState(COMMON_FACTORIES[0]);
  const [factoryRef, setFactoryRef] = useState("");
  const [notes, setNotes] = useState("");
  const [deductDefective, setDeductDefective] = useState(true);

  // Escalate / factory-return modals
  const [escalateFor, setEscalateFor] = useState<RepairItem | null>(null);
  const [returnFor, setReturnFor] = useState<RepairItem | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnOutcome, setReturnOutcome] = useState<"REPAIRED" | "REPLACED" | "CREDIT" | "REJECTED">("REPAIRED");
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab) params.set("status", tab);
      if (search) params.set("search", search);
      if (selectedFactory) params.set("factory", selectedFactory);
      if (selectedDefect) params.set("defect", selectedDefect);

      const [repRes, prodRes] = await Promise.all([
        fetch(`/api/workshop?${params.toString()}`),
        fetch("/api/products"), // Load all 118 catalog products!
      ]);
      const [repData, prodData] = await Promise.all([repRes.json(), prodRes.json()]);
      if (repData.success) {
        setRepairs(repData.repairs);
        setSummary(repData.summary);
        setFactoryAggregated(repData.factoryAggregated || []);
        setFactoryByReason(repData.factoryByReason || []);
        setDistinctFactories(repData.distinctFactories || []);
      }
      if (prodData.success) {
        setProducts(prodData.products);
        if (prodData.products.length > 0 && !selectedSku) {
          setSelectedSku(prodData.products[0].sku);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, selectedFactory, selectedDefect]);

  const post = async (payload: any) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator, ...payload }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatusMsg({ text: data.message });
      await loadData();
      return true;
    } catch (err: any) {
      setStatusMsg({ text: err.message, isError: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await post({
      action: "START_REPAIR",
      repair_type: repairType,
      sku: selectedSku,
      qty,
      defect_reason: defectReason,
      spare_parts: spareParts,
      factory_name: factoryName,
      factory_ref: factoryRef,
      deduct_defective: deductDefective,
      notes,
    });
    if (ok) {
      setNewOpen(false);
      setNotes("");
      setFactoryRef("");
      setQty(1);
    }
  };

  // ── Excel Export: Comprehensive 2-Sheet Workbook
  const exportFactoryExcel = () => {
    // 1. Target records (AT_FACTORY or all factory-related)
    const targetItems = tab === "AT_FACTORY" 
      ? repairs 
      : repairs.filter((r) => r.status === "AT_FACTORY" || r.repair_type === "FACTORY");

    const itemsToExport = targetItems.length > 0 ? targetItems : repairs;

    if (itemsToExport.length === 0) {
      alert("لا توجد بيانات أصناف تالفة لتصديرها حالياً.");
      return;
    }

    // Sheet 1: Detailed List
    const detailedData = itemsToExport.map((r) => {
      const isSet = r.sku.endsWith("-SET") || (r.size && r.size.toUpperCase().includes("SET"));
      return {
        "رقم إذن الصيانة": r.repair_id,
        "كود الصنف (SKU)": r.sku,
        "نوع الصنف": isSet ? "طقم كامل (3 قطع)" : r.model.includes("COVER") ? "كفر حماية" : "شنطة فردية",
        "الموديل (Model)": r.model,
        "اللون (Color)": r.color,
        "المقاس (Size)": r.size,
        "الكمية التالفة": r.qty,
        "الوحدة": isSet ? "طقم" : "قطعة",
        "سبب التلف بالتفصيل": r.defect_reason,
        "اسم المصنع": r.factory_name || "المصنع الرئيسي",
        "رقم إذن / بوليصة المصنع": r.factory_ref || "—",
        "تاريخ الإرسال للمصنع": r.sent_to_factory_at || r.started_at || "—",
        "مدة البقاء عند المصنع": daysSince(r.sent_to_factory_at || r.started_at) + " يوم",
        "الحالة الحالية": r.status === "AT_FACTORY" ? "موجود حالياً عند المصنع" : r.status,
        "المسؤول عن الإرسال": r.operator,
        "ملاحظات": r.notes || "—",
      };
    });

    // Sheet 2: Aggregated Claim Summary (Grouped by SKU, Defect Reason, Factory)
    const map = new Map<string, any>();
    itemsToExport.forEach((r) => {
      const key = `${r.sku}__${r.defect_reason}__${r.factory_name || "default"}`;
      const isSet = r.sku.endsWith("-SET") || (r.size && r.size.toUpperCase().includes("SET"));
      if (!map.has(key)) {
        map.set(key, {
          "كود الصنف (SKU)": r.sku,
          "نوع الصنف": isSet ? "طقم كامل (3 قطع)" : r.model.includes("COVER") ? "كفر حماية" : "شنطة فردية",
          "الموديل (Model)": r.model,
          "اللون (Color)": r.color,
          "المقاس (Size)": r.size,
          "سبب التلف": r.defect_reason,
          "إجمالي الكمية عند المصنع": 0,
          "الوحدة": isSet ? "طقم" : "قطعة",
          "اسم المصنع": r.factory_name || "المصنع الرئيسي",
          "عدد الأذونات / الشحنات": 0,
          "أقدم تاريخ إرسال": r.sent_to_factory_at || r.started_at || "—",
        });
      }
      const entry = map.get(key);
      entry["إجمالي الكمية عند المصنع"] += r.qty;
      entry["عدد الأذونات / الشحنات"] += 1;
    });

    const summaryData = Array.from(map.values());

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(detailedData);
    const ws2 = XLSX.utils.json_to_sheet(summaryData.length > 0 ? summaryData : detailedData);

    XLSX.utils.book_append_sheet(wb, ws1, "كشف_استوك_المصنع_التفصيلي");
    XLSX.utils.book_append_sheet(wb, ws2, "ملخص_المطالبة_والألوان");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `DESERVE_Factory_Defective_Stock_${dateStr}.xlsx`);
  };

  const selectedProd = products.find((p) => p.sku === selectedSku);
  const oldestDays = daysSince(summary.oldestFactorySend);

  const statusBadge = (r: RepairItem) => {
    const map: Record<string, { t: string; c: string }> = {
      IN_PROGRESS: { t: "صيانة داخلية", c: "bg-amber-100 text-amber-800" },
      AT_FACTORY: { t: "عند المصنع", c: "bg-violet-100 text-violet-800" },
      COMPLETED: {
        t: r.outcome === "REPLACED" ? "اتبدلت من المصنع" : r.repair_type === "FACTORY" ? "اتصلحت في المصنع" : "اتصلحت داخلياً",
        c: "bg-emerald-100 text-emerald-800",
      },
      CREDITED: { t: "تعويض من المصنع", c: "bg-sky-100 text-sky-800" },
      REJECTED: { t: "المصنع رفض ← تالف", c: "bg-rose-100 text-rose-800" },
      SCRAPPED: { t: "كهنة", c: "bg-slate-200 text-slate-700" },
    };
    const b = map[r.status] || { t: r.status, c: "bg-slate-100" };
    return <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${b.c}`}>{b.t}</span>;
  };

  const tabs: { key: Tab; label: string; active: string }[] = [
    { key: "AT_FACTORY", label: `عند المصنع (${summary.factoryUnits}) 🏭`, active: "bg-violet-600 text-white shadow-md shadow-violet-600/30" },
    { key: "IN_PROGRESS", label: `صيانة داخلية (${summary.internalUnits}) 🔧`, active: "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20" },
    { key: "COMPLETED", label: "رجعت للبيع ✅", active: "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" },
    { key: "CLOSED", label: "تعويض / رفض / كهنة 📋", active: "bg-rose-600 text-white shadow-md shadow-rose-600/20" },
    { key: "", label: "الكل", active: "bg-slate-800 text-white" },
  ];

  const uniqueSkusAtFactory = Array.from(new Set(factoryAggregated.map((a) => a.sku))).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-500/20 border border-violet-500/30 rounded-2xl text-violet-400 shadow-lg shadow-violet-500/10">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">الصيانة واستوك المصنع التالف</h1>
            <p className="text-slate-400 text-xs">
              التحكم الكامل في الأصناف التالفة عند المصنع، متابعة الألوان والمقاسات وأسباب التلف، وسحب كشوفات الإكسيل لحظياً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportFactoryExcel}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/20"
            title="تصدير شيت إكسيل يحتوي على كشف تفصيلي وملخص مجمع للمصنع بالألوان والمقاسات"
          >
            <Download className="w-4 h-4" />
            <span>تصدير كشف استوك المصنع (Excel)</span>
          </button>

          <button
            onClick={() => {
              setRepairType("FACTORY");
              setNewOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-violet-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إرسال تالف للمصنع</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setTab("AT_FACTORY")}
          className="bg-white rounded-2xl p-4 border-2 border-violet-200/80 hover:border-violet-500 transition cursor-pointer shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">إجمالي التالف عند المصنع</div>
            <div className="text-2xl font-black text-violet-900">
              {summary.factoryUnits} <span className="text-xs text-slate-400 font-bold">قطعة</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setTab("AT_FACTORY")}
          className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-400 transition cursor-pointer shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">الأصناف المختلفة (SKUs)</div>
            <div className="text-2xl font-black text-slate-800">
              {uniqueSkusAtFactory} <span className="text-xs text-slate-400 font-bold">صنف</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setTab("IN_PROGRESS")}
          className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-amber-400 transition cursor-pointer shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">في ورشة المخزن الداخلية</div>
            <div className="text-2xl font-black text-amber-900">
              {summary.internalUnits} <span className="text-xs text-slate-400 font-bold">قطعة</span>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${oldestDays > 30 ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${oldestDays > 30 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">أقدم شحنة عند المصنع</div>
            <div className="text-2xl font-black text-slate-900">
              {summary.factoryUnits ? oldestDays : "—"} <span className="text-xs text-slate-400 font-bold">{summary.factoryUnits ? "يوم" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${statusMsg.isError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400">✕</button>
        </div>
      )}

      {/* Factory Control Banner (When AT_FACTORY is active) */}
      {tab === "AT_FACTORY" && factoryByReason.length > 0 && (
        <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse"></span>
              <span className="text-xs font-black tracking-wide">تحليل أسباب التلف لدى المصنع:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {factoryByReason.slice(0, 4).map((f) => (
                <span key={f.defect_reason} className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-[11px] font-bold text-violet-200">
                  {f.defect_reason}: <strong className="text-white font-black">{f.units}</strong> قطعة
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Operator Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setTab(t.key)}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              tab === t.key ? t.active : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{t.label}</span>
          </button>
        ))}

        <div className="mr-auto flex items-center gap-2">
          <span className="text-slate-500 font-bold text-xs whitespace-nowrap">المسؤول:</span>
          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label=""
            selectClassName="py-1 px-2.5 text-xs font-bold"
            className="w-44"
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="ابحث بكود الصنف، الموديل، اللون، سبب التلف، اسم المصنع، أو رقم الإذن..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {distinctFactories.length > 0 && (
            <select
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">جميع المصانع</option>
              {distinctFactories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedDefect}
            onChange={(e) => setSelectedDefect(e.target.value)}
            className="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">جميع أسباب التلف</option>
            {DEFECTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {(search || selectedFactory || selectedDefect) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedFactory("");
                setSelectedDefect("");
              }}
              className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition border border-rose-200"
            >
              إلغاء الفلترة
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="py-3 px-4">رقم الإذن</th>
                <th className="py-3 px-4">الصنف والموديل</th>
                <th className="py-3 px-4">اللون والمقاس</th>
                <th className="py-3 px-4">سبب التلف</th>
                <th className="py-3 px-4 text-center">الكمية</th>
                <th className="py-3 px-4">المصنع / الفني</th>
                <th className="py-3 px-4 text-center">المدة</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                    <span>جاري تحميل بيانات الصيانة والمصنع...</span>
                  </td>
                </tr>
              ) : repairs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    لا توجد أصناف تالفة مطابقة للبحث أو التبويب الحالي
                  </td>
                </tr>
              ) : (
                repairs.map((r) => {
                  const days = daysSince(r.sent_to_factory_at || r.started_at);
                  const isSet = r.sku.endsWith("-SET") || (r.size && r.size.toUpperCase().includes("SET"));

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSet ? "bg-purple-50/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {r.repair_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{r.sku}</span>
                          {isSet && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black">
                              طقم
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold">{r.model}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{r.color}</div>
                        <div className="text-[11px] text-slate-500">
                          {isSet ? "طقم كامل (21 + 25 + 29)" : r.size}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-rose-700">{r.defect_reason}</div>
                        {r.spare_parts && (
                          <div className="text-[10px] text-slate-500">قطع غيار: {r.spare_parts}</div>
                        )}
                        {r.notes && (
                          <div className="text-[10px] text-slate-400 italic">{r.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-sm text-slate-900">
                        {r.qty} {isSet ? <span className="text-[10px] text-purple-700">طقم</span> : <span className="text-[10px] text-slate-500">قطعة</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.repair_type === "FACTORY" ? (
                          <>
                            <div className="font-bold text-violet-800">{r.factory_name || "المصنع"}</div>
                            <div className="text-[10px] text-slate-400">
                              {r.factory_ref ? `بوليصة: ${r.factory_ref} · ` : ""}
                              {r.sent_to_factory_at?.split(" ")[0]}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-amber-800">{r.operator}</div>
                            <div className="text-[10px] text-slate-400">{r.started_at?.split(" ")[0]}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            days > 30
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : days > 14
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {days} يوم
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{statusBadge(r)}</td>
                      <td className="py-3 px-4">
                        {r.status === "IN_PROGRESS" && (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              disabled={busy}
                              onClick={() =>
                                confirm("اتصلحت؟ هترجع لرصيد البيع السليم.") &&
                                post({ action: "COMPLETE_REPAIR", repair_id: r.repair_id })
                              }
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle className="w-3 h-3" /> اتصلحت
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEscalateFor(r);
                                setFactoryRef("");
                              }}
                              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            >
                              <Factory className="w-3 h-3" /> للمصنع
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                confirm("تكهين نهائي؟") &&
                                post({ action: "SCRAP", repair_id: r.repair_id })
                              }
                              className="px-2 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-[11px]"
                            >
                              تكهين
                            </button>
                          </div>
                        )}
                        {r.status === "AT_FACTORY" && (
                          <div className="flex justify-center">
                            <button
                              disabled={busy}
                              onClick={() => {
                                setReturnFor(r);
                                setReturnQty(r.qty);
                                setReturnOutcome("REPAIRED");
                                setNotes("");
                              }}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>استلام من المصنع</span>
                            </button>
                          </div>
                        )}
                        {!["IN_PROGRESS", "AT_FACTORY"].includes(r.status) && (
                          <div className="text-center text-[11px] text-slate-400 font-mono">
                            {r.completed_at?.split(" ")[0]}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Item / Factory Dispatch Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <form
            onSubmit={submitNew}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-violet-400" />
                <h3 className="font-black text-sm">تسجيل قطعة تالفة وإرسالها للصيانة / المصنع</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Path choice */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRepairType("FACTORY")}
                  className={`p-3 rounded-2xl border-2 text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    repairType === "FACTORY"
                      ? "border-violet-600 bg-violet-50 text-violet-950 font-black shadow-sm"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Factory className="w-5 h-5 text-violet-600" />
                  <span>ترجع للمصنع (Factory Return)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRepairType("INTERNAL")}
                  className={`p-3 rounded-2xl border-2 text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    repairType === "INTERNAL"
                      ? "border-amber-500 bg-amber-50 text-amber-950 font-black shadow-sm"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Wrench className="w-5 h-5 text-amber-500" />
                  <span>نصلحها عندنا بالورشة</span>
                </button>
              </div>

              {/* SKU Selection from all 118 catalog products */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اختر الصنف من كتالوج الـ 118 صنفاً *
                </label>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {products.map((p) => {
                    const isSet = p.sku.endsWith("-SET");
                    return (
                      <option key={p.sku} value={p.sku}>
                        {isSet ? "📦 [طقم] " : "🧳 "} {p.sku} — {p.model} — {p.color} ({p.size}) [تالف المخزن: {p.defective_stock}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity and Defect Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية التالفة *</label>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب التلف الدقيق *</label>
                  <select
                    value={defectReason}
                    onChange={(e) => setDefectReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {DEFECTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {repairType === "INTERNAL" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">قطع الغيار المطلوبة للإصلاح</label>
                  <input
                    value={spareParts}
                    onChange={(e) => setSpareParts(e.target.value)}
                    placeholder="مثال: عجلتين مقاس 25، سوستة رئيسية، ذراع سحب..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-violet-50/50 rounded-2xl border border-violet-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-violet-900 mb-1">اسم المصنع *</label>
                      <input
                        list="factories-list"
                        value={factoryName}
                        onChange={(e) => setFactoryName(e.target.value)}
                        required
                        placeholder="اختر أو اكتب اسم المصنع"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                      />
                      <datalist id="factories-list">
                        {COMMON_FACTORIES.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-violet-900 mb-1">رقم البوليصة / إذن الخروج</label>
                      <input
                        value={factoryRef}
                        onChange={(e) => setFactoryRef(e.target.value)}
                        placeholder="RMA-102 / بوليصة رقم"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <OperatorSelect
                value={operator}
                onChange={setOperator}
                label="المشرف / المسؤول عن الإرسال *"
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل خاصة بحالة الشنطة أو اتفاق الصيانة..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={busy || products.length === 0}
                className={`w-full py-3 rounded-2xl font-black text-xs transition shadow-md disabled:opacity-50 ${
                  repairType === "INTERNAL"
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                    : "bg-violet-600 hover:bg-violet-500 text-white"
                }`}
              >
                {repairType === "INTERNAL" ? "دخول الورشة الداخلية" : "تسجيل الإرسال للمصنع واعتماد الأمر"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Escalate to Factory Modal */}
      {escalateFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-violet-600 text-white font-black text-sm flex justify-between items-center">
              <span>تحويل {escalateFor.repair_id} للمصنع</span>
              <button onClick={() => setEscalateFor(null)}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                {escalateFor.sku} × {escalateFor.qty} — {escalateFor.defect_reason}
              </p>
              <OperatorSelect
                value={operator}
                onChange={setOperator}
                label="المسؤول عن التحويل *"
              />
              <input
                list="factories-list"
                value={factoryName}
                onChange={(e) => setFactoryName(e.target.value)}
                placeholder="اسم المصنع *"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
              />
              <input
                value={factoryRef}
                onChange={(e) => setFactoryRef(e.target.value)}
                placeholder="رقم الإرسالية / RMA (اختياري)"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
              />
              <button
                disabled={busy || !factoryName.trim()}
                onClick={async () => {
                  if (
                    await post({
                      action: "ESCALATE_TO_FACTORY",
                      repair_id: escalateFor.repair_id,
                      factory_name: factoryName,
                      factory_ref: factoryRef,
                    })
                  )
                    setEscalateFor(null);
                }}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition"
              >
                تأكيد التحويل للمصنع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Factory Return Modal */}
      {returnFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-violet-600 text-white font-black text-sm flex justify-between items-center">
              <span>استلام من {returnFor.factory_name} — {returnFor.repair_id}</span>
              <button onClick={() => setReturnFor(null)}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                {returnFor.sku} — عند المصنع حالياً: <strong className="text-violet-900 font-black">{returnFor.qty}</strong> قطعة
              </p>

              <OperatorSelect
                value={operator}
                onChange={setOperator}
                label="الموظف المستلم من المصنع *"
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">ما هي نتيجة فحص واستلام المصنع؟</label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["REPAIRED", "رجعت متصلحة", "← رصيد البيع السليم"],
                      ["REPLACED", "بدّلها بجديدة", "← رصيد البيع السليم"],
                      ["CREDIT", "عوّض بفلوس/خصم", "خصم من الحساب"],
                      ["REJECTED", "المصنع رفض الضمان", "← ترجع تالف بالمخزن"],
                    ] as const
                  ).map(([k, t, s]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setReturnOutcome(k)}
                      className={`p-2.5 rounded-xl border-2 text-right transition ${
                        returnOutcome === k
                          ? "border-violet-600 bg-violet-50 font-bold"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{t}</div>
                      <div className="text-[10px] text-slate-500">{s}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الكمية المستلمة (إذا كان استلاماً جزئياً، الباقي يظل عند المصنع)
                </label>
                <input
                  type="number"
                  min={1}
                  max={returnFor.qty}
                  value={returnQty}
                  onChange={(e) =>
                    setReturnQty(Math.min(returnFor.qty, Math.max(1, Number(e.target.value))))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  returnOutcome === "CREDIT"
                    ? "قيمة التعويض المالي / رقم إشعار الخصم"
                    : "ملاحظات الاستلام..."
                }
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />

              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await post({
                      action: "FACTORY_RETURN",
                      repair_id: returnFor.repair_id,
                      qty: returnQty,
                      outcome: returnOutcome,
                      notes,
                    })
                  )
                    setReturnFor(null);
                }}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black text-xs disabled:opacity-50 transition shadow-md"
              >
                تأكيد الاستلام وتحديث الرصيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
