"use client";

import React, { useState, useEffect } from "react";
import { User, UserPlus, Check, X, Shield } from "lucide-react";
import { Employee } from "@/lib/types";

interface OperatorSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  className?: string;
  selectClassName?: string;
}

export default function OperatorSelect({
  value,
  onChange,
  required = true,
  label = "الموظف المسؤول *",
  className = "",
  selectClassName = "",
}: OperatorSelectProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("أمين مخزن");
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);

        const saved = typeof window !== "undefined" ? localStorage.getItem("deserve_current_operator") : null;
        const isSavedValid = saved && data.employees.some((e: Employee) => e.name === saved);
        const isCurrentValid = value && data.employees.some((e: Employee) => e.name === value);

        if (isSavedValid) {
          onChange(saved);
        } else if (!isCurrentValid && data.employees.length > 0) {
          const defaultEmp = data.employees[0].name;
          onChange(defaultEmp);
          if (typeof window !== "undefined") {
            localStorage.setItem("deserve_current_operator", defaultEmp);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__ADD_NEW__") {
      setIsAddModalOpen(true);
      return;
    }
    onChange(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("deserve_current_operator", val);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setAddLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Add to list and select immediately
      const addedName = newName.trim();
      await fetchEmployees();
      onChange(addedName);
      if (typeof window !== "undefined") {
        localStorage.setItem("deserve_current_operator", addedName);
      }
      setIsAddModalOpen(false);
      setNewName("");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء إضافة الموظف");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-700">{label}</label>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ موظف جديد</span>
          </button>
        </div>
      )}

      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          required={required}
          className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${selectClassName}`}
        >
          {loading ? (
            <option value="">جاري تحميل الموظفين...</option>
          ) : (
            <>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.role})
                </option>
              ))}
              <option value="__ADD_NEW__" className="text-blue-600 font-bold">
                + إضافة موظف جديد للقائمة...
              </option>
            </>
          )}
        </select>
      </div>

      {/* Quick Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-xs">إضافة موظف جديد لفريق العمل</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-4 space-y-3">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف الثلاثي *</label>
                <input
                  type="text"
                  placeholder="مثال: حسام الدين محمود"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدور / الوظيفة</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="أمين مخزن">أمين مخزن</option>
                  <option value="مشرف مخزن">مشرف مخزن</option>
                  <option value="تحضير وشحن">تحضير وشحن</option>
                  <option value="استلام مرتجعات">استلام مرتجعات</option>
                  <option value="فني صيانة">فني صيانة</option>
                  <option value="لجنة جرد">لجنة جرد</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !newName.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {addLoading ? "جاري الإضافة..." : "حفظ واختيار"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
