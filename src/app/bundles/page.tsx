"use client";

import React, { useState, useEffect } from "react";
import { Package, Split, Merge, AlertCircle, CheckCircle, RefreshCw, Layers } from "lucide-react";
import OperatorSelect from "@/components/OperatorSelect";

interface BundleItem {
  setSku: string;
  setName: string;
  model: string;
  color: string;
  setGoodStock: number;
  availableToAssemble: number;
  items: {
    sku: string;
    size: string;
    goodStock: number;
    exists: boolean;
  }[];
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal / Action state
  const [activeModal, setActiveModal] = useState<{
    type: "ASSEMBLE" | "DISASSEMBLE";
    bundle: BundleItem;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");

  const loadBundles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bundles");
      const data = await res.json();
      if (data.success) {
        setBundles(data.bundles);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundles();
  }, []);

  const handleExecute = async () => {
    if (!activeModal) return;
    try {
      setActionLoading(true);
      setStatusMsg(null);

      const res = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: activeModal.type,
          setSku: activeModal.bundle.setSku,
          qty,
          operator,
          notes,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      setStatusMsg({ text: data.message, isError: false });
      setActiveModal(null);
      setQty(1);
      setNotes("");
      loadBundles();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء تنفيذ العملية", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBundles = bundles.filter(
    (b) =>
      b.setSku.toLowerCase().includes(search.toLowerCase()) ||
      b.model.toLowerCase().includes(search.toLowerCase()) ||
      b.color.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">إدارة وتفكيك وتجميع الأطقم (Kit & Bundling Engine)</h1>
            <p className="text-slate-400 text-xs">
              تحويل الأطقم الكاملة (3 قطع) إلى شنط فردية (21 و 25 و 29) أو تجميع الشنط الفردية إلى طقم كامل مع تحديث آلي للمخزون
            </p>
          </div>
        </div>

        <button
          onClick={loadBundles}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث الأرصدة</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition ${
            statusMsg.isError
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.isError ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <input
          type="text"
          placeholder="ابحث عن طقم بالـ SKU أو الموديل أو اللون..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
      </div>

      {/* Bundles Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-xs text-slate-400 font-bold border border-slate-200">
          جاري تحميل بيانات الأطقم والأرصدة...
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-xs text-slate-400 font-bold border border-slate-200">
          لا توجد أطقم مطابقة لبحثك
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBundles.map((b) => (
            <div
              key={b.setSku}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:border-indigo-300 transition"
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 mb-1">
                      {b.model}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900">{b.setName}</h3>
                    <div className="font-mono text-xs text-slate-400 font-semibold">{b.setSku}</div>
                  </div>

                  <div className="text-center bg-slate-50 border border-slate-100 rounded-xl p-2.5 min-w-[70px]">
                    <div className="text-[10px] font-bold text-slate-400">رصيد الطقم</div>
                    <div className="text-xl font-black text-slate-900">{b.setGoodStock}</div>
                  </div>
                </div>

                {/* Sub-items status */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                    <span>محتويات الطقم (3 قطع):</span>
                    <span className="text-emerald-700">متاح للتجميع: {b.availableToAssemble} طقم</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {b.items.map((item) => (
                      <div key={item.sku} className="bg-white p-2 rounded-lg border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-600">{item.size.replace(" INCH", '"')}</div>
                        <div className="text-xs font-black text-slate-900 mt-0.5">{item.goodStock}</div>
                        <div className="text-[9px] text-slate-400 font-mono truncate">{item.sku.split("-")[2]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setActiveModal({ type: "DISASSEMBLE", bundle: b });
                    setQty(1);
                  }}
                  disabled={b.setGoodStock <= 0}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-white"
                >
                  <Split className="w-3.5 h-3.5 text-amber-600" />
                  <span>فك الطقم (Unbundle)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModal({ type: "ASSEMBLE", bundle: b });
                    setQty(1);
                  }}
                  disabled={b.availableToAssemble <= 0}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:hover:bg-indigo-600"
                >
                  <Merge className="w-3.5 h-3.5" />
                  <span>تجميع طقم (Assemble)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation & Execution Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className={`p-4 text-white flex items-center justify-between ${
              activeModal.type === "ASSEMBLE" ? "bg-indigo-600" : "bg-amber-600"
            }`}>
              <div className="flex items-center gap-2">
                {activeModal.type === "ASSEMBLE" ? <Merge className="w-5 h-5" /> : <Split className="w-5 h-5" />}
                <h3 className="font-bold text-sm">
                  {activeModal.type === "ASSEMBLE" ? "تأكيد تجميع طقم كامل" : "تأكيد فك طقم إلى قطع فردية"}
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 text-xs">{activeModal.bundle.setName}</div>
                <div className="text-slate-400 font-mono text-[11px]">{activeModal.bundle.setSku}</div>
              </div>

              <div className="p-3 rounded-xl text-xs font-medium bg-blue-50 border border-blue-200 text-blue-900">
                {activeModal.type === "ASSEMBLE" ? (
                  <div>
                    سيتم خصم <strong>({qty})</strong> قطعة من كل مقاس فردي (21 و 25 و 29) وإضافة <strong>({qty})</strong> طقم إلى الرصيد.
                  </div>
                ) : (
                  <div>
                    سيتم خصم <strong>({qty})</strong> طقم من الرصيد، وإضافة <strong>({qty})</strong> قطعة لكل من المقاسات الفردية الثلاثة (21 و 25 و 29).
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المراد معالجتها</label>
                <input
                  type="number"
                  min={1}
                  max={activeModal.type === "ASSEMBLE" ? activeModal.bundle.availableToAssemble : activeModal.bundle.setGoodStock}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <OperatorSelect
                value={operator}
                onChange={setOperator}
                label="الموظف المسؤول"
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  placeholder="سبب الفك أو أمر التجميع..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={actionLoading || qty <= 0}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition disabled:opacity-50 ${
                    activeModal.type === "ASSEMBLE"
                      ? "bg-indigo-600 hover:bg-indigo-500"
                      : "bg-amber-600 hover:bg-amber-500"
                  }`}
                >
                  {actionLoading ? "جاري المعالجة..." : "تأكيد واعتماد الحركة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
