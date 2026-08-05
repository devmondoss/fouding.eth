"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { AddFundsFlow } from "@/components/flow/AddFundsFlow";
import { AuthFlow } from "@/components/flow/AuthFlow";
import { Deck } from "@/components/flow/Deck";
import { DetailOverlay } from "@/components/flow/DetailOverlay";
import { Onboarding } from "@/components/flow/Onboarding";
import { PortfolioOverlay } from "@/components/flow/PortfolioOverlay";
import { ProfilePanel } from "@/components/flow/ProfilePanel";
import { TopBar } from "@/components/flow/TopBar";
import { usePlatform } from "@/lib/data/store";
import { useOnce } from "@/lib/useOnce";
import { useSession } from "@/lib/useSession";
import type { Opportunity } from "@/lib/types";

/**
 * Módulo único. No hay rutas ni scroll de página: todo ocurre en esta
 * pantalla mediante capas y transiciones.
 *
 *   AuthFlow          primer contacto: conexión real de wallet (wagmi). Sin chrome.
 *   Onboarding         explicación en pasos, UNA sola vez por navegador.
 *   Deck                catálogo paginado.
 *   DetailOverlay      ficha de la operación, en pasos.
 *   PortfolioOverlay   módulo dedicado: resumen, posiciones, movimientos.
 *   ProfilePanel        módulo dedicado a la cuenta y su verificación.
 */
export default function App() {
  const { session, signOut, verify } = useSession();
  const { seen, markSeen, reset } = useOnce("founding.intro");
  const { getOpportunity } = usePlatform();

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [portfolio, setPortfolio] = useState(false);
  const [profile, setProfile] = useState(false);
  const [funds, setFunds] = useState(false);

  // Resolviendo si ya había una wallet conectada (Privy). Antes esto era
  // un div en blanco — ahora al menos se ve que algo está pasando.
  if (session === undefined) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[17px] font-bold"
          style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
        >
          ✳
        </span>
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-ink)" }} />
      </div>
    );
  }

  // Sin pantalla de confirmación extra: si Privy ya reconectó la wallet
  // (recarga de página, nueva pestaña), se entra directo — la fricción
  // de "wallet instantánea" era justamente lo que este paso rompía.
  if (session === null) return <AuthFlow />;

  // Desde el portafolio: cierra el panel y abre la ficha. Sin esto, dos
  // capas al mismo z-index se pisarían entre sí.
  function openFromPortfolio(slug: string) {
    setPortfolio(false);
    const o = getOpportunity(slug);
    if (o) setSelected(o);
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <TopBar
        session={session}
        onOpenPortfolio={() => setPortfolio(true)}
        onOpenProfile={() => setProfile(true)}
        onOpenFunds={() => setFunds(true)}
        onReplayIntro={reset}
      />

      <main className="flex-1 lg:min-h-0">
        <Deck onSelect={setSelected} />
      </main>

      <AnimatePresence>
        {selected && (
          <DetailOverlay
            key={selected.id}
            o={selected}
            onClose={() => setSelected(null)}
            onOpenFunds={() => setFunds(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{funds && <AddFundsFlow onClose={() => setFunds(false)} />}</AnimatePresence>

      <AnimatePresence>
        {portfolio && (
          <PortfolioOverlay
            onClose={() => setPortfolio(false)}
            onOpenOpportunity={openFromPortfolio}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profile && (
          <ProfilePanel
            session={session}
            onClose={() => setProfile(false)}
            onSignOut={() => {
              setProfile(false);
              signOut();
            }}
            onVerify={verify}
            onReplayIntro={() => {
              setProfile(false);
              reset();
            }}
          />
        )}
      </AnimatePresence>

      {/* Solo la primera vez. Después, desde el botón de ayuda o el perfil. */}
      <AnimatePresence>
        {seen === false && <Onboarding onDone={markSeen} />}
      </AnimatePresence>
    </div>
  );
}
