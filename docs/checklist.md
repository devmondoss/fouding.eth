# Checklist de entrega — Track Arbitrum

> **Fuente:** solo la información del track que tengo a la vista (categorías, requisitos técnicos obligatorios y criterios de evaluación). **Todo lo marcado 🔎 hay que confirmarlo en las bases oficiales** — no está en lo que me pasaste y no me lo estoy inventando.

---

## A. Requisitos obligatorios — textuales del track

Estos tres son los que el track declara como obligatorios. Si falta uno, no hay nada que evaluar.

### A1. Uso verificable de Arbitrum como componente principal

- [ ] Contratos desplegados en Arbitrum (Sepolia para la entrega)
- [ ] Direcciones de los contratos listadas en el README
- [ ] Contratos **verificados en Arbiscan** (código fuente visible, no solo bytecode)
- [ ] Al menos una transacción real de cada flujo, con su link a Arbiscan
- [ ] El README explica **por qué Arbitrum** y no otra cadena, con el dato de gas medido

> "Verificable" es la palabra clave: un jurado tiene que poder abrir Arbiscan y comprobarlo sin ejecutar nada.

### A2. Evidencia en el repositorio (smart contracts, integraciones)

- [ ] Repositorio público
- [ ] Carpeta de contratos con el código fuente
- [ ] Tests que corren (`forge test` en verde)
- [ ] Script de deploy versionado
- [ ] Frontend en el mismo repo, con las integraciones visibles (viem/wagmi apuntando a los contratos)
- [ ] README con instrucciones para levantar el proyecto
- [ ] Historial de commits legible — no un único commit "final"

### A3. Stylus — solo si van por el bounty

- [ ] Stylus es **parte esencial de la lógica**, no un adorno
- [ ] En nuestro caso sería el `UnderwritingEngine` (scoring y riesgo)
- [ ] Contrato Stylus desplegado y verificado
- [ ] El README explica por qué ese componente justifica Rust/WASM

> **Decisión pendiente.** Solo se activa si el vault en Solidity ya funciona. Un Stylus a medias castiga el 25% de implementación técnica, que pesa más que el bounty.

---

## B. Checklist por criterio de evaluación

Cada criterio necesita una **evidencia concreta**. Esta es la parte que se olvida y donde se pierden puntos con el proyecto ya construido.

### Implementación técnica — 25%
- [ ] Flujo feliz completo: fondeo → escrow → hito → repago → claim
- [ ] Flujo de default completo con waterfall ejecutado onchain
- [ ] Tests de ambos caminos
- [ ] Contratos `Pausable` con multisig
- [ ] Sin claves privadas ni `.env` commiteados

### Uso de Arbitrum — 20%
- [ ] Todo el settlement onchain, no una firma simbólica
- [ ] USDC nativo de Circle (no un token mock propio) 🔎 *confirmar disponibilidad en Sepolia*
- [ ] `forge test --gas-report` guardado como evidencia
- [ ] Comparativa de costo del ciclo completo L1 vs Arbitrum, con números medidos

### Impacto del problema — 20%
- [ ] **Cifra citable de la brecha de crédito PyME en Latam, con fuente real** (BID Invest / IFC / CAF)
- [ ] Caso de empresa concreto y verosímil, aunque esté anonimizado
- [ ] El problema explicado en 30 segundos sin jerga

> Es el criterio con más peso que **no depende de código** y el que más se suele improvisar la última noche.

### Innovación con Blockchain — 15%
- [ ] Escrow por hitos: el capital no llega de golpe
- [ ] Waterfall ejecutado por el contrato, no descrito en un PDF
- [ ] Pasaporte de negocio soulbound: reputación crediticia portable
- [ ] Transferencia restringida: liquidez sin abrir a cualquiera
- [ ] Verificador con honorario fijo y stake en riesgo

### Experiencia del Usuario — 15%
- [ ] Los tres roles navegables de punta a punta
- [ ] Sistema de diseño aplicado de forma consistente
- [ ] Estados de carga, error y vacío — no pantallas en blanco
- [ ] Cifras siempre tabulares y bien formateadas
- [ ] Nada roto por resolución en el equipo donde se hace la demo

### Presentación Final — 5%
- [ ] Guion escrito y cronometrado
- [ ] El **camino de default** incluido — es el diferenciador
- [ ] Cierre honesto: qué es onchain y qué es offchain
- [ ] Roadmap creíble

---

## C. Entregables que hay que confirmar 🔎

Nada de esto aparece en la información que tengo. **Confírmalo en las bases o pregúntalo a la organización hoy**, porque varios tienen fecha propia:

- [ ] 🔎 **Fecha y hora exacta de cierre** (y zona horaria)
- [ ] 🔎 **Formulario o plataforma de submission** (DoraHacks, Devfolio, formulario propio)
- [ ] 🔎 **Video demo**: ¿lo piden? ¿duración máxima? ¿dónde se sube?
- [ ] 🔎 **Pitch deck**: ¿se entrega? ¿número de slides?
- [ ] 🔎 **Demo en vivo**: ¿hay presentación ante jurado? ¿cuántos minutos?
- [ ] 🔎 **Deploy público del frontend**: ¿se exige URL funcionando?
- [ ] 🔎 **Licencia** en el repo (varios hackathons exigen open source)
- [ ] 🔎 **Restricción de código previo**: ¿todo debe escribirse durante el evento?
- [ ] 🔎 **Tamaño y registro del equipo**
- [ ] 🔎 **Checkpoints intermedios** con entrega parcial
- [ ] 🔎 Si existe el "track intermedia" que mencionaste, **qué implica**

---

## D. Dónde estamos hoy

| Item | Estado |
| --- | --- |
| Documentación de producto, stack, diseño y plan | ✅ Hecho |
| Sistema visual funcionando | ✅ Corriendo en local |
| Repositorio remoto | ✅ `github.com/devmondoss/fouding.eth` |
| Contratos Solidity (`AccessRegistry`, `CompanyPassportSBT`, `CreditRegistry`) | ✅ Con tests de Foundry |
| `CreditVault` en Rust/Stylus | ✅ Máquina de estados completa, con tests |
| Flujo empresa → verificador → catálogo | ✅ Cerrado |
| Acceso de inversionistas (solicitud → aprobación en cadena) | ✅ Cerrado |
| Invertir y cobrar contra el vault | ✅ `fund` y `claim` desde la UI |
| **Hitos y waterfall en el contrato** | ❌ `activate()` desembolsa el 100% de golpe |
| **Un vault por oportunidad** | ❌ Hoy uno solo, fijo |
| **Deploy en Arbitrum Sepolia** | ❌ Solo devnet local (`412346`) |
| Fee de verificación y stake del verificador | ❌ Sin construir |
| Cifra de impacto con fuente | ❌ Falta |
| Fecha límite | ❌ **No la sé** |

**Los tres huecos que más pesan en la evaluación** son el deploy en Sepolia (requisito obligatorio del track), y los hitos y el waterfall en el contrato — que son justo lo que el criterio de innovación pide ver ejecutado en cadena y no descrito en un PDF.

---

## Lo primero que haría hoy

1. Conseguir las bases oficiales y llenar los 🔎.
2. Crear el repo público y subir lo que ya existe. Empieza el historial de commits, que también se evalúa.
3. Desplegar un contrato mínimo verificado en Arbitrum Sepolia — cierra el circuito técnico completo antes de escribir lógica de verdad.
