# Plan de construcción — Prototipo navegable

**Objetivo:** una plataforma que se ve y se navega como el producto final, con datos simulados. Sirve para validar la idea, la UX y el pitch **antes** de escribir un solo contrato.

**Lo que NO es:** no hay blockchain, no hay wallet, no hay base de datos, no hay autenticación real. Todo eso llega después y sin reescribir las pantallas.

**Estado: fases 0 a 4 completas.** El prototipo corre en `localhost` con el flujo del inversionista de punta a punta.

---

## La regla que hizo que esto no fuera trabajo desechable

Los **tipos de dominio y la capa de acceso a datos** se definieron una sola vez, con la forma que van a tener los contratos.

```
Pantallas  →  lib/data/store.tsx (interfaz)  →  seed.ts   ← hoy
                                             →  onchain/  ← después
```

Dos decisiones que se pagaron solas:

- **Montos en `bigint`, micro-USDC.** `1_500_000_000n` = 1,500 USDC, exactamente lo que devolverá el contrato.
- **Tasas en basis points.** APY 14.5% → `1450`, igual que en Solidity.

Y una tercera que no estaba en el plan original pero resultó ser la más rentable: **los componentes nunca leen colores literales, solo tokens CSS**. El lenguaje visual cambió cuatro veces (oscuro cromático → claro cromático → monocromo mono → marketplace) y ninguna vez hubo que reescribir la lógica de las pantallas.

---

## Alcance del producto

**Solo el lado del inversionista.** No hay panel de originador ni flujo de solicitud de la empresa. Las operaciones del originador (aprobar hitos, declarar incumplimiento) existen en el dominio —el estado sembrado las refleja— pero no se exponen en la interfaz.

---

## Stack del prototipo

```
Next.js 16 (App Router) + TypeScript
Tailwind v4  +  tokens de design-system.md
Inter + IBM Plex Mono (next/font)
lucide-react
npm
```

Nada de wagmi, viem, Prisma ni Supabase todavía.

---

## Estructura de archivos

```
app/
  layout.tsx                 fuentes + PlatformProvider + AppShell
  page.tsx                   CATÁLOGO — la aplicación entera como módulos
  oportunidades/[slug]/      ficha de producto
  portafolio/                posiciones y movimientos
  acceso/                    verificación, a pantalla completa
components/
  chrome/    AppShell (marco + Container + SectionHead), TopNav
  ui/        Button, Pill, ProgressBar, Stat, Table, Field, Modal
  domain/    OpportunityCard, CollateralPanel, MilestoneTimeline,
             WaterfallPanel, ScorePanel, PassportPanel, InvestPanel,
             ActivityRow, ScoreBadge
lib/
  types.ts                   modelo de dominio
  format.ts                  formateo de montos, tasas y fechas
  opportunity.ts             selectores derivados
  underwriting.ts            scoring + waterfall (funciones puras)
  data/
    seed.ts                  6 operaciones + posiciones + actividad
    store.tsx                adaptador mock con estado en memoria
app/globals.css              tokens + utilidades
```

---

## Fases

### Fase 0 — Esqueleto y sistema visual ✅
Proyecto Next.js, tokens en `globals.css`, primitivas de superficie.

### Fase 1 — Primitivas de UI ✅
`Button`, `Pill`, `ProgressBar`, `Stat`, `Table`, `Field`, `Modal`.

> La ruta `/ui` (kitchen sink) existió durante el desarrollo y se eliminó al cerrar el lenguaje visual. Si se retoma la iteración de componentes, conviene recrearla.

### Fase 2 — Modelo de dominio y datos mock ✅
`types.ts` con el modelo completo, `underwriting.ts` con score y waterfall como **funciones puras y deterministas** —pensadas para portarse al contrato casi tal cual—, y seed con 6 operaciones que cubren los cinco estados.

**El deal en default está construido para enseñar la tesis:** cobertura de 0.95x, garantía sin inscribir, arrendamiento financiero previo, aporte propio de 15% e historial con 4 pagos tardíos. Cuando alguien pregunte "¿y si sale mal?", ese caso responde solo.

### Fase 3 — Pantallas ✅
Catálogo con filtros por estado y sector, ficha de producto, portafolio y onboarding.

### Fase 4 — Flujos simulados ✅
- **Invertir** → valida ticket mínimo y saldo, descuenta, crea la posición, registra el movimiento y avanza la barra de recaudación.
- **Vender posición** → publica y retira del libro de órdenes.
- **Recupero tras incumplimiento** → visible en el portafolio y en los movimientos, con el waterfall ya ejecutado sobre los 78,400 USDC recuperados.

### Fase 5 — Fuera del prototipo ⏳
Adaptador `onchain/` con viem, contratos en Arbitrum Sepolia, Postgres para lo sensible y whitelist real. **Las pantallas no se reescriben.**

---

## Lo que sigue simulado

Conviene tenerlo claro antes de una demo:

- **El estado vive en memoria.** Al recargar, todo vuelve al seed. Para demostrar es una ventaja; no lo confundas con persistencia.
- **No hay carga de archivos.** La evidencia de los desembolsos son nombres de archivo sembrados.
- **El libro de órdenes está a medias.** Puedes publicar una posición en venta, pero no existe el lado comprador.
- **No hay wallet ni login real.** La wallet se "genera" al entrar, sin pedir datos; el saldo y la dirección son simulados.
- **La verificación de identidad es parcial, a propósito.** Se resolvió con un **tope por nivel**: sin verificar, el tope es 5,000 USDC por operación (`UNVERIFIED_TICKET_CAP`); verificar (formulario mock en `ProfilePanel`, sin KYC real detrás) lo levanta. Es el patrón real de fintechs con KYC escalonado — no bloquea la exploración ni el ticket típico de demo, y sí cierra la contradicción con el marketplace permissioned de [start.md](start.md). Lo que **no** existe todavía: un proveedor de KYC real y una verificación obligatoria antes de cualquier inversión, sin importar el monto.
- **No se puede disparar un incumplimiento en vivo** — era una acción de originador, y ese panel se eliminó. El caso en default llega sembrado.

---

## Siguiente paso

Dos caminos, en este orden de preferencia:

1. **Cerrar el lado comprador del libro de órdenes**, que completa el argumento de liquidez del pitch.
2. **Empezar los contratos** usando `underwriting.ts` como especificación ejecutable: el score y el waterfall ya están escritos como funciones puras precisamente para eso.
