import type { Metadata } from "next";
import localFont from "next/font/local";
import { PlatformProvider } from "@/lib/data/store";
import { SessionProvider } from "@/lib/useSession";
import { Web3Provider } from "@/components/providers/Web3Provider";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
