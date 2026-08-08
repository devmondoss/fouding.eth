# Stack técnico — private credit tokenizado sobre Arbitrum

Documento complementario a [start.md](start.md). Define qué herramientas se usan, **por qué**, y sobre todo **cuáles no hacen falta todavía**.

## Criterio de decisión

Cada herramienta se clasifica así:

| Etiqueta | Significado |
| --- | --- |
| **Imprescindible** | Sin esto no existe el producto. Va en el MVP. |
| **Recomendado** | Ahorra tiempo real o evita un riesgo concreto. Va en el MVP si hay margen. |
| **Después** | Correcto conceptualmente, pero no aporta en fase 1. Diferir. |
| **Evitar** | Suma superficie de ataque, costo o complejidad sin beneficio proporcional. |

Regla general del proyecto: **el riesgo aquí es legal y crediticio, no técnico**. Cada hora gastada en infraestructura exótica es una hora que no se gastó en el wrapper legal, el underwriting y la política de haircuts. El stack debe ser aburrido a propósito.

---

## 1. Blockchain y capa de settlement

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Arbitrum One** | Imprescindible | Es la tesis del proyecto. Fees bajos para el patrón real de uso (muchos eventos pequeños: aportes, hitos, distribuciones), EVM equivalente y ecosistema de tokenización activo. |
| **Arbitrum Sepolia** | Imprescindible | Todo el desarrollo y la demo van acá. No desplegar a mainnet hasta tener el SPV constituido. |
| **USDC (nativo, Circle)** | Imprescindible | Usar el USDC nativo de Arbitrum (`0xaf88d0...5831`), **no** el bridgeado USDC.e. Confusión entre ambos = fondos atrapados. En Sepolia, USDC de testnet de Circle. |
| **Otras L2 / multichain** | Evitar | Multiplica auditoría y liquidez fragmentada para cero valor en fase 1. |
| **Chain propia / appchain (Orbit)** | Evitar | Ni el volumen ni el argumento regulatorio lo justifican todavía. |

---

## 2. Smart contracts

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Solidity** | Imprescindible | Default del ecosistema. No hay razón para Vyper/Stylus acá. |
| **Foundry** (forge, cast, anvil) | Imprescindible | Tests en Solidity, fuzzing incluido, fork testing contra Arbitrum real para probar contra el USDC de verdad. Más rápido que Hardhat para un equipo que ya escribe Solidity. |
| **Hardhat** | Evitar (si usas Foundry) | Solo si el equipo es fuertemente JS y no quiere escribir tests en Solidity. Mantener los dos es desperdicio. |
| **OpenZeppelin Contracts** | Imprescindible | `SafeERC20`, `AccessControl`, `Pausable`, `ReentrancyGuard`. No reimplementar nada de esto a mano. |
| **Slither** | Recomendado | Análisis estático gratis, corre en segundos, atrapa lo obvio. Sustituto parcial y barato de una auditoría que no vas a pagar en fase 1. |
| **Safe (ex-Gnosis Safe)** | Imprescindible | El aprobador de hitos y el admin del escrow **no pueden ser una EOA**. Un Safe 2-de-3 o 3-de-5 es la diferencia entre "plataforma" y "el dev tiene las llaves". Es un punto del pitch, no solo técnico. |
| **Auditoría profesional** | Después | Requisito antes de mainnet con dinero real de terceros. Presupuestar, no ejecutar ahora. |

### Contratos del MVP (alcance mínimo)

Tres contratos, no más:

1. **`OpportunityFactory`** — despliega una oportunidad por deal, registra parámetros (monto objetivo, plazo, APY, hash del legal pack).
2. **`Opportunity`** — recauda USDC, mintea el token de derecho económico, mantiene el escrow, libera por hito, recibe repagos y habilita el claim.
3. **`Whitelist` / `AccessRegistry`** — quién puede invertir. Consultado por el resto.

Todo `Pausable` con el Safe como pauser. Sin upgradeability en fase 1: un proxy mal configurado es peor riesgo que redesplegar.

### Estándar del token

| Opción | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **ERC-20 con transferencias restringidas** | Imprescindible | Un token por oportunidad. Como en fase 1 **no hay mercado secundario**, el `_update`/`transfer` puede bloquear todo salvo mint y burn. Un token intransferible elimina de golpe casi todo el problema regulatorio de circulación. Esto es una ventaja, no una limitación — dilo así en el pitch. |
| **ERC-1155** | Después | Tiene sentido cuando haya decenas de deals vivos y quieras un solo contrato. En fase 1 complica el mental model del inversionista. |
| **ERC-3643 / ERC-1400** | Después | Es el estándar "correcto" para securities permissioned y el destino natural del producto. También es pesado: ONCHAINID, módulos de compliance, claim issuers. Migrar cuando exista el SPV y un abogado lo pida. Mencionarlo en el roadmap suma credibilidad. |
| **NFT por posición (ERC-721)** | Evitar | Solo si quisieras posiciones transferibles individuales. No es el caso. |

---

## 3. Frontend

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Next.js (App Router) + TypeScript** | Imprescindible | Necesitas server-side real para KYC, documentos privados y lógica de originador. Un SPA puro no sirve: expondría cosas que no deben salir del servidor. |
| **viem** | Imprescindible | Cliente Ethereum tipado. Base de todo lo demás. |
| **wagmi** | Imprescindible | Hooks de React sobre viem. Escribirlos a mano no aporta nada. |
| **RainbowKit** (o ConnectKit) | Recomendado | Conexión de wallet resuelta en una tarde. Elegir uno y no discutirlo. |
| **Tailwind v4** | Imprescindible | Los tokens del sistema viven en `@theme inline` sobre variables CSS. Es lo que permitió cambiar el lenguaje visual entero cuatro veces sin reescribir componentes. |
| **shadcn/ui** | Descartado por ahora | Se evaluó, pero los componentes del producto (tarjeta de oportunidad, waterfall, cronograma de desembolsos) son de dominio, no genéricos. Los primitivos propios en `components/ui/` son ~200 líneas en total y no arrastran dependencias. |
| **Sistema visual: marketplace de inversión** | Imprescindible — **decisión cerrada** | Superficies blancas sobre gris claro, azul corporativo como único color de marca, Mona Sans como única tipografía. Definido en [design-system.md](design-system.md). |
| **TanStack Query** | Recomendado | Ya viene con wagmi; úsalo también para los datos offchain y unificas el manejo de estado async. |
| **Recharts / visualización** | Recomendado | Coverage ratio, waterfall y avance de hitos se entienden mucho mejor en gráfico. Es el punto donde el inversionista decide. |
| **Redux / Zustand / state manager global** | Evitar | El estado real vive en la chain y en el servidor. No dupliques. |
| **App móvil nativa** | Evitar | El usuario es un CFO en un escritorio. Web responsive basta. |

---

## 4. Backend, datos y documentos

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **PostgreSQL** (Supabase o Neon) | Imprescindible | KYC, datos de la empresa, ventas, tasación, documentación y decisiones del originador **no pueden ir onchain**: es PII y es información comercial sensible. Necesitas base de datos, no hay atajo. |
| **Prisma o Drizzle** | Recomendado | ORM tipado sobre Postgres. Drizzle si quieres SQL más cerca; Prisma si quieres velocidad. Cualquiera sirve. |
| **Supabase Storage / S3 privado** | Imprescindible | Documentos legales, títulos de propiedad, gravámenes, facturas. Acceso con URLs firmadas y expiración. |
| **Hash del legal pack onchain** | Imprescindible | El documento queda privado; el `keccak256` del paquete se ancla en el contrato de la oportunidad. Da inmutabilidad y auditoría sin filtrar nada. Es el patrón correcto y es barato. |
| **IPFS / Arweave para los documentos** | Evitar | Publicar títulos de propiedad, RUC y contratos en almacenamiento público e inmutable es un problema de datos personales, no una feature. Solo para metadata pública ya sanitizada, si acaso. |
| **NextAuth / Clerk / Privy** | Recomendado | Wallet + email para el rol de empresa y originador, que no necesariamente son cripto-nativos. Privy si quieres embedded wallets; Clerk si el rol se autentica normal y firma aparte. |
| **Microservicios / colas / Kafka** | Evitar | Volumen de decenas de operaciones al mes. Una app Next.js con Postgres sobra durante años. |

---

## 5. Indexación y lectura de estado

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Lectura directa con viem** | Imprescindible en MVP | Con pocas oportunidades vivas, leer `getLogs` y llamar view functions es suficiente. Empieza acá. |
| **Ponder** | Recomendado | Cuando el historial de eventos se vuelva lento de leer. Indexer en TypeScript que escribe a tu mismo Postgres — encaja sin cambiar el stack. |
| **The Graph (subgraph)** | Después | Solo si quieres que terceros consulten los datos. Suma valor de narrativa, no de producto. |
| **Alchemy / QuickNode (RPC)** | Imprescindible | El RPC público de Arbitrum tiene rate limits que te van a morder en demo. Un plan gratis de Alchemy alcanza. |
| **Dune** | Recomendado (post-mainnet) | Un dashboard público de capital desplegado, hitos liberados y repagos es exactamente el argumento de transparencia del pitch, y es visible para el ecosistema Arbitrum. Cuesta poco y comunica mucho. Sin datos en mainnet, no tiene sentido aún. |

---

## 6. Compliance y acceso

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Whitelist manual onchain** | Imprescindible en MVP | El originador aprueba y agrega la dirección al registry desde el Safe. Es permissioned de verdad, sin depender de un proveedor. |
| **Sumsub / Persona / Didit** | Después | KYC/AML automatizado. Necesario para escalar y para hablar en serio con un regulador; innecesario para 10 inversionistas verificados a mano. Diseña el registry para que enchufar esto después no requiera redesplegar. |
| **Screening de sanciones (Chainalysis, TRM)** | Después | Va junto al KYC automatizado. En fase 1, revisión manual documentada. |
| **Oracles (Chainlink)** | Evitar | La validación de hitos es **documental y humana** por diseño. Un oracle no puede verificar que se instaló una máquina. Meterlo sería teatro técnico y contradice lo que dice el pitch. |
| **Proof of Reserve onchain del colateral** | Evitar | La garantía es maquinaria e inmuebles bajo un SPV. No hay nada que un feed pueda probar. Afirmarlo sería justo una de las promesas que [start.md](start.md) dice no hacer. |

---

## 7. Infraestructura y operación

| Herramienta | ¿Necesaria? | Justificación |
| --- | --- | --- |
| **Vercel** | Recomendado | Deploy de Next.js sin fricción. Cualquier alternativa sirve; no gastes decisión acá. |
| **GitHub Actions** | Recomendado | Correr `forge test` y `slither` en cada PR. Barato y evita el clásico "compilaba en mi máquina". |
| **Arbiscan verification** | Imprescindible | Contratos sin verificar en una plataforma que pide confianza financiera es contradictorio. |
| **Tenderly** | Recomendado | Simulación y alertas de transacciones. Muy útil para depurar el flujo de escrow y para monitorear en producción. |
| **Sentry** | Después | Cuando haya usuarios reales rompiendo cosas. |
| **Kubernetes / Docker orquestado** | Evitar | No. |

---

## Stack mínimo del MVP

Si hay que elegir lo que sí o sí se construye:

```
Contratos     Solidity + Foundry + OpenZeppelin  →  Arbitrum Sepolia
Custodia      Safe multisig (pauser + aprobador de hitos)
Token         ERC-20 intransferible, uno por oportunidad
Settlement    USDC nativo
Frontend      Next.js + TypeScript + wagmi/viem + RainbowKit + Tailwind/shadcn
Backend       Next.js API routes + Postgres (Supabase) + Storage privado
Anclaje       keccak256 del legal pack en el contrato de la oportunidad
Acceso        Whitelist onchain gestionada desde el Safe
Infra         Vercel + Alchemy RPC + GitHub Actions + Arbiscan verificado
```

Todo lo demás es fase 2.

---

## Lo que deliberadamente no está en el stack

Vale la pena poder explicar cada ausencia, porque en una demo alguien va a preguntar:

- **Sin oracles**: los hitos son documentales; automatizarlos sería fingir una garantía que no existe.
- **Sin mercado secundario ni AMM**: el token es intransferible en fase 1. Es una decisión regulatoria, no una carencia.
- **Sin gobernanza ni token propio**: el negocio son fees de estructuración, no un token de plataforma.
- **Sin upgradeability**: contratos simples e inmutables por deal. Se redespliega por oportunidad.
- **Sin liquidación automática del colateral**: la ejecuta el SPV en el mundo real. El contrato solo distribuye lo que efectivamente ingresa.
- **Sin documentos en IPFS público**: hay PII de por medio.

Estas ausencias son coherentes con el posicionamiento de [start.md](start.md): la blockchain aporta coordinación, trazabilidad y settlement, no sustituye al originador ni al wrapper legal.
