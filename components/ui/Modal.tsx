"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { dialog, scrim, T } from "@/lib/motion";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(16,24,40,0.45)" }}
            onClick={onClose}
          />

          <motion.div
            variants={dialog}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative max-h-[86vh] w-full overflow-y-auto rounded-[var(--r-card)] border border-border bg-surface p-5 shadow-[var(--shadow-lg)] sm:p-6"
            style={{ maxWidth: width }}
          >
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={T.fast}
              onClick={onClose}
              className="absolute right-5 top-5 text-low transition-colors hover:text-hi"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </motion.button>

            <h2 className="h2 pr-8">{title}</h2>
            {subtitle && (
              <p className="mt-1.5 text-[13px] text-mid">{subtitle}</p>
            )}

            <div className="mt-5">{children}</div>

            {footer && (
              <div className="mt-6 flex justify-end gap-2.5">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
