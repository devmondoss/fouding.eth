"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { AddFundsFlow } from "@/components/flow/AddFundsFlow";
import { SaldoDePrueba } from "@/components/flow/SaldoDePrueba";
import { RoleConflict } from "@/components/flow/RoleConflict";
import { StandGate } from "@/components/flow/StandGate";
import { Deck } from "@/components/flow/Deck";
import { DetailOverlay } from "@/components/flow/DetailOverlay";
import { Onboarding } from "@/components/flow/Onboarding";
import { PortfolioOverlay } from "@/components/flow/PortfolioOverlay";
import { ProfilePanel } from "@/components/flow/ProfilePanel";
import { TopBar } from "@/components/flow/TopBar";
import { Logo } from "@/components/ui/Logo";
import { Waiting } from "@/components/ui/Waiting";
import { usePlatform } from "@/lib/data/store";
import { clearIntendedRole, readIntendedRole } from "@/lib/intendedRole";
import { useOnce } from "@/lib/useOnce";
import { useSession, type Role } from "@/lib/useSession";
import type { Opportunity } from "@/lib/types";

/**
 * Módulo único. No hay rutas ni scroll de página: todo ocurre en esta
 * pantalla mediante capas y transiciones.
 *
 *   StandGate          primer contacto: se elige travesía y la wallet se crea
 *                      como consecuencia. Sin chrome.
 *   SaldoDePrueba      acreditación del saldo, en una franja que no detiene nada.
 *   Onboarding         explicación en pasos, UNA sola vez por navegador.
 *   Deck                catálogo paginado.
 *   DetailOverlay      ficha de la operación, en pasos.
 *   PortfolioOverlay   módulo dedicado: resumen, posiciones, movimientos.
 *   ProfilePanel        módulo dedicado a la cuenta y su verificación.
 */
export default function App() {
  const { session, signOut, verify, deleteAccount, chooseRole, switchAccount } =
    useSession();
  const { seen, markSeen, reset } = useOnce("founding.intro");
  const { getOpportunity } = usePlatform();
  const router = useRouter();

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [portfolio, setPortfolio] = useState(false);
  const [profile, setProfile] = useState(false);
  const [funds, setFunds] = useState(false);
  // El panel de cuenta puede abrirse ya en el formulario de acceso, para que
  // el bloqueo de verificación de InvestPanel tenga una puerta y no solo un
  // texto rojo.
  const [profileAskingAccess, setProfileAskingAccess] = useState(false);
  /** El lado que se pidió cuando esta cuenta pertenece al otro. Null =
   *  sin choque. Ver RoleConflict. */
  const [choque, setChoque] = useState<Role | null>(null);

  // El rol ya se eligió en la puerta, antes de que existiera la wallet
  // (StandGate). Acá solo se aplica: la elección viajó en localStorage
  // porque en el medio hubo un modal de Privy. Quien llegó sin elección
  // guardada —link directo, sesión vieja de antes de este cambio— sí va a
  // /rol, que sigue siendo la pantalla de la pregunta.
  //
  // Una wallet de empresa que cayó acá (link viejo, botón "atrás") se va
  // a la suya.
  useEffect(() => {
    if (!session) return;

    if (session.role === null) {
      const intended = readIntendedRole();
      if (intended) {
        clearIntendedRole();
        chooseRole(intended);
      } else {
        router.replace("/rol");
      }
      return;
    }

    // La wallet ya tiene lado. Si además había una intención guardada y
    // NO coincide, alguien pidió entrar por la puerta equivocada: se le
    // dice, no se lo redirige y ya (ver RoleConflict).
    const intended = readIntendedRole();
    if (intended && intended !== session.role) {
      clearIntendedRole();
      setChoque(intended);
      return;
    }
    if (intended) clearIntendedRole();

    if (session.role === "business") router.replace("/solicitar");
  }, [session, router, chooseRole]);

  // Este es el único módulo sin scroll de página (ver globals.css) — la
  // clase se agrega/quita con el ciclo de vida de esta pantalla para que
  // otras rutas (ej. /solicitar) mantengan el scroll normal.
  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  // Pidió un lado que esta cuenta no puede tomar. Va ANTES de todo lo
  // demás, incluida la espera: una cuenta de empresa que pidió entrar como
  // inversionista tiene `role !== "investor"`, o sea que cae en
  // `stillResolving` — y como el efecto de arriba corta sin redirigir
  // cuando hay choque, se quedaba en "Entrando" para siempre. El choque no
  // es un estado intermedio que se vaya a resolver solo; es el final del
  // camino, y tiene que ganarle a la espera.
  if (choque && session?.role) {
    return (
      <RoleConflict
        pedido={choque}
        real={session.role}
        onContinuar={() => {
          setChoque(null);
          if (session.role === "business") router.replace("/solicitar");
        }}
        onOtraCuenta={() => {
          setChoque(null);
          switchAccount();
        }}
      />
    );
  }

  // Resolviendo si ya había una wallet conectada (Privy). Antes esto era
  // un div en blanco — ahora al menos se ve que algo está pasando.
  // `role !== "investor"` cubre también los dos casos que ya se están
  // redirigiendo arriba (sin rol, o rol de empresa).
  const stillResolving =
    session === undefined || (session && session.role !== "investor");

  // `seen === null` ("todavía no sabemos si ya vio el onboarding", ver
  // useOnce) solo importa una vez que YA vamos a mostrar el shell
  // principal — nunca antes del login. Si no, mientras el navegador
  // resuelve ese flag, el Deck/TopBar alcanzan a pintarse un frame sin
  // Onboarding encima (la condición `seen === false` es falsa cuando
  // `seen` todavía es `null`), y recién después aparece Onboarding
  // tapándolos: se ve como si "el contenido de atrás" apareciera antes
  // de terminar. Bloqueamos ese frame acá.
  const stillResolvingOnboarding = session !== null && !stillResolving && seen === null;

  if (stillResolving || stillResolvingOnboarding) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* La marca sale de un solo sitio y la espera es la misma regla que
            en el resto del producto — no un spinner suelto. */}
        <Logo size={36} />
        <Waiting label="Entrando" />
      </div>
    );
  }

  // Sin pantalla de confirmación extra: si Privy ya reconectó la wallet
  // (recarga de página, nueva pestaña), se entra directo — la fricción
  // de "wallet instantánea" era justamente lo que este paso rompía.
  //
  // La puerta ya no pide una wallet: pide una travesía. Ver StandGate.
  if (session === null) return <StandGate />;


  // Desde el portafolio: cierra el panel y abre la ficha. Sin esto, dos
  // capas al mismo z-index se pisarían entre sí.
  function openFromPortfolio(slug: string) {
    setPortfolio(false);
    const o = getOpportunity(slug);
    if (o) setSelected(o);
  }

  return (
    // El shell es una sola pantalla en los dos tamaños. En el teléfono
    // usa svh y no vh: con vh, la barra de direcciones del navegador se
    // come el pie de la pila y la última carta queda cortada.
    <div className="flex h-[100svh] flex-col overflow-hidden">
      <TopBar
        session={session}
        onOpenPortfolio={() => setPortfolio(true)}
        onOpenProfile={() => setProfile(true)}
        onOpenFunds={() => setFunds(true)}
        onReplayIntro={reset}
      />

      <main className="min-h-0 flex-1">
        <Deck onSelect={setSelected} />
      </main>

      <AnimatePresence>
        {selected && (
          <DetailOverlay
            key={selected.id}
            o={selected}
            onClose={() => setSelected(null)}
            onOpenFunds={() => setFunds(true)}
            onRequestAccess={() => {
              setProfileAskingAccess(true);
              setProfile(true);
            }}
            // La ficha se cierra: el flujo termina en el portafolio, no
            // encima de la operación que acabas de fondear.
            onOpenPortfolio={() => {
              setSelected(null);
              setPortfolio(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{funds && <AddFundsFlow onClose={() => setFunds(false)} />}</AnimatePresence>
      {/* La acreditación del saldo corre detrás del catálogo, no delante:
          entrar no puede depender de que la red confirme. Ver SaldoDePrueba. */}
      <SaldoDePrueba />

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
            openAccessRequest={profileAskingAccess}
            onClose={() => {
              setProfile(false);
              setProfileAskingAccess(false);
            }}
            onSignOut={() => {
              setProfile(false);
              signOut();
            }}
            onVerify={verify}
            onDeleteAccount={deleteAccount}
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
