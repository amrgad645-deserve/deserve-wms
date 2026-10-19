"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck, CheckCircle2, AlertCircle, Save, Filter, Search, Camera, Layers, Package, Shield } from "lucide-react";
import Link from "next/link";
import CameraScannerModal from "@/components/CameraScannerModal";
import OperatorSelect from "@/components/OperatorSelect";

interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  good_stock: number;
  defective_stock: number;
}

export default function AuditPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<{ [sku: string]: { good: number; def: number } }>({});
  const [operator, setOperator] = useState("لجنة الجرد الفعلي");
  const [notes, setNotes] = useState("الجرد الفعلي الافتتاحي للمخزن");
  const [search, setSearch] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "SETS" | "SINGLES" | "COVERS">("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProducts(d.products);
          const initial: any = {};
          d.products.forEach((p: Product) => {
            initial[p.sku] = { good: p.good_stock, def: p.defective_stock };
          });
          setCounts(initial);
        }
      });
  }, []);

  const handleGoodChange = (sku: string, val: number) => {
    setCounts({
      ...counts,
      [sku]: {
        ...counts[sku],
        good: Math.max(0, val)
      }
    });
  };

  const handleDefChange = (sku: string, val: number) => {
    setCounts({
      ...counts,
      [sku]: {
        ...counts[sku],
        def: Math.max(0, val)
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const payload = Object.keys(counts).map((sku) => ({
      sku,
      goodStock: counts[sku].good,
      defectiveStock: counts[sku].def
    }));

    try {
      setSubmitting(true);
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counts: payload,
          operator,
          notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
      } else {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: "حدث خطأ أثناء حفظ الجرد" });
    } finally {
      setSubmitting(false);
    }
  };

  const isSet = (p: Product) =>
    p.sku.endsWith("-SET") ||
    p.size.toUpperCase().includes("SET") ||
    p.model.toUpperCase().includes("SET");

  const isCover = (p: Product) => p.model.toUpperCase().includes("COVER");

  // Arabic keyword mapping for smart search
  const clean = search.trim().toLowerCase();
  const searchForSets = ["طقم", "اطقم", "أطقم", "مجموعة", "مجموعه", "set", "sets"].some((k) => clean.includes(k));

  const filtered = products.filter((p) => {
    // 1. Tab filter
    if (activeTab === "SETS" && !isSet(p)) return false;
    if (activeTab === "SINGLES" && (isSet(p) || isCover(p))) return false;
    if (activeTab === "COVERS" && !isCover(p)) return false;

    // 2. Model filter
    if (selectedModel) {
      if (selectedModel === "ALL_SETS") {
        if (!isSet(p)) return false;
      } else if (p.model !== selectedModel) {
        return false;
      }
    }

    // 3. Search query
    if (!clean) return true;

    if (searchForSets && isSet(p)) return true;

    const skuMatch = p.sku.toLowerCase().includes(clean);
    const modelMatch = p.model.toLowerCase().includes(clean);
    const colorMatch = p.color.toLowerCase().includes(clean);
    const sizeMatch = p.size.toLowerCase().includes(clean);

    // Color synonyms in Arabic
    const colorArabicMap: Record<string, string[]> = {
      black: ["اسود", "أسود", "بلاك"],
      beige: ["بيج"],
      navy: ["كحلي", "كحلى", "ازرق داكن"],
      "olive green": ["زيتي", "زيتى", "اخضر"],
      pink: ["وردي", "وردى", "بينك", "زهري"],
      "dark mauve": ["موف", "موف غامق", "بنفسجي"],
      lemon: ["ليموني", "اصفر", "أصفر"],
      silver: ["فضي", "فضى", "سيلفر", "رمادي"],
      turquoise: ["تركواز", "فيروزي"],
      orange: ["برتقالي", "اورنج"],
      "rose gold": ["روز", "روز جولد"],
      "denim blue": ["جينز", "دينم", "ازرق"],
      purple: ["بيربل", "بنفسجي", "موف"],
    };

    let arabicColorMatch = false;
    for (const [engColor, arList] of Object.entries(colorArabicMap)) {
      if (arList.some((ar) => clean.includes(ar)) && p.color.toLowerCase().includes(engColor)) {
        arabicColorMatch = true;
        break;
      }
    }

    return skuMatch || modelMatch || colorMatch || sizeMatch || arabicColorMatch;
  });

  const totalCountedSingles = Object.keys(counts).reduce((acc, sku) => {
    const prod = products.find((p) => p.sku === sku);
    if (prod && !isSet(prod)) {
      return acc + (counts[sku]?.good || 0) + (counts[sku]?.def || 0);
    }
    return acc;
  }, 0);

  const totalCountedSets = Object.keys(counts).reduce((acc, sku) => {
    const prod = products.find((p) => p.sku === sku);
    if (prod && isSet(prod)) {
      return acc + (counts[sku]?.good || 0) + (counts[sku]?.def || 0);
    }
    return acc;
  }, 0);

  const totalCountedGood = Object.values(counts).reduce((acc, c) => acc + (c.good || 0), 0);
  const totalCountedDef = Object.values(counts).reduce((acc, c) => acc + (c.def || 0), 0);
  const totalSetsCount = products.filter((p) => isSet(p)).length;
  const totalSinglesCount = products.filter((p) => !isSet(p) && !isCover(p)).length;
  const totalCoversCount = products.filter((p) => isCover(p)).length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">شاشة الجرد الفعلي الافتتاحي (Physical Stock Audit)</h1>
            <p className="text-slate-400 text-xs">
              أدخل الأعداد الفعلية الموجودة على رفوف المخزن لكل صنف لاعتماد الأرصدة الافتتاحية (شنط فردية + أطقم كاملة)
            </p>
          </div>
        </div>

        {/* Breakdown chips */}
        <div className="flex items-center gap-2">
          <div className="bg-purple-500/20 px-3.5 py-2 rounded-xl border border-purple-500/30 text-center">
            <div className="text-[10px] text-purple-300 font-bold">الأطقم الكاملة (SET)</div>
            <div className="text-lg font-black text-purple-200">{totalCountedSets} طقم</div>
          </div>
          <div className="bg-blue-500/20 px-3.5 py-2 rounded-xl border border-blue-500/30 text-center">
            <div className="text-[10px] text-blue-300 font-bold">الشنط الفردية</div>
            <div className="text-lg font-black text-blue-200">{totalCountedSingles} قطعة</div>
          </div>
          <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/20 text-center">
            <div className="text-[10px] text-amber-300 font-bold">إجمالي المدخل</div>
            <div className="text-lg font-black text-white">{totalCountedGood + totalCountedDef}</div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Meta details */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label="الموظف / القائم بالجرد *"
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الجرد</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 font-black"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>جميع الأصناف ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SETS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "SETS"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-black"
                : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>الأطقم الكاملة فقط ({totalSetsCount} طقم) 📦</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SINGLES")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "SINGLES"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black"
                : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>الشنط الفردية ({totalSinglesCount}) 🧳</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("COVERS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "COVERS"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>الكفرات والحماية ({totalCoversCount})</span>
          </button>
        </div>

        {/* Search & Model Filter */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="ابحث بكلمة طقم، أو كود الصنف، أو الموديل، أو اللون (أسود، بيج، كحلي...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="مسح الصنف بكاميرا الهاتف"
            >
              <Camera className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">كاميرا</span>
            </button>
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
          >
            <option value="">جميع الموديلات والأطقم</option>
            <option value="ALL_SETS" className="font-bold text-purple-700">📦 جميع الأطقم الكاملة (17 طقم)</option>
            <option value="ELITE">موديل ELITE (شنط فردية)</option>
            <option value="ELITE SET">موديل ELITE SET (أطقم 3 قطع)</option>
            <option value="FLOW">موديل FLOW (شنط فردية)</option>
            <option value="FLOW SET">موديل FLOW SET (أطقم 3 قطع)</option>
            <option value="TITAN">موديل TITAN (شنط فردية)</option>
            <option value="TITAN SET">موديل TITAN SET (أطقم 3 قطع)</option>
            <option value="LUGGAGE COVER">كفرات الشنط والحماية</option>
          </select>
        </div>

        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(scanned) => {
            const match = products.find(
              (p) => p.sku.toUpperCase() === scanned.toUpperCase() || p.sku.includes(scanned)
            );
            setSearch(match ? match.sku : scanned);
          }}
          title="مسح باركود الصنف أثناء الجرد الفعلي"
        />

        {/* Audit Count Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">كود الصنف (SKU)</th>
                  <th className="py-3 px-4">الموديل واللون والمقاس</th>
                  <th className="py-3 px-4 text-center bg-slate-800 text-emerald-400 w-36">
                    العدد الفعلي السليم (Good)
                  </th>
                  <th className="py-3 px-4 text-center bg-slate-800 text-amber-400 w-36">
                    العدد الفعلي التالف (Defective)
                  </th>
                  <th className="py-3 px-4 text-center w-28">إجمالي القطع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const current = counts[p.sku] || { good: 0, def: 0 };
                  const lineTotal = (current.good || 0) + (current.def || 0);
                  const isSetItem = isSet(p);

                  return (
                    <tr
                      key={p.sku}
                      className={`transition ${
                        isSetItem
                          ? "hover:bg-purple-50/50 bg-purple-50/20 border-r-4 border-r-purple-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{p.sku}</span>
                          {isSetItem && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black">
                              طقم SET
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-700">
                        {isSetItem ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-purple-900">{p.model}</span>
                            <span>-</span>
                            <span className="font-bold text-slate-800">{p.color}</span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black">
                              طقم 3 قطع (21 + 25 + 29)
                            </span>
                          </div>
                        ) : (
                          <span>
                            {p.model} - {p.color} ({p.size})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center bg-emerald-50/20">
                        <input
                          type="number"
                          min="0"
                          value={current.good}
                          onChange={(e) => handleGoodChange(p.sku, parseInt(e.target.value) || 0)}
                          placeholder={isSetItem ? "عدد الأطقم" : "سليم"}
                          className={`w-24 rounded-lg py-1.5 px-2 text-center text-sm font-black focus:outline-none focus:ring-2 bg-white ${
                            isSetItem
                              ? "border-2 border-purple-400 text-purple-950 focus:ring-purple-500 shadow-sm"
                              : "border border-emerald-300 text-emerald-700 focus:ring-emerald-500"
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center bg-amber-50/20">
                        <input
                          type="number"
                          min="0"
                          value={current.def}
                          onChange={(e) => handleDefChange(p.sku, parseInt(e.target.value) || 0)}
                          placeholder={isSetItem ? "أطقم تالفة" : "تالف"}
                          className="w-24 border border-amber-300 rounded-lg py-1.5 px-2 text-center text-sm font-black text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </td>
                      <td className={`py-2.5 px-4 text-center font-black ${isSetItem ? "text-purple-950" : "text-slate-900"}`}>
                        {lineTotal} {isSetItem ? "طقم" : "قطعة"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{submitting ? "جاري حفظ وتثبيت الجرد..." : "اعتماد وتثبيت الجرد الفعلي للمخزن (SAVE & COMMIT AUDIT)"}</span>
        </button>
      </form>
    </div>
  );
}