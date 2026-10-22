"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, ShieldAlert, Camera, Wrench, ArrowLeft } from "lucide-react";
import Link from "next/link";
import OperatorSelect from "@/components/OperatorSelect";
import CameraScannerModal from "@/components/CameraScannerModal";

interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  barcode?: string;
  good_stock: number;
  defective_stock: number;
}

export default function DefectivePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("كسر في اليد أو المقبض");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastSentData, setLastSentData] = useState<{ sku: string; reason: string } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.products);
      });
  }, []);

  const selectedProduct = products.find((p) => p.sku === sku);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!sku) {
      setStatusMessage({ type: "error", text: "يرجى اختيار الصنف المعيب" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/defective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          qty,
          reason,
          operator,
          notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        setLastSentData({ sku, reason });
        setSku("");
        setQty(1);
        setNotes("");
        // Refresh products
        const pRes = await fetch("/api/products");
        const pData = await pRes.json();
        if (pData.success) setProducts(pData.products);
      } else {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: "حدث خطأ أثناء نقل القطعة للتالف" });
    } finally {
      setSubmitting(false);
    }
  };

  const defectReasons = [
    "كسر في اليد أو المقبض (Handle Damage)",
    "كسر في العجل (Broken Wheel)",
    "سحاب مقطوع أو تالف (Defective Zipper)",
    "خدش أو كشط عميق (Deep Scratch / Scuff)",
    "شرخ أو كسر في جسم الشنطة (Cracked Shell)",
    "عيب صناعة مصنعي (Factory Defect)",
    "كرتونة أو تغليف متهالك (Damaged Box)",
    "أخرى (Other)"
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">عزل التالف والمعيب الداخلي (Quarantine Desk)</h1>
          <p className="text-slate-500 text-xs">إبلاغ وعزل أي قطعة بها كسر أو عيب تصنيع أثناء التحضير ومنع بيعها</p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span className="font-bold">{statusMessage.text}</span>
          </div>

          {statusMessage.type === "success" && lastSentData && (
            <div className="mt-3 pt-3 border-t border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-emerald-950 font-bold">
                💡 هل تريد فتح أمر صيانة أو إرسال هذه القطعة للمصنع الآن؟
              </span>
              <Link
                href={`/workshop?sku=${encodeURIComponent(lastSentData.sku)}&reason=${encodeURIComponent(lastSentData.reason)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md transition"
              >
                <Wrench className="w-4 h-4" />
                <span>إرسال للورشة أو المصنع الآن</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">الصنف المعيب *</label>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>مسح باركود الشنطة بالكاميرا</span>
            </button>
          </div>
          <select
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="">-- اختر الصنف المعيب --</option>
            {products.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} | {p.model} - {p.color} ({p.size}) [المتاح سليم: {p.good_stock}]
              </option>
            ))}
          </select>
          {selectedProduct && (
            <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-2">
              <span>الرصيد السليم الحالي: <strong className="text-slate-900">{selectedProduct.good_stock}</strong> قطعة</span>
              <span>•</span>
              <span>الرصيد التالف المحجوز سابقاً: <strong className="text-amber-600">{selectedProduct.defective_stock}</strong> قطعة</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية المعيبة *</label>
            <input
              type="number"
              min="1"
              max={selectedProduct?.good_stock || undefined}
              required
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب العيب والتلف (Defect Reason) *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {defectReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label="الموظف القائم بالعزل *"
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">مكان الحجر أو الرف (Quarantine Location)</label>
            <input
              type="text"
              placeholder="مثال: رف التالف A1 أو قفص الهالك"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <AlertTriangle className="w-5 h-5" />
          <span>{submitting ? "جاري النقل للحجر..." : "عزل ونقل القطع للتالف (TRANSFER TO QUARANTINE)"}</span>
        </button>
      </form>

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(scanned) => {
          const clean = scanned.trim().toUpperCase();
          const match = products.find((p) => p.sku.toUpperCase() === clean || (p.barcode && p.barcode.toUpperCase() === clean));
          if (match) {
            setSku(match.sku);
            setIsCameraOpen(false);
          } else {
            alert(`لم يتم العثور على صنف بالباركود: ${scanned}`);
          }
        }}
        title="مسح باركود الشنطة المعيبة"
      />
    </div>
  );
}