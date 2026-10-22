"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  Filter,
  Check,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import OperatorSelect from "./OperatorSelect";
import { Product } from "@/lib/types";

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (result: { totalUpdated: number; totalGood: number; totalDef: number }) => void;
}

interface ParsedRow {
  raw: any;
  matched: boolean;
  product?: Product;
  sku: string;
  model: string;
  color: string;
  size: string;
  barcode: string;
  binLocation: string;
  currentGood: number;
  currentDef: number;
  newGood: number;
  newDef: number;
  diffGood: number;
  diffDef: number;
  statusNote: string;
}

// Arabic to English color dictionary
const AR_COLOR_MAP: Record<string, string> = {
  أسود: "BLACK",
  اسود: "BLACK",
  بلاك: "BLACK",
  بيج: "BEIGE",
  كحلي: "NAVY",
  كحلى: "NAVY",
  "ازرق داكن": "NAVY",
  زيتي: "OLIVE GREEN",
  زيتى: "OLIVE GREEN",
  اخضر: "OLIVE GREEN",
  وردي: "PINK",
  وردى: "PINK",
  بينك: "PINK",
  زهري: "PINK",
  موف: "DARK MAUVE",
  بنفسجي: "DARK MAUVE",
  ليموني: "LEMON",
  اصفر: "LEMON",
  أصفر: "LEMON",
  فضي: "SILVER",
  فضى: "SILVER",
  سيلفر: "SILVER",
  رمادي: "SILVER",
  تركواز: "TURQUOISE",
  فيروزي: "TURQUOISE",
  برتقالي: "ORANGE",
  اورنج: "ORANGE",
  روز: "ROSE GOLD",
  "روز جولد": "ROSE GOLD",
  جينز: "DENIM BLUE",
  دينم: "DENIM BLUE",
  ازرق: "DENIM BLUE",
  بيربل: "PURPLE",
};

export default function ExcelImportModal({ isOpen, onClose, onImportSuccess }: ExcelImportModalProps) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewTab, setPreviewTab] = useState<"ALL" | "MATCHED" | "UNMATCHED">("ALL");
  const [operator, setOperator] = useState("لجنة الجرد الفعلي");
  const [notes, setNotes] = useState("استيراد جرد فعلي وتحديث أرصدة من ملف إكسيل");
  const [zeroOutMissing, setZeroOutMissing] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load latest catalog products on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      fetch("/api/products")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setCatalog(d.products);
        })
        .catch(() => {});
    } else {
      // Reset state on close
      setFile(null);
      setParsedRows([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Download Blank/Catalog Excel Template
  const handleDownloadTemplate = () => {
    try {
      const templateData = catalog.map((p) => ({
        "كود الصنف (SKU)": p.sku,
        "الموديل (Model)": p.model,
        "اللون (Color)": p.color,
        "المقاس (Size)": p.size,
        "الباركود (Barcode)": p.barcode || "",
        "الرصيد السليم (Good Stock)": p.good_stock,
        "الرصيد التالف (Defective Stock)": p.defective_stock,
        "مكان الرف (Bin Location)": p.bin_location || "UNASSIGNED",
      }));

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "شيت الجرد الافتتاحي");

      // Set column widths
      ws["!cols"] = [
        { wch: 22 }, // SKU
        { wch: 18 }, // Model
        { wch: 16 }, // Color
        { wch: 14 }, // Size
        { wch: 18 }, // Barcode
        { wch: 22 }, // Good
        { wch: 24 }, // Def
        { wch: 18 }, // Bin
      ];

      XLSX.writeFile(wb, "DESERVE_Inventory_Audit_Template.xlsx");
    } catch (err: any) {
      setErrorMsg("فشل إنشاء نموذج الإكسيل: " + err.message);
    }
  };

  // 2. Parse Uploaded File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processExcelFile(selected);
  };

  const processExcelFile = (uploadedFile: File) => {
    setLoadingFile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFile(uploadedFile);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("ملف الإكسيل فارغ ولا يحتوي على أي بيانات");
        }

        // Identify column keys dynamically
        const firstRow = rawJson[0];
        const keys = Object.keys(firstRow);

        const findKey = (patterns: RegExp[]) => {
          return keys.find((k) => patterns.some((p) => p.test(k.trim().toLowerCase())));
        };

        const skuKey = findKey([
          /^كود/,
          /^كود الصنف/,
          /^الكود/,
          /^sku/,
          /^code/,
          /^item_code/,
          /^item code/,
          /^الرمز/,
          /^رمز/,
          /^الصنف/,
        ]);

        const goodKey = findKey([
          /^سليم/,
          /^رصيد سليم/,
          /^الرصيد السليم/,
          /^سليم \(good\)/,
          /^good/,
          /^good_stock/,
          /^good stock/,
          /^الكمية/,
          /^كمية/,
          /^الرصيد/,
          /^رصيد/,
          /^المتاح/,
          /^المخزون/,
          /^qty/,
          /^quantity/,
          /^stock/,
          /^العدد/,
          /^عدد/,
        ]);

        const defKey = findKey([
          /^تالف/,
          /^رصيد تالف/,
          /^الرصيد التالف/,
          /^تالف \(defective\)/,
          /^معيب/,
          /^توالف/,
          /^defective/,
          /^defective_stock/,
          /^defective stock/,
          /^damaged/,
          /^defect/,
        ]);

        const barcodeKey = findKey([/^باركود/, /^الباركود/, /^barcode/, /^upc/, /^ean/]);
        const modelKey = findKey([/^موديل/, /^الموديل/, /^model/, /^اسم الموديل/]);
        const colorKey = findKey([/^لون/, /^اللون/, /^color/, /^colour/]);
        const sizeKey = findKey([/^مقاس/, /^المقاس/, /^size/]);
        const binKey = findKey([/^مكان/, /^المكان/, /^رف/, /^الرف/, /^لوكيشن/, /^bin/, /^location/]);

        // Process rows against catalog
        const results: ParsedRow[] = [];

        rawJson.forEach((row, idx) => {
          let rawSku = skuKey ? String(row[skuKey] || "").trim() : "";
          const rawBarcode = barcodeKey ? String(row[barcodeKey] || "").trim() : "";
          const rawModel = modelKey ? String(row[modelKey] || "").trim() : "";
          const rawColor = colorKey ? String(row[colorKey] || "").trim() : "";
          const rawSize = sizeKey ? String(row[sizeKey] || "").trim() : "";
          const rawBin = binKey ? String(row[binKey] || "").trim() : "UNASSIGNED";

          // Parse quantities
          const parsedGood = goodKey !== undefined && row[goodKey] !== "" ? Math.max(0, parseInt(String(row[goodKey]).replace(/[^0-9]/g, "")) || 0) : 0;
          const parsedDef = defKey !== undefined && row[defKey] !== "" ? Math.max(0, parseInt(String(row[defKey]).replace(/[^0-9]/g, "")) || 0) : 0;

          // If no SKU found, but row has model/color/size, create a candidate SKU
          if (!rawSku && rawModel) {
            rawSku = `${rawModel.toUpperCase()}-${rawColor.toUpperCase()}-${rawSize.toUpperCase()}`;
          }

          if (!rawSku && !rawBarcode && !rawModel) {
            // Empty row, skip
            return;
          }

          // Matching Strategy
          let matchedProduct: Product | undefined = undefined;

          // 1. Match by SKU
          if (rawSku) {
            const cleanSku = rawSku.toUpperCase().replace(/\s+/g, "");
            matchedProduct = catalog.find(
              (p) => p.sku.toUpperCase() === rawSku.toUpperCase() || p.sku.toUpperCase().replace(/\s+/g, "") === cleanSku
            );
          }

          // 2. Match by Barcode
          if (!matchedProduct && rawBarcode) {
            matchedProduct = catalog.find((p) => p.barcode && p.barcode.trim() === rawBarcode);
          }

          // 3. Match by Model + Color + Size
          if (!matchedProduct && rawModel && rawColor) {
            const normalizedColor = AR_COLOR_MAP[rawColor.trim()] || rawColor.trim().toUpperCase();
            const cleanModel = rawModel.trim().toUpperCase();
            const cleanSize = rawSize.trim().toUpperCase();

            matchedProduct = catalog.find((p) => {
              const mMatch = p.model.toUpperCase() === cleanModel || p.model.toUpperCase().includes(cleanModel);
              const cMatch = p.color.toUpperCase() === normalizedColor || p.color.toUpperCase().includes(normalizedColor);
              const sMatch = !cleanSize || p.size.toUpperCase().includes(cleanSize) || cleanSize.includes(p.size.toUpperCase());
              return mMatch && cMatch && sMatch;
            });
          }

          if (matchedProduct) {
            results.push({
              raw: row,
              matched: true,
              product: matchedProduct,
              sku: matchedProduct.sku,
              model: matchedProduct.model,
              color: matchedProduct.color,
              size: matchedProduct.size,
              barcode: matchedProduct.barcode || rawBarcode,
              binLocation: rawBin !== "UNASSIGNED" ? rawBin : matchedProduct.bin_location || "UNASSIGNED",
              currentGood: matchedProduct.good_stock,
              currentDef: matchedProduct.defective_stock,
              newGood: parsedGood,
              newDef: parsedDef,
              diffGood: parsedGood - matchedProduct.good_stock,
              diffDef: parsedDef - matchedProduct.defective_stock,
              statusNote: "مطابق بالكتالوج ✅",
            });
          } else {
            // Unmatched item
            results.push({
              raw: row,
              matched: false,
              sku: rawSku || `ITEM-${idx + 1}`,
              model: rawModel || "موديل غير محدد",
              color: rawColor || "لون غير محدد",
              size: rawSize || "مقاس غير محدد",
              barcode: rawBarcode,
              binLocation: rawBin,
              currentGood: 0,
              currentDef: 0,
              newGood: parsedGood,
              newDef: parsedDef,
              diffGood: parsedGood,
              diffDef: parsedDef,
              statusNote: "صنف غير مسجل بالكتالوج (سيتم إنشاؤه تلقائياً) ⚠️",
            });
          }
        });

        setParsedRows(results);
      } catch (err: any) {
        setErrorMsg("حدث خطأ أثناء قراءة ملف الإكسيل: " + (err.message || "الملف غير صالح"));
        setParsedRows([]);
      } finally {
        setLoadingFile(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("فشل قراءة الملف من الجهاز");
      setLoadingFile(false);
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  // 3. Confirm & Commit Import
  const handleCommitImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setImporting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const itemsPayload = parsedRows.map((r) => ({
        sku: r.sku,
        goodStock: r.newGood,
        defectiveStock: r.newDef,
        model: r.model,
        color: r.color,
        size: r.size,
        barcode: r.barcode,
        binLocation: r.binLocation,
        isNew: !r.matched,
      }));

      const res = await fetch("/api/stock/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsPayload,
          operator,
          notes,
          zeroOutMissing,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "فشل استيراد الجرد");
      }

      setSuccessMsg(data.message);

      if (onImportSuccess) {
        onImportSuccess({
          totalUpdated: data.totalUpdated,
          totalGood: data.totalGood,
          totalDef: data.totalDefective,
        });
      }

      // Automatically close after 2.5 seconds
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الجرد");
    } finally {
      setImporting(false);
    }
  };

  // Stats calculation
  const totalRows = parsedRows.length;
  const matchedCount = parsedRows.filter((r) => r.matched).length;
  const unmatchedCount = parsedRows.filter((r) => !r.matched).length;
  const totalNewGood = parsedRows.reduce((acc, r) => acc + r.newGood, 0);
  const totalNewDef = parsedRows.reduce((acc, r) => acc + r.newDef, 0);

  const filteredPreview = parsedRows.filter((r) => {
    if (previewTab === "MATCHED") return r.matched;
    if (previewTab === "UNMATCHED") return !r.matched;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex items-center justify-between border-b border-emerald-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>استيراد الجرد من شيت إكسيل (Excel Stock Import)</span>
              </h2>
              <p className="text-xs text-emerald-300/80">
                ارفع شيت الجرد الفعلي لتحديث أرصدة المخزن دفعة واحدة في ثوانٍ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-emerald-500/30"
              title="تحميل شيت إكسيل منسق بكافة أصناف الكتالوج الـ 118"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تحميل نموذج إكسيل فارغ</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Messages */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload Dropzone if no file or want to change */}
          {parsedRows.length === 0 ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) processExcelFile(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-3xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  {loadingFile ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {loadingFile ? "جاري قراءة وتحليل بيانات الإكسيل..." : "اسحب ملف الإكسيل هنا أو اضغط للاختيار من جهازك"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات بصيغة Excel (.xlsx, .xls) أو CSV.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>اختر الملف من جهازك</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Instructions Tip */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-emerald-600">💡</span>
                  <span>المطابقة الذكية للأعمدة:</span>
                </div>
                <p className="leading-relaxed">
                  السيستم يتعرف تلقائياً على الأعمدة سواء كانت بالعربي أو الإنجليزي:
                  <strong className="text-slate-900"> (كود الصنف / SKU)</strong>،
                  <strong className="text-slate-900"> (الرصيد السليم / Good Stock)</strong>،
                  <strong className="text-slate-900"> (الرصيد التالف / Defective)</strong>.
                  وإذا كان الشيت يحتوي على أعمدة (الموديل واللون والمقاس)، سيقوم بمطابقتها حتى لو كان كود الصنف مختلفاً!
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview & Verification */
            <div className="space-y-6">
              {/* Stats KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                  <div className="text-[11px] text-slate-500 font-bold">إجمالي صفوف الشيت</div>
                  <div className="text-xl font-black text-slate-900">{totalRows} صنف</div>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-center">
                  <div className="text-[11px] text-emerald-700 font-bold">مطابق بالكتالوج ✅</div>
                  <div className="text-xl font-black text-emerald-800">{matchedCount}</div>
                </div>

                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-center">
                  <div className="text-[11px] text-amber-700 font-bold">أصناف جديدة للتسجيل</div>
                  <div className="text-xl font-black text-amber-800">{unmatchedCount}</div>
                </div>

                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 text-center">
                  <div className="text-[11px] text-purple-700 font-bold">إجمالي القطع بالجرد</div>
                  <div className="text-xl font-black text-purple-900">
                    {totalNewGood + totalNewDef} ({totalNewGood} سليم / {totalNewDef} تالف)
                  </div>
                </div>
              </div>

              {/* Import Options Form */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OperatorSelect
                    value={operator}
                    onChange={setOperator}
                    label="المسؤول عن الجرد / مدخل البيانات *"
                  />
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ملاحظات حركة الجرد
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zeroOutMissing}
                    onChange={(e) => setZeroOutMissing(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    تصفير رصيد أي صنف غير مذكور في هذا الشيت؟ (Zero out missing SKUs)
                  </span>
                </label>
              </div>

              {/* Preview Table Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewTab("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      previewTab === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    الكل ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setPreviewTab("MATCHED")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      previewTab === "MATCHED"
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    المتطابقة فقط ({matchedCount})
                  </button>
                  {unmatchedCount > 0 && (
                    <button
                      onClick={() => setPreviewTab("UNMATCHED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        previewTab === "UNMATCHED"
                          ? "bg-amber-600 text-white"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      أصناف جديدة ({unmatchedCount})
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  رفع ملف آخر
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0 z-10 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-3">الموديل واللون والمقاس</th>
                      <th className="py-2.5 px-3 text-center bg-slate-800 text-emerald-400">
                        الرصيد السليم (الجديد)
                      </th>
                      <th className="py-2.5 px-3 text-center bg-slate-800 text-amber-400">
                        الرصيد التالف (الجديد)
                      </th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.map((row, idx) => {
                      const isSet = row.sku.endsWith("-SET");
                      return (
                        <tr
                          key={row.sku + idx}
                          className={`hover:bg-slate-50 transition ${
                            !row.matched ? "bg-amber-50/30" : isSet ? "bg-purple-50/20" : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {row.sku}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-700">
                            {row.model} - {row.color} ({row.size})
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-black text-emerald-700 text-sm">
                              {row.newGood}
                            </span>
                            {row.matched && row.diffGood !== 0 && (
                              <span
                                className={`mr-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  row.diffGood > 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {row.diffGood > 0 ? `+${row.diffGood}` : row.diffGood}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-black text-amber-700 text-sm">
                              {row.newDef}
                            </span>
                            {row.matched && row.diffDef !== 0 && (
                              <span
                                className={`mr-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  row.diffDef > 0
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-800"
                                }`}
                              >
                                {row.diffDef > 0 ? `+${row.diffDef}` : row.diffDef}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.matched ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" /> مطابق
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> صنف جديد
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
          >
            إلغاء
          </button>

          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={handleCommitImport}
              disabled={importing}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تحديث وتثبيت الجرد...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    تأكيد واستيراد الجرد إلى السيستم ({parsedRows.length} صنف)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
