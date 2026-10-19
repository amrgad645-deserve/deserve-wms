"use client";

import { useState, useEffect } from "react";
import { RotateCcw, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import OperatorSelect from "@/components/OperatorSelect";

interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  good_stock: number;
}

export default function ReturnsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [origOrder, setOrigOrder] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [condition, setCondition] = useState<"GOOD" | "DEFECTIVE">("GOOD");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.products);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!sku) {
      setStatusMessage({ type: "error", text: "يرجى اختيار الصنف المرتجع" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origOrder,
          sku,
          qty,
          condition,
          operator,
          notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        setOrigOrder("");
        setSku("");
        setQty(1);
        setNotes("");
      } else {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: "حدث خطأ أثناء معالجة المرتجع" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <RotateCcw className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">شاشة استلام المرتجعات (Customer Returns)</h1>
          <p className="text-slate-500 text-xs">فرز وفحص شحنات العملاء المرتجعة وتوجيهها للمخزون السليم أو الحجر</p>
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

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الأوردر الأصلي (Original Order #)</label>
            <input
              type="text"
              placeholder="مثال: 1042 أو بوليصة المرتجع"
              value={origOrder}
              onChange={(e) => setOrigOrder(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label="الموظف الفاحص *"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">الصنف المرتجع (Returned SKU) *</label>
          <select
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">-- اختر الصنف من القائمة --</option>
            {products.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} | {p.model} - {p.color} ({p.size})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية المرتجعة *</label>
            <input
              type="number"
              min="1"
              required
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
            />
          </div>

          {/* Condition Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة فحص القطعة (Condition) *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCondition("GOOD")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  condition === "GOOD"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>سليم (صالح للبيع)</span>
              </button>

              <button
                type="button"
                onClick={() => setCondition("DEFECTIVE")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  condition === "DEFECTIVE"
                    ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>معيب / تالف (للحجر)</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإرجاع أو ملاحظات الفحص</label>
          <input
            type="text"
            placeholder="مثال: تبديل مقاس، خطأ في اللون، كسر مقبض..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-base shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RotateCcw className="w-5 h-5" />
          <span>{submitting ? "جاري المعالجة..." : "تسجيل المرتجع (PROCESS RETURN)"}</span>
        </button>
      </form>
    </div>
  );
}