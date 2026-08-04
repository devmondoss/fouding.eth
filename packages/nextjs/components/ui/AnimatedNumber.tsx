"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { toNumber } from "@/lib/format";

/**
 * Cifra que transiciona al cambiar. Es el detalle que más hace sentir que
 * detrás hay una cuenta viva: cuando inviertes, el saldo no salta, baja.
 *
 * Acepta bigint (micro-USDC) o number.
 */
export function AnimatedNumber({
  value,
  from,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: bigint | number;
  /** Valor inicial explícito. Sin esto, una instancia recién montada arranca
   * ya en el valor final y no hay nada que animar. */
  from?: bigint | number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const target = typeof value === "bigint" ? toNumber(value) : value;
  const start = from != null ? (typeof from === "bigint" ? toNumber(from) : from) : target;
  const mv = useMotionValue(start);

  const text = useTransform(mv, (v) =>
    `${prefix}${new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v)}${suffix}`,
  );

  useEffect(() => {
    const controls = animate(mv, target, {
      duration: 0.7,
      ease: [0.22, 0.9, 0.3, 1],
    });
    return () => controls.stop();
  }, [target, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
