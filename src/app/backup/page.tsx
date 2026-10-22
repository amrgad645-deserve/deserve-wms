"use client";

import React, { useState, useEffect, useRef } from "react";
import { Database, Download, HardDrive, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, RotateCcw, UploadCloud } from "lucide-react";

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const restoreInputRef = useRef<HTMLInputElement>(null);


  const loadBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup?action=list");
      const data = await res.json();
      if (data.success) setBackups(data.backups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateSnapshot = async () => {
    try {
      setCreating(true);
      setStatusMsg(null);
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      loadBackups();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "فشل إنشاء النسخة الاحتياطية", isError: true });
    } finally {
      setCreating(false);
    }
  };

  const [resetting, setResetting] = useState(false);

  const handleResetData = async () => {
    const confirmed = window.confirm(
      "⚠️ تنبيه هام:\nهل أنت متأكد تماماً من رغبتك في تصفير جميع الأرصدة ومسح الحركات التجريبية؟\n\n- سيتم الحفاظ على كتالوج الأصناف الـ 118 كاملاً.\n- ستصبح جميع الكميات 0 قطعة استعداداً لإدخال الجرد الفعلي المظبوط."
    );
    if (!confirmed) return;

    try {
      setResetting(true);
      setStatusMsg(null);
      const res = await fetch("/api/backup?action=reset", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
    } catch (err: any) {
      setStatusMsg({ text: err.message || "فشل تصفير البيانات", isError: true });
    } finally {
      setResetting(false);
    }
  };

  const handleRestoreDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      `⚠️ تأكيد استعادة قاعدة البيانات:\nهل أنت متأكد من رغبتك في استعادة قاعدة البيانات من الملف (${file.name})؟\n\n- سيتم استبدال البيانات الحالية بالكامل بالنسخة المستعادة.\n- سيتم حفظ نسخة أمان تلقائية للبيانات الحالية قبل الاستبدال.`
    );
    if (!confirmed) {
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      return;
    }

    try {
      setRestoring(true);
      setStatusMsg(null);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/backup?action=restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      loadBackups();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "فشل استعادة قاعدة البيانات", isError: true });
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">النسخ الاحتياطي وحماية البيانات (Backup & Recovery)</h1>
            <p className="text-slate-400 text-xs">
              تأمين وأخذ نسخ احتياطية كاملة من قاعدة بيانات مستودع DESERVE لتفادي أي فقدان للبيانات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoring}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            title="استعادة قاعدة البيانات من ملف .db محفوظ مسبقاً"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{restoring ? "جاري الاستعادة..." : "استعادة نسخة سابقة (.db)"}</span>
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".db"
            onChange={handleRestoreDb}
            className="hidden"
          />

          <button
            onClick={handleResetData}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-3 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
            title="تصفير الأرصدة ومسح الحركات التجريبية"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{resetting ? "جاري التصفير..." : "تصفير الأرصدة وبدء الجرد من الصفر"}</span>
          </button>

          <a
            href="/api/backup?action=download"
            download
            className="flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-cyan-500/20"
          >
            <Download className="w-4 h-4" />
            <span>تحميل نسخة قاعدة البيانات (.db)</span>
          </a>
        </div>
      </div>


      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            statusMsg.isError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Snapshot Action & Security Note */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">سجل النسخ الاحتياطية المحفوظة محلياً (Local Snapshots)</h3>
              <p className="text-xs text-slate-400">تُحفظ النسخ داخل مجلد backups بالمشروع</p>
            </div>
            <button
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>{creating ? "جاري الحفظ..." : "أخذ لقطة سريعة الآن"}</span>
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">جاري قراءة النسخ...</div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                لا توجد لقطات محلية مسجلة بعد. اضغط "أخذ لقطة سريعة الآن" لإنشاء أول لقطة.
              </div>
            ) : (
              backups.map((b) => (
                <div key={b.name} className="py-3 px-2 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-cyan-600" />
                    <div>
                      <div className="font-mono font-bold text-slate-900">{b.name}</div>
                      <div className="text-[11px] text-slate-400">{b.createdAt}</div>
                    </div>
                  </div>
                  <span className="font-mono text-slate-500 font-bold">{(b.size / 1024).toFixed(1)} KB</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cloud Sync Guidance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white border border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <ShieldCheck className="w-5 h-5" />
              <span>حماية البيانات السحابية (Cloud Sync)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              لضمان عدم ضياع أي بيانات إذا تعطل هذا الجهاز، يمكنك:
            </p>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>تحميل ملف <strong className="text-cyan-300">.db</strong> وحفظه أسبوعياً على Google Drive.</li>
              <li>أو مزامنة مجلد المشروع تلقائياً مع Dropbox أو Google Drive Desktop.</li>
            </ul>
          </div>

          <div className="p-3 bg-white/10 rounded-xl text-[11px] text-slate-300 border border-white/10">
            قاعدة البيانات تعتمد محرك SQLite مع تشغيل تقنية WAL لكتابة سريعة ومحمية من انقطاع الكهرباء.
          </div>
        </div>
      </div>
    </div>
  );
}
