"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { AddFundsFlow } from "@/components/flow/AddFundsFlow";
import { SaldoDePrueba } from "@/components/flow/SaldoDePrueba";
import { Deck } from "@/components/flow/Deck";
import { DetailOverlay } from "@/components/flow/DetailOverlay";
import { Onboarding } from "@/components/flow/Onboarding";
import { PortfolioOverlay } from "@/components/flow/PortfolioOverlay";
import { ProfilePanel } from "@/components/flow/ProfilePanel";
import { TopBar } from "@/components/flow/TopBar";
import { Logo } from "@/components/ui/Logo";
import { Waiting } from "@/components/ui/Waiting";
import { usePlatform } from "@/lib/data/store";
import { useOnce } from "@/lib/useOnce";
import { useSession } from "@/lib/useSession";
import type { Opportunity } from "@/lib/types";

/**
 * Módulo único. No hay rutas ni scroll de página: todo ocurre en esta
 * pantalla mediante capas y transiciones.
 *
 * La puerta —elegir travesía y crear la wallet— NO vive acá: vive en
 * `/login`, con URL propia. Sin sesión, esta ruta manda ahí.
 *
 *   SaldoDePrueba      acreditación del saldo, en una franja que no detiene nada.
 *   Onboarding         explicación en pasos, UNA sola vez por navegador.
 *   Deck                catálogo paginado.
 *   DetailOverlay      ficha de la operación, en pasos.
 *   PortfolioOverlay   módulo dedicado: resumen, posiciones, movimientos.
 *   ProfilePanel        módulo dedicado a la cuenta y su verificación.
 */
export default function App() {
  const { session, signOut, verify, deleteAccount } =
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

  // Sin sesión, la puerta.
  //
  // Este módulo vivía en la raíz, y ahí pasaban dos cosas mal: sin sesión
  // pintaba la puerta —que también servía `/login`, o sea una pantalla en
  // dos direcciones— y con sesión mostraba el catálogo en una URL que no
  // lo nombraba. Ahora la raíz solo reparte (ver app/page.tsx) y esta
  // pantalla se llama como su titular.
  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  // Sin lado elegido se va a /rol, que es la ÚNICA pantalla que pregunta.
  //
  // Acá había un tramo entero que leía la elección adelantada en la
  // puerta, la aplicaba, y detectaba el choque cuando no coincidía con el
  // lado que la wallet ya tenía. Todo eso existía porque el login
  // preguntaba el rol antes de que la wallet existiera — o sea, la misma
  // pregunta en dos pantallas. Con la pregunta en un solo sitio, `/rol`
  // la fija cuando la wallet ya está y no hay nada que transportar, que
  // caducar, ni que reconciliar después.
  //
  // Una wallet de empresa que cayó acá (link viejo, botón "atrás") se va
  // a la suya.
  useEffect(() => {
    if (!session) return;
    if (session.role === null) router.replace("/rol");
    else if (session.role === "business") router.replace("/solicitar");
  }, [session, router]);

  // Este es el único módulo sin scroll de página (ver globals.css) — la
  // clase se agrega/quita con el ciclo de vida de esta pantalla para que
  // otras rutas (ej. /solicitar) mantengan el scroll normal.
  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  // Acá vivía la pantalla de choque de rol, y se fue con la causa: el
  // choque solo podía ocurrir porque el login preguntaba el lado antes de
  // saber a qué wallet pertenecía. Ahora `/rol` lo fija con la wallet ya
  // conectada, y una wallet con lado nunca vuelve a que le pregunten.
  //
  // `RoleConflict` sigue vivo y sirviendo a `/solicitar`, que es donde el
  // choque SÍ puede pasar: alguien abre ese enlace directo con una cuenta
  // de inversionista.

  // Resolviendo si ya había una wallet conectada (Privy). Antes esto era
  // un div en blanco — ahora al menos se ve que algo está pasando.
  // `role !== "investor"` cubre también los dos casos que ya se están
  // redirigiendo arriba (sin rol, o rol de empresa), y `session === null`
  // el tercero: mientras el navegador va camino a `/login`.
  const stillResolving =
    session === undefined ||
    session === null ||
    (session && session.role !== "investor");

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
            // Cerrar sesión lleva a `/login`, la URL que nombra la
            // puerta. Antes se quedaba en `/`: la sesión desaparecía, la
            // puerta se pintaba en su lugar y la barra de direcciones
            // seguía diciendo la raíz, o sea nada sobre lo que se está
            // viendo. Y el lado empresa salía a otra pantalla distinta —
            // ahora los dos terminan en la misma.
            onSignOut={() => {
              setProfile(false);
              signOut();
              router.replace("/login");
            }}
            onVerify={verify}
            onDeleteAccount={deleteAccount}
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
