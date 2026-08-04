import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Web3Providers } from "@/components/Web3Providers";
import { PlatformProvider } from "@/lib/data/store";
import { SessionProvider } from "@/lib/useSession";
import "./globals.css";

// Única familia tipográfica del producto. Ver design-system.md §3.
const monaSans = localFont({
  src: "../node_modules/mona-sans/Mona-Sans.woff2",
  variable: "--font-mona-sans",
  weight: "200 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Founding — invierte en empresas peruanas que ya facturan",
  description:
    "Crédito privado con garantía real. Capital retenido en contrato y liberado contra hitos verificados, liquidado en USDC sobre Arbitrum.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${monaSans.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Web3Providers>
          <SessionProvider>
            <PlatformProvider>{children}</PlatformProvider>
          </SessionProvider>
        </Web3Providers>
      </body>
    </html>
  );
}
