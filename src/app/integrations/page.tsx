"use client";

import React, { useState, useEffect } from "react";
import { Globe, Copy, Check, Send, ShoppingCart, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Product } from "@/lib/types";

export default function IntegrationsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Simulator state
  const [testSku, setTestSku] = useState("");
  const [testOrder, setTestOrder] = useState("SHOPIFY-8921");
  const [testCustomer, setTestCustomer] = useState("عميل المتجر الإلكتروني");
  const [testQty, setTestQty] = useState(1);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (data.products.length > 0) setTestSku(data.products[0].sku);
        }
      });
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      setSimResult(null);

      const res = await fetch("/api/webhooks/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: testOrder,
          source: "Shopify Store",
          customer_name: testCustomer,
          items: [{ sku: testSku, qty: testQty }],
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSimResult({ text: data.message, isError: false });
    } catch (err: any) {
      setSimResult({ text: err.message || "فشلت محاكاة الويب هوك", isError: true });
    } finally {
      setSimulating(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const webhookUrl = `${origin}/api/webhooks/orders`;
  const stockFeedUrl = `${origin}/api/feeds/stock`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">مركز الربط مع المتاجر الإلكترونية (E-Commerce Sync)</h1>
            <p className="text-slate-400 text-xs">
              مزامنة فورية لمخزون DESERVE مع (Shopify, WooCommerce, Salla, Zid) وخصم الطلبات آلياً عبر Webhooks
            </p>
          </div>
        </div>
      </div>

      {/* Endpoints Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Webhook Endpoint */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <ShoppingCart className="w-4 h-4" />
            <span>رابط الويب هوك لاستقبال الطلبات (Order Created Webhook)</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            ضع هذا الرابط في متجرك (Shopify Notifications &gt; Webhooks أو WooCommerce Webhooks). يقوم السيستم بخصم المخزون فورياً عند إتمام العميل للطلب.
          </p>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs text-slate-800">
            <span className="flex-1 truncate">{webhookUrl}</span>
            <button
              onClick={() => copyToClipboard(webhookUrl, "webhook")}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 text-[11px] font-bold flex items-center gap-1 transition"
            >
              {copiedKey === "webhook" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "webhook" ? "تم النسخ" : "نسخ"}</span>
            </button>
          </div>
        </div>

        {/* Live Stock Feed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
            <RefreshCw className="w-4 h-4" />
            <span>تغذية المخزون اللحظية (Live Stock JSON Feed)</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            رابط لتصدير أرصدة الأصناف الـ 118 ومواقع الأرفف لحظياً بصيغة JSON لمنع البيع الزائد (Overselling) على المتجر.
          </p>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs text-slate-800">
            <span className="flex-1 truncate">{stockFeedUrl}</span>
            <button
              onClick={() => copyToClipboard(stockFeedUrl, "feed")}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 text-[11px] font-bold flex items-center gap-1 transition"
            >
              {copiedKey === "feed" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "feed" ? "تم النسخ" : "نسخ"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Webhook Simulator */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          محاكاة واختبار استقبال أوردر من المتجر (Test Store Webhook)
        </h3>

        {simResult && (
          <div
            className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              simResult.isError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {simResult.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>{simResult.text}</span>
          </div>
        )}

        <form onSubmit={handleSimulateWebhook} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم الأوردر التجريبي</label>
            <input
              type="text"
              value={testOrder}
              onChange={(e) => setTestOrder(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل</label>
            <input
              type="text"
              value={testCustomer}
              onChange={(e) => setTestCustomer(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الصنف المطلوب</label>
            <select
              value={testSku}
              onChange={(e) => setTestSku(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} ({p.good_stock} متاح)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الكمية</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={testQty}
                onChange={(e) => setTestQty(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={simulating}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{simulating ? "جاري الإرسال..." : "إرسال تجربة"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
