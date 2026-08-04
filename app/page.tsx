"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
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
 *   AuthFlow          primer contacto: wallet generada al instante. Sin chrome.
 *   Onboarding         explicación en pasos, UNA sola vez por navegador.
 *   Deck                catálogo paginado.
 *   DetailOverlay      ficha de la operación, en pasos.
 *   PortfolioOverlay   módulo dedicado: resumen, posiciones, movimientos.
 *   ProfilePanel        módulo dedicado a la cuenta y su verificación.
 */
export default function App() {
  const { session, signIn, signOut, verify } = useSession();
  const { seen, markSeen, reset } = useOnce("founding.intro");
  const { getOpportunity } = usePlatform();

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [portfolio, setPortfolio] = useState(false);
  const [profile, setProfile] = useState(false);
  const [funds, setFunds] = useState(false);

  // Leyendo almacenamiento: nada, para no parpadear.
  if (session === undefined) return <div className="h-screen" />;

  if (session === null) return <AuthFlow onDone={signIn} />;

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
