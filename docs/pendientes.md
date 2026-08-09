# Pendientes — lista única

> Actualizado 2026-08-09. El producto se recorre entero sin salir de él: se entra sin wallet previa, se recibe saldo de prueba solo, el catálogo tiene 80 operaciones con su expediente detrás, y **una inversión real llega al contrato** —probada con una wallet vacía, de punta a punta—. Sigue pendiente `RepaymentRouter`.

---

## 0.1 Sesión del 9 de agosto

- ✅ **Expediente completo y circuito de revisión.** El asistente pasó de cuatro campos a un legajo en cuatro pasos (empresa, proyecto, condiciones, documentación) que cierra con el comprobante de lo enviado. El verificador **toma** el expediente antes de decidirlo (`in_review`, candado optimista: el segundo que llega recibe 409) y cada transición escribe en `submission_events`, que es lo que la empresa lee como seguimiento. Las reglas de negocio viven en `lib/verifier/submission.ts` y las validan el formulario **y** la API.
- ✅ **Saldo de prueba automático al entrar** (`lib/faucet`). El token canónico en Arbitrum Sepolia pasó a ser el `MockUSDC` desplegado (símbolo `mUSDC`), porque el USDC de Circle no tiene faucet y dejaba el primer contacto en un callejón. La dispensadora del servidor manda **gas primero** —una wallet nueva no puede firmar nada, ni siquiera el `faucet()` público del token— y después el token por donde se pueda: `mint` si tiene `MINTER_ROLE`, transferencia si tiene saldo, o la propia wallet reclama del contrato. Medido: `faucet()` cuesta 0.0000019 ETH, así que el goteo de gas es de 0.0003 y la cuenta operadora rinde ~120 visitantes.
- ✅ **La acreditación no bloquea.** Corre detrás del catálogo, no delante, y toda espera tiene tope (firma 45 s, petición 90 s, receipts 60 s). Antes una firma que no salía dejaba la pantalla de arranque esperando indefinidamente — pasó, una hora.
- ✅ **El saldo se lee de un solo sitio** (`hooks/useSaldo.ts`). La barra decía 0 con la wallet teniendo 10 000 mUSDC en cadena: cada superficie miraba una fuente distinta (localStorage / cadena / mezcla).
- ✅ **Catálogo sembrado y persistido**: 80 oportunidades publicadas (50 en fondeo, 17 activas, 9 pagadas, 4 en default) y 9 expedientes en la cola del verificador, en Neon. Cada una nace del camino completo del dominio —empresa, expediente aprobado, bitácora, publicación—, no como fila suelta. `yarn seed:catalogo` / `--limpiar`; lo sembrado se reconoce por la wallet `0x5EED…` y nunca pisa un expediente real.
- ✅ **Resuelto: el token del faucet y el del vault ya coinciden, y una inversión real corre de punta a punta.** El `CreditVault` viejo (`0x2ff9d0da…`) estaba inicializado con el USDC de Circle, que no tiene faucet: una wallet nueva no podía invertir jamás. Se desplegó **`0xd470aadb20aeae8a225e68fef09a37addbde3797`** reenviando el initcode del original —el contrato desplegado es el stub de 48 bytes que Stylus deja apuntando al WASM ya activado, así que una copia con el mismo codehash queda activada sin recompilar, sin WSL y por 72k de gas— inicializado con `MockUSDC`, con hitos 30/25/25/20 y registrado.
  - El registry también estaba atado: mantiene una lista blanca de tokens y rechazaba el vault con `PaymentTokenNotAuthorized`. Se autorizó `MockUSDC` con `setPaymentToken`.
  - **Probado con una wallet nueva y vacía**, el camino exacto del visitante: gas de la dispensadora → `faucet()` (10 000 mUSDC) → `requestAccess` → compliance aprueba → `approve` + `fund`. Resultado: 2 000 mUSDC en el vault, posición del inversionista 2 000, saldo restante 8 000. Tx `0x43cad5c3…`.
  - La oportunidad `renovacion-de-embarcacion-1` quedó conectada a ese vault y su recaudación refleja lo que dice la cadena.
  - Y la raíz en el código: `deploy.ts` elegía Circle **solo por ser Sepolia**. Ahora usa `MockUSDC` en todas las redes y Circle queda detrás de `--circle-usdc`, para un despliegue que se fondee a mano.
- ⚠️ **La recaudación de una oportunidad no se sincroniza sola con su vault.** Se puso a mano tras la prueba. Mientras el catálogo sea sembrado no molesta, pero una oportunidad viva necesita que alguien lea `getAccounting` — el indexer (`scripts/indexer.ts`) es el lugar natural.
- ⚠️ **`MINTER_ROLE` opcional pero recomendable.** La dispensadora (`0xa05D9756…`) no lo tiene, así que el token lo reclama la wallet del visitante firmando en el navegador. Funciona, pero mete a wagmi en el camino crítico. Con `grantRole(MINTER_ROLE, 0xa05D9756…)` desde el admin del `MockUSDC` (`0x487B9d8b…`), el servidor mintea y el navegador no firma nada. Diagnóstico en `yarn faucet:check`.
- ✅ **Las llaves operadoras estaban vacías y el circuito estaba muerto.** `PASSPORT_`, `SERVICER_` y `COMPLIANCE_OPERATOR_PRIVATE_KEY` estaban definidas pero en blanco en `.env.local`, así que aprobar un expediente devolvía 502 al intentar emitir el pasaporte, y lo mismo el acceso de inversionista y el servicing. La wallet del deployer (`0xa05D9756…`) **ya tenía todos los roles** en los contratos desplegados —`ISSUER_ROLE` y admin en `CompanyPassportSBT`, `COMPLIANCE_ROLE` en `AccessRegistry`, admin en `CreditRegistry`—, así que bastó cablearla. Probado de punta a punta: tomar → aprobar emite el SBT onchain (tx `0x2df89c91…`, tokenId 2).
- ✅ **`yarn.lock` restaurado.** Alguien corrió `npm install` en un repo Yarn 3: quedó un `package-lock.json` y el lockfile reescrito en formato v1, lo que rompió `yarn migrate` y `tsx` (perdió el binario de esbuild).
- ✅ **`tsc` y `eslint` limpios**, y los dos guardarraíles (`check:routes`, `check:scroll`) pasan **desde cero**. El de rutas fallaba en frío porque `next dev` compila cada ruta en su primera visita y esa compilación se comía el plazo de la aserción; ahora precalienta antes de medir.

---

## 0. Qué se resolvió en la sesión del 8 de agosto (para no repetir trabajo)

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
- ✅ **Wallet deployer fondeada en Arbitrum Sepolia** (0.04 ETH) — el faucet solo daba Sepolia L1, así que se depositó a L2 llamando `depositEth()` directo en el Delayed Inbox de Arbitrum Sepolia (`0xaAe29B0366299461418F5324a79Afc425BE5ae21`, verificado contra el paquete oficial `@arbitrum/sdk`), sin pasar por la UI del bridge. La private key vive en `packages/stylus/.env` (gitignored).
- ✅ **WSL2 instalado y funcionando** — `cargo-stylus` no compila en Windows nativo (usa `std::os::unix::net`), así que se instaló Ubuntu vía `wsl --install` (necesitó PowerShell como administrador — lo corrió el usuario), y ahí adentro Rust + `cargo-stylus` + `forge` + Node, todo nativo Linux.
- ✅ **Deploy real en Arbitrum Sepolia** (commit `921ca62`), corrido desde un `git worktree` separado apuntando a `main` (para no pisar el trabajo del rediseño de UI en curso en otra rama):
  - `AccessRegistry`: `0x03f4770018c262fa703ce905698e88a47d52ddc1`
  - `CompanyPassportSBT`: `0xc2457ea101c89884323eca7178df210826372bcc`
  - `CreditRegistry`: `0x2e568d07783fa2152d3b42e49c5fa9f51a818ce8`
  - `CreditVault`: `0x2ff9d0da4040be9cb243bca4857a33ea0ba70848` — **con hitos seteados** (30/25/25/20 bps), inicializado, registrado. Reemplaza el bytecode viejo sin hitos/waterfall.
  - Registry configurado (passport/access registry/payment token), passport de demo emitido, acceso del inversionista aprobado.
  - `deployedContracts.ts` regenerado — **con cuidado de no perder la entrada de devnet (`412346`)**: `generateTsAbi` sobreescribe el archivo entero según lo que haya en `deployments/` local, así que se fusionó a mano el bloque `412346` viejo con el `421614` nuevo antes de commitear.
- ❌ **`RepaymentRouter` sigue sin desplegar.** `cargo stylus deploy`/`check`/`--estimate-gas` para este contrato específico salen con exit 0 y **cero output**, sin compilar siquiera (el `.wasm` no se regenera). `credit-vault` con el comando idéntico funciona perfecto. Se descartaron: TERM/NO_COLOR, `--deployer-salt` distinto, la sección `[contract]` del `Cargo.toml`, tamaño del WASM (58KB, más chico que `credit-vault`), estructura de `main.rs`, buffering de stdout (`stdbuf -o0`). Razón real sin identificar — puede ser un bug de `cargo-stylus 0.10.8`. **No bloquea el resto**: `lib/servicing/onchain.ts` ya cae al llamado directo a `vault.recordRepayment` cuando el router no está desplegado, así que el flujo de repago funciona igual sin él.
- ⚠️ **`deploy.ts` no es idempotente en los pasos de configuración.** El deploy corrido dos veces con `--resume` reintentó `issuePassport` (ya emitido) y revirtió — sin daño porque viem simula antes de mandar la tx y no gastó gas, pero si se vuelve a correr el script completo hay que saltear manualmente los pasos ya hechos o vaciar la wallet del passport primero.

---

## 1. Contratos — Stylus / Solidity

- [x] Compilar y correr `cargo test` — hecho, ver bloque 0.
- [x] `cargo clippy --all-targets -- -D warnings` — hecho, limpio.
- [x] **Desplegar `AccessRegistry`, `CompanyPassportSBT`, `CreditRegistry`, `CreditVault` en Sepolia** — hecho, ver bloque 0. Direcciones en `deployedContracts.ts` (commit `921ca62`).
- [ ] **Desplegar `RepaymentRouter`** — bloqueado, ver el ⚠️ del bloque 0. Requiere diagnosticar por qué `cargo-stylus` no compila/despliega este contrato puntual (probar otra versión de `cargo-stylus`, o abrir un issue upstream con un repro mínimo).
- [ ] **`forge test --gas-report`** guardado como evidencia + comparativa de costo L1 vs Arbitrum con números medidos.
- [ ] UI para que el verificador configure `set_milestones` al publicar una oportunidad — hoy solo `deploy.ts` lo hace (schedule fijo `[30%,25%,25%,20%]`). El vault de Sepolia ya tiene el schedule seteado por el script; cualquier vault desplegado fuera de `deploy.ts` no sería activable sin esto.

---

## 2. Deploy, verificación y evidencia on-chain

- [ ] **Contratos verificados en Arbiscan** (código fuente visible) — los 4 contratos ya están en Sepolia, falta correr `verify_solidity_explorer.ts`/`verify_stylus_explorer.ts` contra las direcciones nuevas.
- [ ] **Al menos una transacción real de cada flujo** con su link a Arbiscan — ya hay varias (activación de registry, passport, acceso, `setMilestones`), falta armar la lista curada: fondeo, hito liberado, repago, claim, default/waterfall.
- [ ] **README sin actualizar tras el deploy de Sepolia**: no lista las direcciones nuevas, no tiene comparativa de gas, no explica "por qué Arbitrum". Las instrucciones de "Desarrollo local" siguen siendo solo devnet (`412346`).

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

0. **Sincronizar la recaudación con el vault** (bloque 0.1): hoy la cifra de la tarjeta se puso a mano después de la inversión de prueba. El indexer es el lugar natural para leer `getAccounting` y que el catálogo no mienta cuando alguien invierta en vivo.
1. **Diagnosticar el silencio de `cargo-stylus` con `RepaymentRouter`** — probar `cargo install cargo-stylus --version <otra>` (0.9.x o una más nueva que 0.10.8), o pedir ayuda en el Discord/GitHub de Offchain Labs con un repro mínimo. No es urgente: el protocolo funciona sin el router (fallback ya construido).
2. **Actualizar `CREDIT_VAULT_ADDRESS` en Railway** con `0x2ff9d0da4040be9cb243bca4857a33ea0ba70848` (bloque 0) — pendiente de que el usuario lo pegue en el raw editor.
3. **Cifra de impacto** (bloque 9) — no depende de código, se puede resolver en paralelo.
4. **Verificar los 4 contratos en Arbiscan + actualizar el README** con las direcciones de Sepolia y comparativa de gas (bloques 2 y 9) — cierra el requisito obligatorio A1 del track.
5. **Probar el flujo completo en la UI** contra las direcciones nuevas: fondear, activar, liberar un hito, repagar, cobrar — nunca se probó de punta a punta contra Sepolia real, solo se verificó cada paso por transacción individual.
6. El on-ramp fiat del lado empresa (bloque 5) y el settlement de precio del mercado secundario (bloque 4) quedan como roadmap explícito en el pitch si el tiempo aprieta — el lado inversionista del on-ramp ya tiene un mock presentable.
</content>
