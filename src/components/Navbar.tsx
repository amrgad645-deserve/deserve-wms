"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Inbox, 
  RotateCcw, 
  AlertTriangle, 
  ClipboardCheck, 
  History,
  Layers,
  Tag,
  Wrench,
  Globe,
  Database,
  Menu,
  X,
  Users
} from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainLinks = [
    { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/dispatch", label: "صرف الأوردرات", icon: Truck, highlight: true },
    { href: "/stock", label: "المخزون", icon: Package },
    { href: "/bundles", label: "الأطقم", icon: Layers },
    { href: "/labels", label: "الباركود", icon: Tag },
    { href: "/shipping", label: "الشحن", icon: Truck },
    { href: "/workshop", label: "الصيانة", icon: Wrench },
    { href: "/receive", label: "الاستلام", icon: Inbox },
    { href: "/returns", label: "المرتجع", icon: RotateCcw },
    { href: "/audit", label: "الجرد", icon: ClipboardCheck },
    { href: "/employees", label: "الموظفين", icon: Users },
    { href: "/movements", label: "السجل", icon: History },
    { href: "/integrations", label: "الربط", icon: Globe },
    { href: "/backup", label: "النسخ", icon: Database },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black tracking-wider text-lg text-white shadow-lg shadow-blue-500/30">
                D
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-wider text-white">DESERVE</span>
                <span className="text-[9px] uppercase tracking-widest text-blue-400 font-semibold -mt-1">WMS Pro</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden xl:flex items-center space-x-1 space-x-reverse overflow-x-auto py-1">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black"
                      : link.highlight
                      ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Tablet & Medium devices compact menu button */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mainLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 text-blue-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}