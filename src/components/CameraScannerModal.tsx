"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, AlertCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "مسح الباركود بكاميرا الموبايل",
}: CameraScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-container";

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current && isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            setIsScanning(false);
          })
          .catch(() => {});
      }
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        setErrorMsg(null);
        // Small delay to ensure modal DOM is painted
        await new Promise((r) => setTimeout(r, 200));

        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isMounted) {
              // Play a short beep if audio supported
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                osc.type = "sine";
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
              } catch (e) {}

              onScan(decodedText.trim());
              onClose();
            }
          },
          () => {
            // Frame error, ignore
          }
        );

        if (isMounted) setIsScanning(true);
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || "تعذر فتح الكاميرا، يرجى التأكد من إعطاء صلاحية الكاميرا للمتصفح");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch(() => {});
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {errorMsg ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 my-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div className="w-full relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">
              <div id={readerId} className="w-full h-full" />
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-amber-400/60 rounded-xl m-8 flex items-center justify-center">
                <span className="text-[11px] font-bold text-amber-300 bg-slate-950/70 px-2.5 py-1 rounded-md">
                  وجّه الكاميرا نحو الباركود
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3 text-center">
            يدعم باركودات الشنط (Code 128 / EAN) وبوالص الشحن السريعة
          </p>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
          >
            إغلاق الكاميرا
          </button>
        </div>
      </div>
    </div>
  );
}
