"use client";

/**
 * Respaldo cuando el error ocurre en el layout raíz mismo (ej.
 * Web3Provider/PrivyProvider revienta al montar) — ahí arriba
 * app/error.tsx no alcanza a atraparlo porque el layout que lo envuelve
 * ya no está. Next.js exige que este archivo defina su propio
 * <html>/<body>. Deliberadamente sin dependencias de componentes
 * (motion, providers) para que funcione incluso si esas son la causa
 * del crash — solo HTML y estilo inline.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          height: "100%",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#F6F7F9",
          color: "#00272B",
        }}
      >
        <div
          style={{
            maxWidth: 400,
            textAlign: "center",
            padding: 24,
            border: "1px solid #E4E7EC",
            borderRadius: 10,
            background: "#FFFFFF",
          }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            La plataforma no pudo cargar
          </h1>
          <p style={{ fontSize: 13, color: "#475467", marginTop: 8 }}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              width: "100%",
              height: 40,
              borderRadius: 8,
              border: "none",
              background: "#E0FF4F",
              color: "#00272B",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
