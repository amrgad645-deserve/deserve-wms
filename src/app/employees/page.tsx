"use client";

import React, { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Edit3, CheckCircle2, AlertCircle, RefreshCw, UserCheck } from "lucide-react";
import { Employee } from "@/lib/types";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("أمين مخزن");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
    } catch (e: any) {
      setStatusMsg({ text: "فشل تحميل بيانات الموظفين", isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setActionLoading(true);
      setStatusMsg(null);
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      setName("");
      if (typeof window !== "undefined") {
        localStorage.setItem("deserve_current_operator", name.trim());
      }
      fetchEmployees();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء الإضافة", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;

    try {
      setActionLoading(true);
      setStatusMsg(null);
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), role: editRole }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      setEditingId(null);
      fetchEmployees();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء التحديث", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number, empName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف (${empName}) من قائمة النظام؟`)) return;

    try {
      setActionLoading(true);
      setStatusMsg(null);
      const res = await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      fetchEmployees();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء الحذف", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearDefaults = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف الأسماء التجريبية الافتراضية (أحمد حسن، محمد علي، محمود إبراهيم، كريم عادل، لجنة الجرد)؟")) return;

    try {
      setActionLoading(true);
      setStatusMsg(null);
      const res = await fetch("/api/employees?clear_defaults=true", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMsg({ text: data.message, isError: false });
      fetchEmployees();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "حدث خطأ أثناء المسح", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    "مشرف مخزن": "bg-purple-100 text-purple-800 border-purple-200",
    "أمين مخزن": "bg-blue-100 text-blue-800 border-blue-200",
    "تحضير وشحن": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "فني صيانة": "bg-amber-100 text-amber-800 border-amber-200",
    "لجنة جرد": "bg-rose-100 text-rose-800 border-rose-200",
    "استلام مرتجعات": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "مدير تشغيل": "bg-slate-900 text-white border-slate-900",
    "مسؤول شحن": "bg-teal-100 text-teal-800 border-teal-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">إدارة فريق العمل والموظفين (Staff Management)</h1>
            <p className="text-slate-400 text-xs">
              تسجيل أسماء وأدوار مسؤولي المخزن والفنيين لتظهر مباشرة في قوائم الصرف والاستلام والجرد والورشة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearDefaults}
            disabled={actionLoading}
            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="حذف الأسماء التجريبية الافتراضية"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الأسماء التجريبية الافتراضية</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition ${
            statusMsg.isError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.isError ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Add form + Employees List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to add employee */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">إضافة موظف جديد</h2>
          </div>

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الثلاثي للموظف *</label>
              <input
                type="text"
                placeholder="مثال: حسام أحمد محمود"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي / الدور *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="أمين مخزن">أمين مخزن</option>
                <option value="مشرف مخزن">مشرف مخزن</option>
                <option value="تحضير وشحن">تحضير وشحن</option>
                <option value="استلام مرتجعات">استلام مرتجعات</option>
                <option value="فني صيانة">فني صيانة</option>
                <option value="لجنة جرد">لجنة جرد</option>
                <option value="مدير تشغيل">مدير تشغيل</option>
                <option value="مسؤول شحن">مسؤول شحن</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={actionLoading || !name.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{actionLoading ? "جاري الإضافة..." : "حفظ الموظف في النظام"}</span>
            </button>
          </form>
        </div>

        {/* Employees Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-sm text-slate-900">
                فريق العمل المسجل ({employees.length})
              </h3>
            </div>
            <button
              onClick={fetchEmployees}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              title="تحديث القائمة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">الوظيفة / الدور</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      جاري تحميل فريق العمل...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 space-y-2">
                      <div className="text-3xl">👥</div>
                      <div className="font-bold text-sm text-slate-600">لا يوجد موظفون مسجلون حالياً</div>
                      <p className="text-xs text-slate-400">
                        استخدم النموذج المجاور لإضافة أسماء فريقك الحقيقية الآن
                      </p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp, index) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {editingId === emp.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold w-full"
                          />
                        ) : (
                          <span>{emp.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === emp.id ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold"
                          >
                            <option value="أمين مخزن">أمين مخزن</option>
                            <option value="مشرف مخزن">مشرف مخزن</option>
                            <option value="تحضير وشحن">تحضير وشحن</option>
                            <option value="استلام مرتجعات">استلام مرتجعات</option>
                            <option value="فني صيانة">فني صيانة</option>
                            <option value="لجنة جرد">لجنة جرد</option>
                            <option value="مدير تشغيل">مدير تشغيل</option>
                            <option value="مسؤول شحن">مسؤول شحن</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              roleColors[emp.role] || "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {emp.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {editingId === emp.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleUpdate(emp.id)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingId(emp.id);
                                setEditName(emp.name);
                                setEditRole(emp.role);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                              title="تعديل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
