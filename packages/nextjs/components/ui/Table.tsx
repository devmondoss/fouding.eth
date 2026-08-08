import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-soft">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  width,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
}) {
  return (
    <th
      style={{ textAlign: align, width }}
      className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-low"
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  // Una fila clicable tiene que ser alcanzable con teclado: sin rol, sin
  // tabIndex y sin manejador de tecla, `onClick` en un <tr> es un control
  // que solo existe para quien usa mouse.
  return (
    <tr
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`border-b border-border last:border-b-0 transition-colors ${
        onClick ? "focusable cursor-pointer hover:bg-surface-soft" : ""
      }`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  num = false,
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  num?: boolean;
  className?: string;
}) {
  return (
    <td
      style={{ textAlign: align }}
      className={`px-4 py-3 text-[13px] text-hi ${num ? "num" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
