"use client";

import { useState, useEffect } from "react";
import { Truck, Plus, Trash2, CheckCircle2, AlertCircle, Scan, ArrowRight, Camera } from "lucide-react";
import Link from "next/link";
import CameraScannerModal from "@/components/CameraScannerModal";
import OperatorSelect from "@/components/OperatorSelect";

interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  barcode: string;
  good_stock: number;
}

interface DispatchLine {
  id: string;
  sku: string;
  qty: number;
  selectedProduct?: Product;
}

export default function DispatchPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderNum, setOrderNum] = useState("");
  const [courier, setCourier] = useState("Bosta");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DispatchLine[]>([
    { id: "1", sku: "", qty: 1 }
  ]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.products);
      });
  }, []);

  const processScanned = (scannedRaw: string) => {
    if (!scannedRaw.trim()) return;

    const scanned = scannedRaw.trim().toUpperCase();
    const match = products.find(
      (p) => p.barcode?.toUpperCase() === scanned || p.sku.toUpperCase() === scanned
    );

    if (match) {
      const existing = lines.find((l) => l.sku === match.sku);
      if (existing) {
        setLines(
          lines.map((l) =>
            l.sku === match.sku ? { ...l, qty: l.qty + 1 } : l
          )
        );
      } else {
        if (lines.length === 1 && !lines[0].sku) {
          setLines([{ id: "1", sku: match.sku, qty: 1, selectedProduct: match }]);
        } else {
          setLines([
            ...lines,
            { id: Date.now().toString(), sku: match.sku, qty: 1, selectedProduct: match }
          ]);
        }
      }
      setBarcodeInput("");
      setStatusMessage({ type: "success", text: `تم مسح وإضافة: ${match.model} ${match.color} (${match.sku})` });
    } else {
      setStatusMessage({ type: "error", text: `لم يتم العثور على صنف بالباركود / SKU: ${scanned}` });
    }
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    processScanned(barcodeInput);
  };

  const handleSkuChange = (id: string, sku: string) => {
    const prod = products.find((p) => p.sku === sku);
    setLines(
      lines.map((l) =>
        l.id === id ? { ...l, sku, selectedProduct: prod } : l
      )
    );
  };

  const handleQtyChange = (id: string, qty: number) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, qty } : l)));
  };

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), sku: "", qty: 1 }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      setLines([{ id: "1", sku: "", qty: 1 }]);
    } else {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validLines = lines.filter((l) => l.sku && l.qty > 0);
    if (!orderNum.trim()) {
      setStatusMessage({ type: "error", text: "يرجى كتابة رقم الأوردر أو البوليصة" });
      return;
    }
    if (validLines.length === 0) {
      setStatusMessage({ type: "error", text: "يرجى اختيار صنف واحد على الأقل" });
      return;
    }

    // Pre-check stock
    for (const line of validLines) {
      const prod = products.find((p) => p.sku === line.sku);
      if (!prod) {
        setStatusMessage({ type: "error", text: `الصنف ${line.sku} غير مسجل` });
        return;
      }
      if (prod.good_stock < line.qty) {
        setStatusMessage({
          type: "error",
          text: `رصيد غير كافٍ للصنف ${prod.model} ${prod.color} (${prod.sku})! المتاح: ${prod.good_stock}، المطلوب: ${line.qty}`
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNum,
          courier,
          operator,
          notes,
          items: validLines.map((l) => ({ sku: l.sku, qty: l.qty }))
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        setOrderNum("");
        setNotes("");
        setLines([{ id: "1", sku: "", qty: 1 }]);
        // Refresh products list
        const pRes = await fetch("/api/products");
        const pData = await pRes.json();
        if (pData.success) setProducts(pData.products);
      } else {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "حدث خطأ أثناء تنفيذ عملية الصرف" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">شاشة صرف وشحن الأوردرات (Dispatch Desk)</h1>
            <p className="text-slate-500 text-xs">صرف الشحنات وخروج البضاعة مع فحص فوري وخصم تلقائي من المخزون</p>
          </div>
        </div>

        <Link
          href="/stock"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition"
        >
          فحص المخزون
        </Link>
      </div>

      {/* Barcode Quick Scanner Form */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-4 text-white shadow-md">
        <form onSubmit={handleBarcodeScan} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Scan className="w-5 h-5 text-blue-300" />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="امسح الباركود بسكانر المخزن أو اكتب SKU واضغط Enter..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="px-3.5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1.5"
            title="مسح بكاميرا الموبايل"
          >
            <Camera className="w-4 h-4 text-blue-300" />
            <span className="hidden sm:inline">كاميرا الموبايل</span>
          </button>
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-sm rounded-xl transition shrink-0"
          >
            إضافة سريعة
          </button>
        </form>
      </div>

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(scanned) => processScanned(scanned)}
        title="مسح باركود الصنف بكاميرا الهاتف"
      />

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Dispatch Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Order Meta Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رقم الأوردر أو البوليصة (Order # / Tracking) *
            </label>
            <input
              type="text"
              required
              placeholder="مثال: 1052 أو BST-9921"
              value={orderNum}
              onChange={(e) => setOrderNum(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">شركة الشحن (Courier)</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900 bg-white"
            >
              <option value="Bosta">بوسطة (Bosta)</option>
              <option value="Mylerz">مايلرز (Mylerz)</option>
              <option value="J&T Express">J&T Express</option>
              <option value="Aramex">أرامكس (Aramex)</option>
              <option value="Customer Pickup">استلام من المخزن</option>
              <option value="Other">شركة أخرى</option>
            </select>
          </div>

          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label="الموظف المسؤول (Operator) *"
          />
        </div>

        {/* Item Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800">الأصناف المراد صرفها (Order Items)</h3>
            <span className="text-xs text-slate-400">إجمالي البنود: {lines.length}</span>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const prod = products.find((p) => p.sku === line.sku);
              const available = prod?.good_stock ?? 0;
              const hasEnoughStock = available >= line.qty;

              return (
                <div
                  key={line.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-3 transition"
                >
                  <div className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</div>

                  {/* SKU / Product Selector */}
                  <div className="flex-1">
                    <select
                      value={line.sku}
                      onChange={(e) => handleSkuChange(line.id, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- اختر كود الصنف أو ابحث بالاسم --</option>
                      {products.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} | {p.model} - {p.color} ({p.size}) [المتاح: {p.good_stock}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stock Available Badge */}
                  <div className="shrink-0 w-32 text-center">
                    {line.sku ? (
                      <span
                        className={`inline-block w-full px-2 py-1.5 rounded-md text-xs font-bold ${
                          available === 0
                            ? "bg-rose-100 text-rose-700"
                            : available <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        المتاح: {available} قطعة
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>

                  {/* Qty Input */}
                  <div className="w-24 shrink-0">
                    <input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 1)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-center text-sm font-extrabold focus:outline-none ${
                        line.sku && !hasEnoughStock
                          ? "border-rose-500 text-rose-600 bg-rose-50"
                          : "border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                      }`}
                    />
                  </div>

                  {/* Remove button */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة بند صنف آخر</span>
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الشحن (اختياري)</label>
          <input
            type="text"
            placeholder="ملاحظات إضافية على الأوردر..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Truck className="w-5 h-5" />
          <span>{submitting ? "جاري الصرف والخصم..." : "تأكيد وصرف الأوردر (DISPATCH ORDER)"}</span>
        </button>
      </form>
    </div>
  );
}