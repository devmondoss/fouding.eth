# Pendientes — lista única

> Actualizado 2026-08-07 tras el merge de PR #3 (`feat/pr-03-company-passport-testnet`, commit `9377d1c`). Reemplaza la versión anterior: dos bloqueantes duros ya se resolvieron (deploy en Sepolia, USDC de Circle), el resto sigue igual o se reorganizó por área para no perder cobertura de ningún módulo del proyecto.

---

## 0. Qué trajo el último merge (para no repetir trabajo)

- ✅ Deploy real en **Arbitrum Sepolia** (chainId `421614`): `AccessRegistry`, `CompanyPassportSBT`, `CreditRegistry`, `CreditVault`, `MockUSDC` — direcciones en `deployedContracts.ts`.
- ✅ **USDC de Circle** cableado como token canónico en Sepolia (`protocol.ts`, `ARBITRUM_SEPOLIA_USDC_ADDRESS`); `MockUSDC` queda solo para devnet.
- ✅ Contrato Stylus nuevo **`RepaymentRouter`** (repagos validados, dedup por `repaymentId`, evento `RepaymentProcessed`) — **escrito pero no confirmado en cadena** (no aparece en `deployedContracts.ts` para `421614`).
- ✅ Scripts de verificación (`verify_contract_sync.ts`, `verify_solidity_explorer.ts`, `verify_stylus_explorer.ts`, `verify_testnet.ts`, `preflight_testnet.ts`) — existen, falta confirmar que corrieron contra Arbiscan.
- ⚠️ El cambio en `credit-vault/src/lib.rs` es casi todo migración de API (`self.vm().log(...)`) + el hook `record_repayment`. **No tocó hitos ni waterfall.**

---

## 1. Contratos — Stylus / Solidity

- [ ] **Hitos y waterfall on-chain.** `activate()` sigue desembolsando el 100% de golpe; no hay tramos que aprobar. El waterfall se sigue calculando en `underwriting.ts` (TypeScript, off-chain). Es el hueco más caro: pesa en "Implementación técnica" (25%) e "Innovación con Blockchain" (15%).
- [ ] **Confirmar deploy del `RepaymentRouter` en Sepolia.** El script (`__phase11_deploy_router.ts`) existe con `verify: false`; falta correrlo, capturar la dirección y regenerar `deployedContracts.ts`.
- [ ] **Conectar el `RepaymentRouter` al flujo real de repago.** Hoy nada en la UI ni en `lib/servicing/onchain.ts` llama al router — verificar si `record_repayment` se dispara desde algún lado o sigue huérfano.
- [ ] **Un vault por oportunidad.** `useCreditVault` sigue apuntando a un único deployment fijo. La columna `vault_address` ya existe en el schema de Postgres; falta la lógica de mapeo.
- [ ] **`forge test --gas-report`** guardado como evidencia + comparativa de costo L1 vs Arbitrum con números medidos.
- [ ] Confirmar que `cargo test` corre en verde para `credit-vault` y `repayment-router` — la sesión anterior no tenía toolchain de Rust instalada, no se pudo validar.

---

## 2. Deploy, verificación y evidencia on-chain

- [ ] **Contratos verificados en Arbiscan** (código fuente visible). Los scripts existen; confirmar que se corrieron y que el código aparece verificado en el explorador.
- [ ] **Al menos una transacción real de cada flujo** (fondeo, activación, repago, claim, default/waterfall) con su link a Arbiscan.
- [ ] **README sin actualizar tras el deploy de Sepolia**: no lista direcciones de contratos, no tiene comparativa de gas, no explica "por qué Arbitrum". Las instrucciones de "Desarrollo local" siguen siendo solo devnet (`412346`) — falta una sección de testnet.

---

## 3. Verificador: economía (fee fijo + stake)

- [ ] **Fee fijo de verificación** (ej. 300 USDC cobrado a la empresa al enviar el expediente) — no construido.
- [ ] **Stake del verificador** (garantía que se pierde parcialmente si aprobó un proyecto que cae en default por algo que debió detectar) — no construido. Es el argumento de *skin in the game*.
- [ ] Resto del modelo de fees (originación 2-3%, servicing 0.5-1% anual, mora, recupero) — hoy solo `fund`/`claim`/`record_repayment` existen. Ver `conceptos-y-cambios.md` Parte 3.

---

## 4. Mercado secundario / transferencias

- [x] Transferencia restringida en el contrato (`transfer_position` en `CreditVault`, exige `AccessRegistry`). Tests en el mismo archivo — pendiente correr `cargo test` (bloque 1).
- [ ] **Falta la UI** para vender/transferir una posición o elegir destinatario — solo existe el hook de bajo nivel (`transferPosition` en `useCreditVault.ts`).
- [ ] **Libro de órdenes: falta el lado comprador.** Se puede publicar una posición en venta (mock), pero no hay matching de contraparte.
- [ ] Redesplegar `CreditVault` (devnet y Sepolia) para que el ABI incluya `transfer_position` — `deployedContracts.ts` no se regenera solo.
- [x] El pasaporte de negocio (SBT) sigue intransferible — no se tocó.

---

## 5. Fiat ↔ crypto (on/off-ramp)

- [ ] **No existe ningún camino PEN ↔ USDC**, ni en contrato ni en UI.
- [ ] Definir qué lado se resuelve primero: empresa (recibe USDC, convierte a PEN) o inversionista (tiene PEN, entra en USDC).
- [ ] Evaluar proveedores (Transak, MoonPay, rampa local peruana) — ninguno elegido ni descartado.
- [ ] Decidir si entra al MVP o se declara roadmap explícito en el pitch.

---

## 6. Motor de underwriting en Stylus

- [ ] Scoring y tasa sugerida siguen siendo funciones puras en `underwriting.ts` (TypeScript, off-chain). Portarlas a Stylus (Rust) es la recomendación de `conceptos-y-cambios.md` Parte 5. Condición: primero cerrar hitos/waterfall (bloque 1), esto va encima.
- [ ] Si se hace, dejar fallback en Solidity/TS por si falla en la demo.

---

## 7. Frontend / UX

- [ ] UI de transferencia/venta de posición (ver bloque 4).
- [ ] Lado comprador del libro de órdenes (ver bloque 4).
- [ ] Pantallas de hitos: hoy son de solo lectura porque el contrato no tiene tramos — bloqueado por el bloque 1.
- [ ] Revisar consistencia del sistema de diseño en las pantallas nuevas de `PassportPanel` (cambió 394 líneas en el último merge) y `AddFundsFlow`.
- [ ] Estados de carga/error/vacío en los flujos nuevos (evidencia de empresa, decisión del verificador) — no auditado desde el merge.
- [ ] Verificar que nada se rompe en la resolución del equipo donde se hace la demo.

---

## 8. Datos, backend e indexer

- [ ] Saldo, posiciones y actividad del portafolio siguen en `localStorage` por wallet, no en el indexer real.
- [ ] El catálogo cae al seed si Postgres no responde (esto está bien, ya se avisa con `usingSeedData` — mantenerlo así, no es un pendiente urgente).
- [ ] Confirmar que `useCompanyEvidence` (hook nuevo) y la ruta `api/company-evidence/[wallet]` quedaron completamente conectados de punta a punta tras el merge.

---

## 9. Documentación e impacto (no depende de código, pesa 20%)

- [ ] **Cifra citable de la brecha de crédito PyME en Latam, con fuente real** (BID Invest / IFC / CAF) — sigue faltando, se puede resolver en paralelo a cualquier tarea de código.
- [ ] Caso de empresa concreto y verosímil (aunque anonimizado) para el pitch.
- [ ] El problema explicado en 30 segundos sin jerga.
- [ ] README: agregar direcciones de contratos en Sepolia, links a Arbiscan, comparativa de gas L1 vs Arbitrum, y el "por qué Arbitrum".

---

## 10. Testing y QA

- [ ] `forge test` en verde con `--gas-report` guardado (bloque 1 y 2).
- [ ] `cargo test` para `credit-vault` y `repayment-router` — no corrido en esta máquina por falta de toolchain de Rust.
- [ ] Flujo feliz completo end-to-end en Sepolia (fondeo → escrow → hito → repago → claim) — hoy solo hay script E2E contra devnet (`protocol_e2e.ts`).
- [ ] Flujo de default completo con waterfall ejecutado on-chain — bloqueado por el bloque 1 (no existe waterfall en contrato todavía).

---

## 11. Por confirmar con la organización del hackathon 🔎

- [ ] Fecha y hora exacta de cierre (con zona horaria).
- [ ] Plataforma de submission (DoraHacks, Devfolio, formulario propio).
- [ ] Si piden video demo: duración máxima y dónde se sube.
- [ ] Si piden pitch deck y cuántas slides.
- [ ] Si hay demo en vivo ante jurado y cuántos minutos.
- [ ] Si exigen deploy público del frontend con URL funcionando.
- [ ] Licencia obligatoria en el repo.
- [ ] Si todo el código debe escribirse durante el evento (restricción de código previo).
- [ ] Tamaño y registro del equipo.
- [ ] Checkpoints intermedios con entrega parcial.
- [ ] Qué implica exactamente la "track intermedia".

---

## 12. Decisiones abiertas (bloquean cómo se escribe el resto)

- [ ] ¿"Volt" era *vault* o el nombre de otro proyecto de referencia?
- [ ] ¿Qué implica la "track intermedia" — el hackathon tiene niveles de dificultad?
- [ ] "Pools": ¿pool de inversión diversificado o pool de liquidez tipo Uniswap? Hoy no se construye ninguno; el libro de órdenes (bloque 4) es la alternativa elegida.
- [ ] ¿Perú queda confirmado como jurisdicción única del MVP? (afecta si SUNAT/SUNARP se describen tal cual).
- [ ] ¿Las notas de `conceptos-y-cambios.md` vinieron de un mentor del hackathon? Si sí, más probable que reaparezcan en la evaluación.

---

## Por dónde seguir mañana temprano

1. **Cifra de impacto** (bloque 9) — no depende de código, resolver en paralelo.
2. **Confirmar verificación en Arbiscan + actualizar el README** con direcciones y comparativa de gas (bloques 2 y 9) — cierra el requisito obligatorio A1 del track.
3. **Hitos + waterfall on-chain** (bloque 1) — sigue siendo el núcleo de "Implementación técnica" (25%) e "Innovación" (15%) juntos, y ahora es el único bloqueante duro que queda sin tocar.
4. **Confirmar el deploy del `RepaymentRouter`** y conectarlo al flujo de repago real (bloque 1).
5. Recién después: transferencias (bloque 4) y fiat↔crypto (bloque 5), que probablemente queden como roadmap explícito en el pitch si el tiempo aprieta.
</content>
