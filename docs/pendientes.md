# Pendientes — lista única

> Actualizado 2026-08-08. Hitos + waterfall on-chain, RepaymentRouter conectado, vault por oportunidad y mercado secundario ya tienen código escrito **y ahora compilado y testeado** (29/29 tests en verde entre `credit-vault` y `repayment-router`, `clippy` limpio). El bloqueante que quedaba (no había toolchain de Rust) se resolvió instalando Rust + GNU/mingw en esta máquina.

---

## 0. Qué se resolvió en esta sesión (para no repetir trabajo)

- ✅ **Hitos on-chain en `CreditVault`**: `activate()` deja el remanente en `escrow_remaining` y se libera por tramos vía `set_milestones` / `submit_milestone_evidence` / `release_milestone` / `reject_milestone`.
- ✅ **Waterfall on-chain**: `record_recovery()` corre la cascada legal → servicing → principal → interés → surplus, portada de `underwriting.ts::computeWaterfall`, acumulativa entre llamadas.
- ✅ **`RepaymentRouter` conectado**: `deploy.ts` lo despliega, inicializa y autoriza (`SERVICER_ROLE` + `setVaultApproved`); `__phase11_deploy_router.ts` hace lo mismo para Sepolia. `lib/servicing/onchain.ts` enruta `recordRepayment` por el router cuando está desplegado, con `repaymentId` real para dedup.
- ✅ **`Opportunity.vaultAddress`** viaja de punta a punta (tipo → wire → Postgres). `useCreditVault` acepta una dirección explícita; `InvestPanel` ya la usa.
- ✅ **Mercado secundario real**: tabla `position_listings` + rutas `/api/listings`. El vendedor ejecuta `transferPosition` de verdad cuando un comprador se anota interesado (`SellerListingRow`); `OrderBook.tsx` es el lado comprador.
- ✅ **`cargo test` corrió por primera vez** — `credit-vault` (15/15) y `repayment-router` (14/14), `cargo clippy --all-targets -D warnings` limpio en los dos. De paso se encontraron y arreglaron:
  - Un `log(self.vm(), ...)` con la API vieja de Stylus que quedó de un merge anterior en `transfer_position` — no compilaba.
  - Faltaba importar `StorageVec`/`StorageU16`/`StorageU8`/`StorageB256` de `stylus_sdk::storage` — el `prelude::*` no los trae.
  - Un reentrancy guard que quedaba trabado si una llamada a `record_recovery` fallaba justo antes de otra exitosa (bug introducido en esta sesión, ya corregido).
  - **Un bug preexistente** (de antes de esta sesión, nunca se había podido correr `cargo test`) en el test `transfer_position_moves_contribution_and_pro_rata_claim`: asumía que `claim()` soporta un retiro parcial, pero el contrato siempre drena el 100% disponible. El test se reescribió con dos repagos (parcial → venta → repago del resto) para que el escenario sea real.
  - `repayment-router/Cargo.toml` no declaraba el feature `contract-client-gen` (sí lo hace `credit-vault/Cargo.toml`) — con `-D warnings` eso rompía `clippy`.
- ⚠️ **Igual falta redesplegar.** El `CreditVault` en Sepolia (`421614`) sigue siendo el bytecode viejo, sin nada de esto. Compilar y testear no reemplaza el deploy.
- ✅ **Mojibake arreglado en `seed.ts`** — el archivo tenía texto guardado con doble encoding (UTF-8 decodificado como Latin-1/Windows-1252 y regrabado): "MetalmecÃ¡nica", "RenovaciÃ³n", etc. Confirmado que no aparece en ningún otro archivo del repo.
- ✅ **Fiat↔crypto simulado** (bloque 5) — `AddFundsFlow.tsx` ahora tiene un modo PEN dentro de la simulación: monto en soles, tipo de cambio fijo (`lib/format.ts::MOCK_PEN_PER_USD`), selector de método (Yape/Plin/Tarjeta, todo mock) y acredita el saldo automáticamente vía el `addFunds()` que ya existía. Declarado como simulado en la UI, igual que `usingSeedData`.
- ⚠️ **`cargo-stylus` no compila en Windows nativo** (usa `std::os::unix::net`, exclusivo de Linux/macOS) — confirmado al intentar instalarlo. La ruta estándar es WSL2, pero el `wsl.exe` de este equipo dice que el subsistema no está habilitado y pide `wsl --install` con una PowerShell **como Administrador** — algo que no se puede aprobar desde una sesión sin privilegios elevados. Falta que alguien con acceso admin corra eso (ver "Por dónde seguir").
- ✅ **Wallet deployer fondeada en Arbitrum Sepolia** (0.04 ETH) — el faucet solo daba Sepolia L1, así que se depositó a L2 llamando `depositEth()` directo en el Delayed Inbox de Arbitrum Sepolia (`0xaAe29B0366299461418F5324a79Afc425BE5ae21`, verificado contra el paquete oficial `@arbitrum/sdk`), sin pasar por la UI del bridge. La private key vive en `packages/stylus/.env` (gitignored).

---

## 1. Contratos — Stylus / Solidity

- [x] Compilar y correr `cargo test` — hecho, ver bloque 0.
- [x] `cargo clippy --all-targets -- -D warnings` — hecho, limpio.
- [ ] **Redesplegar el protocolo completo** (devnet primero, después Sepolia) — `deploy.ts` ya está listo para hacerlo de punta a punta, incluido el `RepaymentRouter`. Sin esto, todo lo de arriba sigue sin existir en ninguna chain real.
- [ ] **`forge test --gas-report`** guardado como evidencia + comparativa de costo L1 vs Arbitrum con números medidos.
- [ ] UI para que el verificador configure `set_milestones` al publicar una oportunidad — hoy solo `deploy.ts` lo hace (schedule fijo `[30%,25%,25%,20%]`) para los vaults de devnet. Sin esto, cualquier vault desplegado fuera del script de deploy no es activable.

---

## 2. Deploy, verificación y evidencia on-chain

- [ ] **Contratos verificados en Arbiscan** (código fuente visible) — hay que repetirlo después del redeploy del bloque 1.
- [ ] **Al menos una transacción real de cada flujo** (fondeo, activación, hito liberado, repago vía router, claim, default/waterfall) con su link a Arbiscan.
- [ ] **README sin actualizar tras el deploy de Sepolia**: no lista direcciones de contratos, no tiene comparativa de gas, no explica "por qué Arbitrum". Las instrucciones de "Desarrollo local" siguen siendo solo devnet (`412346`).

---

## 3. Verificador: economía (fee fijo + stake)

- [ ] **Fee fijo de verificación** (ej. 300 USDC cobrado a la empresa al enviar el expediente) — no construido.
- [ ] **Stake del verificador** (garantía que se pierde parcialmente si aprobó un proyecto que cae en default) — no construido. Argumento de *skin in the game*.
- [ ] Resto del modelo de fees (originación 2-3%, servicing 0.5-1% anual, mora) — hoy `fund`/`claim`/`record_repayment`/`release_milestone` existen, pero ningún fee nuevo aparte de `platform_fee_bps`. Ver `conceptos-y-cambios.md` Parte 3.

---

## 4. Mercado secundario / transferencias

- [x] Transferencia restringida en el contrato (`transfer_position`, exige `AccessRegistry`) — testeado.
- [x] UI para publicar, expresar interés y transferir — `PortfolioOverlay` (vendedor) + `OrderBook.tsx` (comprador), respaldadas por `position_listings` en Postgres.
- [ ] **El pago en USDC entre comprador y vendedor sigue sin resolver on-chain** — es coordinación manual hoy. Falta un mecanismo de escrow/atomic swap para el precio si se quiere cerrar el argumento de liquidez del pitch de verdad.
- [ ] Redesplegar `CreditVault` (bloque 1) para que el ABI en `deployedContracts.ts` incluya `transferPosition` con el resto de las funciones nuevas.

---

## 5. Fiat ↔ crypto (on/off-ramp)

- [x] **Lado inversionista simulado.** `AddFundsFlow.tsx` — pagar en PEN vía Yape/Plin/Tarjeta (mock), tipo de cambio fijo, acredita saldo local automáticamente. Declarado como simulado en la UI (banner de advertencia), no engaña a nadie.
- [ ] **Lado empresa sin resolver** — la empresa recibe USDC del desembolso y necesita convertir a PEN para operar; eso no tiene ni siquiera un mock todavía.
- [ ] Evaluar proveedores reales (Transak, MoonPay, rampa local peruana) — ninguno elegido ni descartado; el mock no reemplaza esta decisión, solo tapa el hueco de UX para la demo.
- [ ] Decidir si el on-ramp real entra al MVP o se declara roadmap explícito en el pitch — dado que ahora hay un mock presentable, es más fácil defender "roadmap" sin que se sienta como una laguna.

---

## 6. Motor de underwriting en Stylus

- [ ] Scoring y tasa sugerida siguen siendo funciones puras en `underwriting.ts` (TypeScript, off-chain). El waterfall de default ya se portó (bloque 1); esto es lo que queda: portar `computeScore`/`suggestedApy`.
- [ ] Si se hace, dejar fallback en Solidity/TS por si falla en la demo.

---

## 7. Frontend / UX

- [ ] UI para que el verificador o el originador configuren `set_milestones` (ver bloque 1) — sin esto un vault fuera de `deploy.ts` no es activable desde la UI.
- [ ] Pantallas de hitos (`MilestoneTimeline`) siguen siendo de solo lectura sobre datos del catálogo (Postgres), no leen `get_milestone`/`escrow_remaining` del contrato todavía.
- [ ] Mecanismo de settlement de precio en el mercado secundario (ver bloque 4) — hoy el flujo termina en "coordinen el pago aparte".
- [ ] Revisar consistencia del sistema de diseño en `OrderBook.tsx` y la sección nueva de `PortfolioOverlay` (interesados en mis publicaciones) — construidas rápido, sin pasada de pulido visual.
- [ ] Verificar que nada se rompe en la resolución del equipo donde se hace la demo.

---

## 8. Datos, backend e indexer

- [ ] Saldo, posiciones y actividad del portafolio siguen en `localStorage` por wallet, no en el indexer real.
- [x] **Indexer con hogar**: `scripts/indexer.ts` corriendo en Railway (proceso persistente — el listener de eventos no se banca serverless/Vercel). Config en `packages/nextjs/railway.indexer.json`.
- [ ] `CREDIT_VAULT_ADDRESS` en las env vars de Railway apunta al vault viejo — actualizar en cuanto se redespliegue (bloque 1).
- [ ] Correr `packages/nextjs/scripts/migrate.ts` contra la base de desarrollo para crear `position_listings` — la tabla está en el script pero falta confirmar que se aplicó.
- [ ] Confirmar que `useCompanyEvidence` y la ruta `api/company-evidence/[wallet]` quedaron completamente conectados de punta a punta tras el merge de PR #3.

---

## 9. Documentación e impacto (no depende de código, pesa 20%)

- [ ] **Cifra citable de la brecha de crédito PyME en Latam, con fuente real** (BID Invest / IFC / CAF).
- [ ] Caso de empresa concreto y verosímil (aunque anonimizado) para el pitch.
- [ ] El problema explicado en 30 segundos sin jerga.
- [ ] README: agregar direcciones de contratos en Sepolia, links a Arbiscan, comparativa de gas L1 vs Arbitrum, y el "por qué Arbitrum".

---

## 10. Testing y QA

- [x] `cargo test` — 29/29 en verde (`credit-vault` + `repayment-router`), ver bloque 0.
- [x] `cargo clippy --all-targets -- -D warnings` — limpio.
- [ ] `forge test` en verde con `--gas-report` guardado.
- [ ] Flujo feliz completo end-to-end en Sepolia (fondeo → escrow → hito → repago vía router → claim) — hoy solo hay script E2E contra devnet (`protocol_e2e.ts`), y ese script todavía no se actualizó para hitos/router.
- [ ] Flujo de default completo con waterfall ejecutado on-chain, verificado en Sepolia con una transacción real (los tests unitarios ya verifican la lógica, falta verlo correr en cadena).

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
- [ ] "Pools": ¿pool de inversión diversificado o pool de liquidez tipo Uniswap? El libro de órdenes (bloque 4) es la alternativa elegida, y ya tiene matching real.
- [ ] ¿Perú queda confirmado como jurisdicción única del MVP? (afecta si SUNAT/SUNARP se describen tal cual).
- [ ] ¿Las notas de `conceptos-y-cambios.md` vinieron de un mentor del hackathon? Si sí, más probable que reaparezcan en la evaluación.

---

## Por dónde seguir ahora

1. **Habilitar WSL2 (necesita un humano con permisos de administrador)** — abrir PowerShell **como Administrador** y correr `wsl --install`, aceptar el UAC, reiniciar Windows cuando lo pida. Sin esto, `cargo-stylus` no tiene dónde correr en esta máquina y el redeploy queda frenado.
2. **Instalar Rust + cargo-stylus dentro de WSL2** una vez habilitado (mismo procedimiento que ya se hizo en Windows, pero ahí sí compila nativo) y correr `deploy.ts` contra Arbitrum Sepolia — la wallet deployer ya está fondeada (`packages/stylus/.env`, gitignored).
3. **Actualizar `CREDIT_VAULT_ADDRESS` en Railway** una vez redesplegado (bloque 8).
4. **Cifra de impacto** (bloque 9) — no depende de código, se puede resolver en paralelo mientras se resuelve lo de WSL2.
5. **Confirmar verificación en Arbiscan + actualizar el README** con las direcciones nuevas y comparativa de gas (bloques 2 y 9).
6. El on-ramp fiat del lado empresa (bloque 5) y el settlement de precio del mercado secundario (bloque 4) quedan como roadmap explícito en el pitch si el tiempo aprieta — el lado inversionista del on-ramp ya tiene un mock presentable.
</content>
