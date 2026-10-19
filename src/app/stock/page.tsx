"use client";

import { useState, useEffect } from "react";
import { Package, Search, Download, Filter, RefreshCw, CheckCircle2, Tag, MapPin, Check, Edit, X, AlertCircle, Layers, Shield } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Product } from "@/lib/types";
import OperatorSelect from "@/components/OperatorSelect";

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | "sets" | "singles" | "covers">("");
  const [loading, setLoading] = useState(true);
  const [editingBinSku, setEditingBinSku] = useState<string | null>(null);
  const [binInput, setBinInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Manual Stock Adjustment Modal State
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustGood, setAdjustGood] = useState<number>(0);
  const [adjustDef, setAdjustDef] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("تصحيح خطأ جرد");
  const [adjustOperator, setAdjustOperator] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedModel) params.set("model", selectedModel);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedModel, statusFilter, categoryFilter]);

  const handleSaveBinLocation = async (sku: string) => {
    try {
      const res = await fetch("/api/products/bin-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, bin_location: binInput }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(data.message);
        setEditingBinSku(null);
        setTimeout(() => setStatusMsg(null), 3000);
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdjust = (p: Product) => {
    setAdjustProduct(p);
    setAdjustGood(p.good_stock);
    setAdjustDef(p.defective_stock);
    setAdjustReason("تصحيح خطأ جرد");
    setAdjustError(null);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;

    try {
      setAdjustLoading(true);
      setAdjustError(null);
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: adjustProduct.sku,
          goodStock: adjustGood,
          defectiveStock: adjustDef,
          operator: adjustOperator,
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg(data.message);
      setAdjustProduct(null);
      setTimeout(() => setStatusMsg(null), 4000);
      fetchProducts();
    } catch (err: any) {
      setAdjustError(err.message || "حدث خطأ أثناء حفظ التعديل");
    } finally {
      setAdjustLoading(false);
    }
  };

  const exportToExcel = () => {
    const exportData = products.map((p) => {
      const isSet = p.sku.endsWith("-SET") || p.size.toUpperCase().includes("SET");
      return {
        "كود الصنف (SKU)": p.sku,
        "نوع الصنف": isSet ? "طقم كامل (3 قطع)" : p.model.includes("COVER") ? "كفر حماية" : "شنطة فردية",
        "الموديل (Model)": p.model,
        "اللون (Color)": p.color,
        "المقاس (Size)": p.size,
        "الباركود (Barcode)": p.barcode,
        "مكان الرف (Bin Location)": p.bin_location || "UNASSIGNED",
        "المتاح للبيع السليم (Good Stock)": p.good_stock,
        "المعزول التالف (Defective Stock)": p.defective_stock,
        "إجمالي القطع الفعلي": p.good_stock + p.defective_stock,
        "الوحدة": isSet ? "طقم" : "قطعة",
        "حالة المخزون": p.good_stock === 0 ? "نفد" : p.good_stock <= 3 ? "منخفض" : "متوفر",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DESERVE_Stock");
    XLSX.writeFile(wb, `DESERVE_Stock_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const models = Array.from(new Set(products.map((p) => p.model)));
  const totalGood = products.reduce((acc, p) => acc + p.good_stock, 0);
  const totalDef = products.reduce((acc, p) => acc + p.defective_stock, 0);
  const setsGood = products.filter((p) => p.sku.endsWith("-SET")).reduce((acc, p) => acc + p.good_stock, 0);
  const singlesGood = products.filter((p) => !p.sku.endsWith("-SET") && !p.model.includes("COVER")).reduce((acc, p) => acc + p.good_stock, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">كتالوج وأرصدة المخزون اللحظية (DESERVE Catalog)</h1>
            <p className="text-slate-400 text-xs">
              عرض تفصيلي لأرصدة الـ 118 صنفاً (شنط فردية + أطقم كاملة)، إدارة أماكن الأرفف (Bin Locations)، وتصدير الإكسيل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>تصدير إكسيل (Excel)</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            categoryFilter === ""
              ? "bg-slate-900 text-white shadow-md font-black"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>جميع الأصناف ({products.length})</span>
        </button>

        <button
          onClick={() => setCategoryFilter("sets")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            categoryFilter === "sets"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-black"
              : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>الأطقم الكاملة فقط (17 طقم) 📦</span>
        </button>

        <button
          onClick={() => setCategoryFilter("singles")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            categoryFilter === "singles"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black"
              : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>الشنط الفردية (21، 25، 29) 🧳</span>
        </button>

        <button
          onClick={() => setCategoryFilter("covers")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            categoryFilter === "covers"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>الكفرات والحماية</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="ابحث بكلمة طقم، أو كود الصنف، أو المقاس، أو اللون (أسود، بيج، كحلي...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">جميع الموديلات والأطقم</option>
            <option value="ALL_SETS" className="font-bold text-purple-700">📦 جميع الأطقم الكاملة (17 طقم)</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">جميع الحالات</option>
            <option value="healthy">متوفر (&gt; 3 قطع)</option>
            <option value="low">نواقص (1-3 قطع)</option>
            <option value="out">نفد من المخزن (0)</option>
            <option value="defective">يوجد به تالف</option>
          </select>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
        <span>الأصناف المعروضة: <strong className="text-slate-900">{products.length}</strong> SKU</span>
        <span>•</span>
        <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
          الأطقم الكاملة المتاحة: <strong className="text-purple-950 font-black">{setsGood}</strong> طقم
        </span>
        <span>•</span>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
          الشنط الفردية المتاحة: <strong className="text-emerald-950 font-black">{singlesGood}</strong> قطعة
        </span>
        <span>•</span>
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          إجمالي التالف: <strong className="text-amber-950 font-black">{totalDef}</strong> قطعة
        </span>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="py-3 px-4">كود الصنف (SKU)</th>
                <th className="py-3 px-4">الموديل (Model)</th>
                <th className="py-3 px-4">اللون (Color)</th>
                <th className="py-3 px-4">المقاس (Size)</th>
                <th className="py-3 px-4">الباركود (Barcode)</th>
                <th className="py-3 px-4 text-center">مكان الرف (Bin)</th>
                <th className="py-3 px-4 text-center bg-slate-800 text-emerald-400">المتاح للبيع (Good)</th>
                <th className="py-3 px-4 text-center bg-slate-800 text-amber-400">التالف (Defective)</th>
                <th className="py-3 px-4 text-center">الإجمالي</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    لا توجد أصناف مطابقة للبحث
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const total = p.good_stock + p.defective_stock;
                  const isEditingBin = editingBinSku === p.sku;
                  const isSet =
                    p.sku.endsWith("-SET") ||
                    p.size.toUpperCase().includes("SET") ||
                    p.model.toUpperCase().includes("SET");

                  return (
                    <tr
                      key={p.sku}
                      className={`transition ${
                        isSet
                          ? "hover:bg-purple-50/50 bg-purple-50/20 border-r-4 border-r-purple-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{p.sku}</span>
                          {isSet && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black">
                              طقم SET
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {isSet ? (
                          <span className="text-purple-950 font-extrabold">{p.model}</span>
                        ) : (
                          p.model
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{p.color}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {isSet ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black">
                            طقم كامل 3 قطع (21 + 25 + 29)
                          </span>
                        ) : (
                          p.size
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{p.barcode || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        {isEditingBin ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={binInput}
                              onChange={(e) => setBinInput(e.target.value.toUpperCase())}
                              placeholder="A-01"
                              className="w-16 px-1.5 py-0.5 text-center font-mono font-bold border border-blue-400 rounded focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveBinLocation(p.sku)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingBinSku(null)}
                              className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingBinSku(p.sku);
                              setBinInput(p.bin_location === "UNASSIGNED" ? "" : p.bin_location || "");
                            }}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 transition"
                            title="اضغط لتعديل مكان الرف"
                          >
                            <MapPin className="w-2.5 h-2.5 text-blue-500" />
                            <span>{p.bin_location || "تحديد"}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-sm bg-emerald-50/40 text-emerald-700">
                        {p.good_stock}{" "}
                        {isSet && <span className="text-[10px] font-bold text-emerald-600">طقم</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-sm bg-amber-50/40 text-amber-700">
                        {p.defective_stock}{" "}
                        {isSet && <span className="text-[10px] font-bold text-amber-600">طقم</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {total}{" "}
                        {isSet && <span className="text-[10px] font-bold text-slate-600">طقم</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[10px] transition"
                            title="تعديل رصيد الصنف مانيوال"
                          >
                            <Edit className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                          <Link
                            href={`/labels`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-lg font-bold text-[10px] transition"
                          >
                            <Tag className="w-3 h-3" />
                            <span>استيكر</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-xs">تسوية وتعديل رصيد المخزون يدوياً</h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustProduct(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-5 space-y-4">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              {/* Product Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="font-mono font-bold text-slate-900">{adjustProduct.sku}</div>
                <div className="text-slate-600">
                  {adjustProduct.model} — {adjustProduct.color} ({adjustProduct.size})
                </div>
                <div className="text-[11px] text-slate-500 pt-1 flex gap-4">
                  <span>الرصيد السليم الحالي: <strong className="text-emerald-700 font-bold">{adjustProduct.good_stock}</strong></span>
                  <span>الرصيد التالف الحالي: <strong className="text-amber-700 font-bold">{adjustProduct.defective_stock}</strong></span>
                </div>
              </div>

              {/* New Good & Defective Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    الرصيد السليم الجديد *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={adjustGood}
                    onChange={(e) => setAdjustGood(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border-2 border-emerald-300 rounded-xl px-3 py-2 text-sm font-black text-emerald-900 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    الرصيد التالف الجديد *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={adjustDef}
                    onChange={(e) => setAdjustDef(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border-2 border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-amber-900 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب التسوية / التعديل *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="تصحيح خطأ جرد">تصحيح خطأ جرد</option>
                  <option value="عثور على قطع إضافية بالمخزن">عثور على قطع إضافية بالمخزن (+ زيادة)</option>
                  <option value="عجز أو فقدان أثناء المناولة">عجز أو فقدان أثناء المناولة (- نقص)</option>
                  <option value="تلف قطعة أثناء النقل">تلف قطعة أثناء النقل (تحويل لتالف)</option>
                  <option value="تسوية جردية معتمدة">تسوية جردية معتمدة من الإدارة</option>
                  <option value="تعديل يدوي آخر">تعديل يدوي آخر</option>
                </select>
              </div>

              {/* Operator */}
              <OperatorSelect
                value={adjustOperator}
                onChange={setAdjustOperator}
                label="الموظف المسؤول عن التعديل *"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md transition disabled:opacity-50"
                >
                  {adjustLoading ? "جاري الحفظ..." : "حفظ التسوية وتحديث الرصيد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}