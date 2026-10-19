"use client";

import React, { useState, useEffect } from "react";
import { Truck, Plus, Trash2, Printer, Search, Camera, CheckCircle, AlertCircle, FileText } from "lucide-react";
import CameraScannerModal from "@/components/CameraScannerModal";
import OperatorSelect from "@/components/OperatorSelect";

interface Manifest {
  id: number;
  manifest_id: string;
  courier: string;
  driver_name: string;
  driver_phone: string;
  car_number: string;
  orders_json: string;
  total_orders: number;
  operator: string;
  created_at: string;
}

export default function ShippingPage() {
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [courier, setCourier] = useState("Bosta");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [operator, setOperator] = useState("");

  // Orders list to hand over
  const [orderInput, setOrderInput] = useState("");
  const [orders, setOrders] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activePrintManifest, setActivePrintManifest] = useState<Manifest | null>(null);

  const loadManifests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shipping");
      const data = await res.json();
      if (data.success) setManifests(data.manifests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifests();
  }, []);

  const addOrder = (orderNum: string) => {
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;
    if (orders.includes(clean)) {
      setStatusMsg({ text: `الأوردر ${clean} مضاف بالفعل في الكشف الحالي`, isError: true });
      return;
    }
    setOrders((prev) => [clean, ...prev]);
    setOrderInput("");
    setStatusMsg(null);
  };

  const removeOrder = (index: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orders.length === 0) {
      setStatusMsg({ text: "يرجى إضافة أوردر واحد على الأقل في الكشف", isError: true });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier,
          driver_name: driverName,
          driver_phone: driverPhone,
          car_number: carNumber,
          orders,
          operator,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });

      // Create manifest object for immediate print preview
      const newManifest: Manifest = {
        id: Date.now(),
        manifest_id: data.manifestId,
        courier,
        driver_name: driverName,
        driver_phone: driverPhone,
        car_number: carNumber,
        orders_json: JSON.stringify(orders),
        total_orders: orders.length,
        operator,
        created_at: new Date().toLocaleString("ar-EG"),
      };

      setActivePrintManifest(newManifest);
      setOrders([]);
      setDriverName("");
      setDriverPhone("");
      setCarNumber("");
      loadManifests();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء حفظ الكشف", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Hidden on Print */}
      <div className="print:hidden bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">إدارة تسليمات الشحن وكشوفات المندوبين (Courier Handover)</h1>
            <p className="text-slate-400 text-xs">
              مسح وتجميع طرود الشحن، وإصدار كشوفات تسليم رسمية لشركات الشحن (Bosta, Mylerz, Aramex) موثقة بتوقيع المندوب
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`print:hidden p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            statusMsg.isError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid - Hidden on Print */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Manifest Form */}
        <form onSubmit={handleCreateManifest} className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">إنشاء كشف تسليم شحنات جديد</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">شركة الشحن *</label>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Bosta">بوسطة (Bosta)</option>
                <option value="Mylerz">مايلرز (Mylerz)</option>
                <option value="J&T Express">J&T Express</option>
                <option value="Aramex">أرامكس (Aramex)</option>
                <option value="Internal Delivery">شحن خاص / مندوب الشركة</option>
              </select>
            </div>

            <OperatorSelect
              value={operator}
              onChange={setOperator}
              label="مسؤول تسليم الشحن (Operator) *"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المندوب / السائق</label>
              <input
                type="text"
                placeholder="اسم السائق..."
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم تليفون المندوب</label>
              <input
                type="text"
                placeholder="010XXXXXXXX"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم لوحة السيارة</label>
              <input
                type="text"
                placeholder="أ ب ج 1234"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Barcode/Order Scanning input */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مسح أو كتابة رقم الأوردر / البوليصة (Tracking AWB) *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="امسح الباركود أو اكتب رقم الأوردر ثم Enter..."
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOrder(orderInput);
                  }
                }}
                className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
                title="مسح بكاميرا الموبايل"
              >
                <Camera className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">الكاميرا</span>
              </button>
              <button
                type="button"
                onClick={() => addOrder(orderInput)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition text-xs font-bold"
              >
                إضافة
              </button>
            </div>
          </div>

          {/* Scanned Orders List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
              <span>قائمة الطرود المضافة للكشف:</span>
              <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">{orders.length} شحنة</span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
              {orders.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  لم يتم مسح أي طرود بعد، امسح الباركود بالمسدس أو الكاميرا لإضافتها هنا.
                </div>
              ) : (
                orders.map((ord, idx) => (
                  <div key={ord} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold w-6">{idx + 1}.</span>
                      <span className="font-mono font-bold text-slate-900">{ord}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOrder(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || orders.length === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>حفظ واعتماد كشف التسليم والطباعة</span>
          </button>
        </form>

        {/* Past Manifests */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">كشوفات التسليم السابقة</h3>

          <div className="max-h-[500px] overflow-y-auto space-y-3">
            {manifests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">لا توجد كشوفات تسليم سابقة</div>
            ) : (
              manifests.map((m) => (
                <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-blue-600">{m.manifest_id}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                      {m.courier}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    <div>إجمالي الشحنات: <strong className="text-slate-900">{m.total_orders}</strong> طرد</div>
                    <div>السائق: {m.driver_name || "—"} ({m.driver_phone || "—"})</div>
                    <div className="text-[10px] text-slate-400 mt-1">{m.created_at}</div>
                  </div>

                  <button
                    onClick={() => {
                      setActivePrintManifest(m);
                      setTimeout(() => window.print(), 100);
                    }}
                    className="w-full py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة الكشف</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(scanned) => addOrder(scanned)}
        title="مسح بوليصة الشحنة بكاميرا الموبايل"
      />

      {/* PRINT MEDIA ONLY: Courier Handover Manifest */}
      {activePrintManifest && (
        <div className="hidden print:block">
          <style jsx global>{`
            @media print {
              body {
                background: white !important;
                padding: 10mm !important;
              }
              .print\\:hidden {
                display: none !important;
              }
              .print\\:block {
                display: block !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
            }
          `}</style>

          <div className="p-4 border-2 border-slate-900 rounded-xl space-y-4 text-black">
            {/* Manifest Header */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3">
              <div>
                <h1 className="text-2xl font-black tracking-wide">DESERVE LUGGAGE</h1>
                <p className="text-xs font-bold text-slate-600">كشف تسليم طرود وشحنات لمندوب الشحن الرسمي</p>
              </div>
              <div className="text-left font-mono">
                <div className="text-lg font-black">{activePrintManifest.manifest_id}</div>
                <div className="text-xs text-slate-600">{activePrintManifest.created_at}</div>
              </div>
            </div>

            {/* Courier Info Box */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-300 text-xs">
              <div>
                <div>شركة الشحن: <strong>{activePrintManifest.courier}</strong></div>
                <div>اسم المندوب: <strong>{activePrintManifest.driver_name || "—"}</strong></div>
              </div>
              <div>
                <div>رقم تليفون المندوب: <strong>{activePrintManifest.driver_phone || "—"}</strong></div>
                <div>لوحة السيارة: <strong>{activePrintManifest.car_number || "—"}</strong></div>
              </div>
            </div>

            {/* Orders Table */}
            <div>
              <div className="font-bold text-xs mb-2">
                بيان الشحنات المسلمة (إجمالي: {activePrintManifest.total_orders} طرد):
              </div>
              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-slate-300 p-2 w-12 text-center">#</th>
                    <th className="border border-slate-300 p-2 font-mono">رقم الأوردر / البوليصة (AWB)</th>
                    <th className="border border-slate-300 p-2 text-center w-28">حالة الاستلام</th>
                  </tr>
                </thead>
                <tbody>
                  {JSON.parse(activePrintManifest.orders_json || "[]").map((ord: string, i: number) => (
                    <tr key={i}>
                      <td className="border border-slate-300 p-2 text-center font-bold">{i + 1}</td>
                      <td className="border border-slate-300 p-2 font-mono font-bold">{ord}</td>
                      <td className="border border-slate-300 p-2 text-center text-slate-400">[  ] سليم</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-slate-900 mt-8 text-xs font-bold">
              <div className="text-center space-y-10">
                <div>مسؤول مخزن DESERVE: {activePrintManifest.operator}</div>
                <div className="border-t border-dashed border-slate-400 pt-2">التوقيع / الختم</div>
              </div>
              <div className="text-center space-y-10">
                <div>اسم وتوقيع مندوب شركة ({activePrintManifest.courier}):</div>
                <div className="border-t border-dashed border-slate-400 pt-2">توقيع المستلم بما يفيد صحة العدد</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
