# Plan de ejecución — Track Arbitrum

Alcance del MVP ajustado a los criterios de evaluación. Complementa [start.md](start.md), [stack.md](stack.md) y [design-system.md](design-system.md).

**Categoría de postulación:** DeFi e Infraestructura Financiera → **RWA**. Encaje directo, sin forzar.

---

## 1. Lectura de los criterios

| Criterio | Peso | Dónde se gana | Estado hoy |
| --- | --- | --- | --- |
| Implementación técnica | 25% | Contratos que funcionan de punta a punta, con tests y verificados | Por construir |
| Uso de Arbitrum | 20% | Arbitrum como capa de settlement, no como decorado | Diseñado |
| Impacto del problema | 20% | Brecha de crédito PyME en Latam, con cifras citables | **Falta la cifra dura** |
| Innovación con Blockchain | 15% | Escrow por hitos + waterfall ejecutado onchain | Diseñado |
| Experiencia del Usuario | 15% | Sistema de diseño ya cerrado | Ventaja real |
| Presentación Final | 5% | Demo de 3 minutos con el camino de default incluido | Por armar |

**Implementación técnica + Uso de Arbitrum = 45%.** Casi la mitad del puntaje exige código desplegado y funcionando. Todo lo que no sea eso es secundario hasta que eso esté vivo.

**Impacto + Innovación = 35%** y es donde el proyecto ya es fuerte por diseño — pero solo si se cuenta bien.

---

## 2. El argumento de "Uso de Arbitrum" (20%)

Es el criterio donde más proyectos pierden puntos, porque despliegan en Arbitrum sin poder explicar por qué no en cualquier otra parte. Nuestro argumento es cuantificable y hay que ponerlo en el pitch con números medidos, no adjetivos:

Una operación de este producto no es *una* transacción. Es **N aportes + 4 a 6 liberaciones por hitos + N distribuciones pro-rata + eventos de repago**. Con 40 inversionistas, un solo deal genera cientos de transferencias de USDC. Ese patrón —muchos eventos pequeños y frecuentes— es económicamente inviable en L1 y trivial en Arbitrum.

**Acción concreta:** medir el gas real del ciclo completo con `forge test --gas-report`, y mostrar en la demo la comparación de costo del mismo flujo en L1 vs Arbitrum. Un número medido vale más que la frase "usamos Arbitrum por sus fees bajos".

Además: USDC nativo de Circle, contratos verificados en Arbiscan, y todo el settlement onchain.

---

## 3. Alcance del MVP: qué entra y qué se corta

### Entra — el camino completo

Un deal, tres roles, dos finales. Esto es lo mínimo que demuestra la tesis:

**Contratos**
- `OpportunityFactory` — despliega el deal, ancla el `keccak256` del legal pack.
- `Opportunity` — recauda USDC, mintea posiciones, escrow, libera por hito, repago, distribución.
- `AccessRegistry` — whitelist de inversionistas.
- Posición: ERC-20 **intransferible**, una por oportunidad.
- Waterfall de default **ejecutado en el contrato**, no en un PDF.
- `Pausable` con multisig como pauser.

**Frontend** — tres vistas, ninguna más:
1. Marketplace (grid de oportunidades con coverage ratio y avance de fondeo).
2. Detalle de oportunidad (colateral, hitos, waterfall, invertir).
3. Panel de originador (aprobar hito, disparar default).

### Se corta — y se explica en el roadmap

| Se corta | Por qué no cuesta puntos |
| --- | --- |
| KYC automatizado (Sumsub/Persona) | Whitelist manual desde el multisig es permissioned de verdad. El registry queda diseñado para enchufarlo después. |
| Indexer (Ponder / The Graph) | Un deal en la demo. `getLogs` con viem sobra. |
| ERC-3643 | Va en el roadmap de la presentación: suma credibilidad sin costar tiempo. |
| Mercado secundario | Ya está excluido por diseño en fase 1. |
| Auditoría | Se declara como paso previo a mainnet. |
| Multi-deal simultáneo | Se muestra un grid con datos sembrados; solo uno se opera en vivo. |

### El punto delicado: el SPV no va a existir

No se constituye un SPV en un hackathon. **No lo escondas — es un punto a favor si se dice bien.**

En la demo: mostrar el legal pack como documento diseñado (term sheet, contrato de garantía, estructura del vehículo), con su hash anclado onchain y verificable en la UI. El mensaje al jurado: *"la ejecutabilidad vive en el papel y nosotros anclamos ese papel a la cadena; sabemos exactamente qué parte del problema resuelve el contrato y cuál no"*.

Eso es coherente con la sección "qué no debe prometer el pitch" de [start.md](start.md), y separa el proyecto de los que afirman que el smart contract liquida el colateral solo.

---

## 4. Orden de construcción

Estrictamente en este orden. No pasar al siguiente bloque sin cerrar el anterior.

**Bloque 0 — Destrabar riesgos (primero que nada)**
- Confirmar que el **multisig funciona en Arbitrum Sepolia**. Si Safe no está disponible ahí, cae a un multisig 2-de-3 propio y mínimo. Descubrir esto tarde bloquea la demo entera.
- Conseguir USDC de testnet de Circle en Arbitrum Sepolia y validar el faucet.
- Repo, Foundry, deploy de un contrato vacío verificado en Arbiscan. Cierra el circuito completo antes de escribir lógica.

**Bloque 1 — El núcleo (esto es el 25%)**
- Los tres contratos, con el ciclo feliz completo: fondeo → escrow → hito → repago → claim.
- Tests en Foundry con fork de Arbitrum contra el USDC real.
- Camino de default con el waterfall.

**Bloque 2 — Lo visible (esto es el 15% de UX)**
- `globals.css` con los tokens de [design-system.md](design-system.md), y los componentes base: `ChromaLight`, `GlassCard`, `StatusPill`.
- Las tres vistas. Datos sembrados para que el marketplace no se vea vacío.

**Bloque 3 — El ciclo completo en vivo**
- Conexión wallet, flujo de inversión real, aprobación de hito desde el multisig, distribución.
- Reporte de gas medido.

**Bloque 4 — La presentación (5%, pero define cómo se lee todo lo anterior)**
- Guion, grabación, README.

**Regla de corte:** si el Bloque 1 no está cerrado a mitad del tiempo disponible, se recorta funcionalidad —no calidad— del Bloque 2. Una demo con dos vistas impecables supera a una con cinco a medias.

---

## 5. Guion de demo (3 minutos)

El error clásico es mostrar solo el camino feliz. Nuestro diferenciador está en el otro.

1. **0:00-0:25 — El problema.** Una PyME peruana con ventas reales y una máquina como activo no consigue financiar un proyecto concreto. Acá va la cifra dura de la brecha de crédito.
2. **0:25-0:50 — La empresa** publica la oportunidad: monto, plazo, APY, colateral con haircut, coverage ratio, cronograma de hitos.
3. **0:50-1:30 — El inversionista** entra al marketplace, revisa el deal, invierte USDC. El capital **queda en escrow**, no llega a la empresa. Este es el momento clave: mostrar el balance del contrato.
4. **1:30-2:00 — El hito.** El originador aprueba desde el multisig con evidencia documental. El contrato libera solo el tramo correspondiente. Se ve la transacción en Arbiscan.
5. **2:00-2:35 — El default.** Se dispara el escenario, el SPV liquida offchain, ingresa el recupero y **el contrato ejecuta el waterfall**: costos → servicing → principal → intereses. El inversionista recupera parcialmente. *Nadie más va a mostrar esto.*
6. **2:35-3:00 — El cierre.** Por qué Arbitrum, con el número de gas medido. Qué es honestamente offchain (el SPV, el underwriting). Roadmap: ERC-3643, KYC automatizado, secundario.

---

## 6. El bounty de Stylus

**Recomendación: no, salvo que sobre tiempo y alguien del equipo escriba Rust con soltura.**

Existe un uso defendible —la distribución pro-rata del waterfall sobre N inversionistas es un bucle pesado en Solidity y Stylus lo abarata de verdad— pero es una segunda base de código, con su propio toolchain y sus propios bugs. Un Stylus a medias castiga el 25% de implementación técnica, que pesa más que el bounty.

**Criterio de decisión:** si el Bloque 3 está cerrado y aún queda tiempo, portar únicamente el motor de cálculo del waterfall a Stylus, dejando Solidity como fallback funcional. Nunca al revés.

---

## 7. Lo que hay que conseguir, no programar

Tres cosas que no dependen de código y suelen quedar para el final:

1. **La cifra de impacto.** Un dato citable de la brecha de financiamiento PyME en Latam (BID Invest, IFC, CAF). Vale 20% del puntaje y necesita fuente real — no un número inventado en la slide.
2. **El caso real.** Una empresa concreta, aunque sea anonimizada, con ventas y un activo identificado. Un deal verosímil comunica infinitamente más que "Empresa Demo S.A.".
3. **El legal pack.** Borrador de term sheet y estructura del vehículo. No tiene que estar firmado; tiene que existir y estar hasheado onchain.

---

## Pendiente para cerrar el plan

Falta un dato para ajustar los bloques a tiempo real: **¿cuántos días quedan y cuántas personas son, con qué perfiles?** Con eso convierto el orden de construcción en un calendario con fechas y reparto.
