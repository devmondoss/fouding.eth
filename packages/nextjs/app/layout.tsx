import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { PlatformProvider } from "@/lib/data/store";
import { SessionProvider } from "@/lib/useSession";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

// Única familia tipográfica del producto. Ver docs/design-system.md §3.
const monaSans = localFont({
  src: "../node_modules/mona-sans/Mona-Sans.woff2",
  variable: "--font-mona-sans",
  weight: "200 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Árbitro — invierte en empresas peruanas que ya facturan",
  description:
    "Crédito privado con garantía real. Capital retenido en contrato y liberado contra hitos verificados, liquidado en USDC sobre Arbitrum.",
  // La tarjeta del enlace compartido: acá sí entra el logo completo con su
  // fondo oscuro, que es para lo que fue hecho. En la barra de la app no
  // cabe — ver components/ui/Logo.tsx.
  openGraph: {
    title: "Árbitro — crédito privado con garantía real",
    description:
      "El capital se libera contra hitos verificados. Si la empresa no paga, el orden en que cobra cada uno lo ejecuta el contrato.",
    images: [{ url: "/arbitro-og.png", width: 1672, height: 941 }],
  },
};

/**
 * Viewport. Next ya inyecta `width=device-width, initial-scale=1` por su
 * cuenta; esto lo declara explícito para poder agregar lo que falta.
 *
 * `viewportFit: "cover"` es lo nuevo: sin él, en un teléfono con muesca
 * el navegador reserva franjas a los lados y el shell —que es de ancho
 * completo y sin scroll— queda enmarcado en gris.
 *
 * **`userScalable` y `maximumScale` NO se tocan**, aunque el atajo esté
 * a una línea. Apagar el zoom mata el involuntario y también el
 * deliberado: quien no ve bien deja de poder agrandar y el producto se
 * le vuelve inaccesible (WCAG 1.4.4 pide poder llegar al 200%). El zoom
 * involuntario que sí molestaba —el que dispara iOS al enfocar un campo
 * de menos de 16px— está corregido en su causa, en globals.css.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// PrivyProvider valida el App ID al montarse. Localmente compila estático
// porque .env.local tiene el App ID real, pero NO sabemos si Vercel tiene
// NEXT_PUBLIC_PRIVY_APP_ID configurado en sus env vars — si no lo tiene,
// sacar esto rompe el build ahí igual que antes. Se puede quitar cuando
// se confirme que esa env var está en el proyecto de Vercel.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${monaSans.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Web3Provider>
          <SessionProvider>
            <PlatformProvider>{children}</PlatformProvider>
          </SessionProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
