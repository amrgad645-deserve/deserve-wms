"use client";

import { useState, useEffect } from "react";
import { Inbox, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import OperatorSelect from "@/components/OperatorSelect";

interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  good_stock: number;
}

export default function ReceivePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [poNum, setPoNum] = useState("");
  const [supplier, setSupplier] = useState("المصنع الرئيسي");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ id: string; sku: string; qty: number }[]>([
    { id: "1", sku: "", qty: 10 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.products);
      });
  }, []);

  const addLine = () => setLines([...lines, { id: Date.now().toString(), sku: "", qty: 10 }]);
  const removeLine = (id: string) => {
    if (lines.length === 1) setLines([{ id: "1", sku: "", qty: 10 }]);
    else setLines(lines.filter((l) => l.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validLines = lines.filter((l) => l.sku && l.qty > 0);
    if (!poNum.trim()) {
      setStatusMessage({ type: "error", text: "يرجى إدخال رقم إذن الاستلام أو الفاتورة" });
      return;
    }
    if (validLines.length === 0) {
      setStatusMessage({ type: "error", text: "يرجى اختيار صنف واحد على الأقل" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNum,
          supplier,
          operator,
          notes,
          items: validLines
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: data.message });
        setPoNum("");
        setNotes("");
        setLines([{ id: "1", sku: "", qty: 10 }]);
      } else {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (e) {
      setStatusMessage({ type: "error", text: "حدث خطأ أثناء تسجيل الاستلام" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Inbox className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">استلام بضاعة الموردين (Inbound Receiving)</h1>
          <p className="text-slate-500 text-xs">تسجيل الشحنات والتوريدات الواردة من المصنع وإضافتها لرصيد المخزن فوراً</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم إذن الاستلام أو الفاتورة (PO / Ref #) *</label>
            <input
              type="text"
              required
              placeholder="مثال: REC-101 أو PO-55"
              value={poNum}
              onChange={(e) => setPoNum(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">المورد أو المصنع</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <OperatorSelect
            value={operator}
            onChange={setOperator}
            label="المستلم (Operator) *"
          />
        </div>

        {/* Lines */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">الأصناف المستلمة</h3>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={line.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
                <div className="flex-1">
                  <select
                    value={line.sku}
                    onChange={(e) =>
                      setLines(lines.map((l) => (l.id === line.id ? { ...l, sku: e.target.value } : l)))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختر الصنف المستلم --</option>
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} | {p.model} - {p.color} ({p.size})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min="1"
                    placeholder="الكمية"
                    value={line.qty}
                    onChange={(e) =>
                      setLines(lines.map((l) => (l.id === line.id ? { ...l, qty: parseInt(e.target.value) || 0 } : l)))
                    }
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-extrabold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف آخر</span>
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الاستلام</label>
          <input
            type="text"
            placeholder="ملاحظات أو رقم بوليصة الشحن..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Inbox className="w-5 h-5" />
          <span>{submitting ? "جاري الحفظ..." : "تأكيد واستلام البضاعة (RECEIVE STOCK)"}</span>
        </button>
      </form>
    </div>
  );
}