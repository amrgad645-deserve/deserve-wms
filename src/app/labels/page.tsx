"use client";

import React, { useState, useEffect, useRef } from "react";
import { Printer, Tag, Search, Filter, Check, Layers } from "lucide-react";
import JsBarcode from "jsbarcode";
import { Product } from "@/lib/types";

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<"50x30" | "40x25">("50x30");
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [barcodeSvgMarkup, setBarcodeSvgMarkup] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (data.products.length > 0) {
            setSelectedSku(data.products[0].sku);
            setSelectedProduct(data.products[0]);
          }
        }
      });
  }, []);

  useEffect(() => {
    const prod = products.find((p) => p.sku === selectedSku);
    setSelectedProduct(prod || null);
  }, [selectedSku, products]);

  useEffect(() => {
    if (barcodeSvgRef.current && selectedProduct) {
      try {
        JsBarcode(barcodeSvgRef.current, selectedProduct.barcode || selectedProduct.sku, {
          format: "CODE128",
          width: labelSize === "50x30" ? 1.6 : 1.2,
          height: labelSize === "50x30" ? 40 : 30,
          displayValue: true,
          fontSize: 10,
          margin: 0,
        });
        // Keep markup in state so the print copies always match the current product
        setBarcodeSvgMarkup(barcodeSvgRef.current.outerHTML);
      } catch (e) {}
    }
  }, [selectedProduct, labelSize]);

  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      p.color.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search);
    const matchesModel = !modelFilter || p.model === modelFilter;
    return matchesSearch && matchesModel;
  });

  const models = Array.from(new Set(products.map((p) => p.model)));

  return (
    <div className="space-y-6">
      {/* Screen Header - Hidden on Print */}
      <div className="print:hidden bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-400">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">طباعة استيكرات الباركود الحرارية (Barcode Labels)</h1>
            <p className="text-slate-400 text-xs">
              توليد وطباعة ملصقات الباركود على طابعات الملصقات الحرارية (Xprinter / Zebra) للصقها على كراتين الشنط
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={!selectedProduct}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الاستيكر (PRINT {printCopies} LABELS)</span>
        </button>
      </div>

      {/* Configuration & Selection - Hidden on Print */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Selector */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="ابحث بالاسم، الكود، الباركود..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">جميع الموديلات</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            {filteredProducts.map((p) => {
              const isSelected = p.sku === selectedSku;
              return (
                <div
                  key={p.sku}
                  onClick={() => setSelectedSku(p.sku)}
                  className={`p-3 flex items-center justify-between cursor-pointer transition ${
                    isSelected ? "bg-amber-50 border-r-4 border-amber-500" : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">{p.sku}</div>
                    <div className="text-slate-500 text-[11px]">
                      {p.model} - {p.color} ({p.size})
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {p.barcode || "No Barcode"}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 inline-block mr-2" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Print Settings & Live Preview */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">إعدادات الطباعة</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مقاس الملصق الحراري</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelSize("50x30")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    labelSize === "50x30"
                      ? "border-amber-500 bg-amber-50 text-amber-900"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  50 × 30 مم (قياسي)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelSize("40x25")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    labelSize === "40x25"
                      ? "border-amber-500 bg-amber-50 text-amber-900"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  40 × 25 مم (مدمج)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">عدد النسخ المطلوب طباعتها</label>
              <input
                type="number"
                min={1}
                max={100}
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Preview Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">معاينة شكل الملصق الحراري</label>
              {selectedProduct ? (
                <div
                  className={`border-2 border-dashed border-slate-300 p-3 mx-auto bg-white rounded-lg flex flex-col items-center justify-between text-center ${
                    labelSize === "50x30" ? "w-[220px] h-[135px]" : "w-[180px] h-[115px]"
                  }`}
                >
                  <div className="w-full flex items-center justify-between border-b border-black pb-0.5">
                    <span className="font-black text-[11px] tracking-wider text-black">DESERVE</span>
                    <span className="font-bold text-[9px] text-black">
                      {selectedProduct.bin_location && selectedProduct.bin_location !== "UNASSIGNED"
                        ? `رف: ${selectedProduct.bin_location}`
                        : "ORIGINAL"}
                    </span>
                  </div>

                  <div className="my-1">
                    <div className="font-bold text-[10px] text-black leading-tight">
                      {selectedProduct.model} - {selectedProduct.color}
                    </div>
                    <div className="font-black text-[11px] text-black">{selectedProduct.size}</div>
                  </div>

                  <div className="w-full flex justify-center">
                    <svg ref={barcodeSvgRef} className="max-w-full" />
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">اختر صنفاً للمعاينة</div>
              )}
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={!selectedProduct}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملصق الآن</span>
          </button>
        </div>
      </div>

      {/* PRINT MEDIA ONLY: This section renders ONLY when window.print() is called */}
      <div className="hidden print:block">
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:block {
              display: block !important;
            }
            @page {
              size: ${labelSize === "50x30" ? "50mm 30mm" : "40mm 25mm"};
              margin: 0;
            }
            .label-page {
              page-break-after: always;
              width: ${labelSize === "50x30" ? "50mm" : "40mm"};
              height: ${labelSize === "50x30" ? "30mm" : "25mm"};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              padding: 2mm;
              box-sizing: border-box;
              text-align: center;
              font-family: sans-serif;
            }
          }
        `}</style>

        {selectedProduct &&
          Array.from({ length: printCopies }).map((_, index) => (
            <div key={index} className="label-page">
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid black",
                  paddingBottom: "1px",
                }}
              >
                <span style={{ fontWeight: 900, fontSize: "8pt", letterSpacing: "1px" }}>DESERVE</span>
                <span style={{ fontWeight: 700, fontSize: "6.5pt" }}>
                  {selectedProduct.bin_location && selectedProduct.bin_location !== "UNASSIGNED"
                    ? `رف: ${selectedProduct.bin_location}`
                    : "ORIGINAL"}
                </span>
              </div>

              <div style={{ margin: "1mm 0" }}>
                <div style={{ fontWeight: 800, fontSize: "6.5pt", lineHeight: 1.1 }}>
                  {selectedProduct.model} - {selectedProduct.color}
                </div>
                <div style={{ fontWeight: 900, fontSize: "7.5pt" }}>{selectedProduct.size}</div>
              </div>

              <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                {/* Embedded SVG will be duplicated cleanly */}
                <div dangerouslySetInnerHTML={{ __html: barcodeSvgMarkup }} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
