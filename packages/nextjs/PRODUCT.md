# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres roles con superficies propias, los tres dentro del alcance del rediseño:

1. **Inversionista** (ruta `/`, más `/login`) — persona o vehículo verificado que busca exposición a crédito privado con retorno pactado. Entra sin registro previo: la wallet se genera al instante y explorar el catálogo es libre; la verificación se exige al comprometer capital. Su trabajo: entender una oportunidad (colateral, cobertura, hitos, waterfall, calificación) lo bastante rápido para decidir si aporta USDC, y después seguir su posición.
2. **Empresa prestataria / PyME** (rutas `/negocios`, `/negocios/login`, `/solicitar`) — empresa latinoamericana con ≥2 años de operación, ventas verificables y un activo elegible como garantía, que necesita financiar un proyecto concreto de 8 a 12 meses. Su trabajo: armar y enviar un expediente (monto, plazo, APY, proyecto, documentación de ventas, RUC, activo en garantía) y después seguir desembolsos por hitos y repagos.
3. **Verificador / originador** (ruta `/verifier`) — operador interno que revisa expedientes, valora colateral, publica la oportunidad con score y disclosure, aprueba hitos y gestiona servicing y default. Cobra **honorario fijo por expediente revisado, apruebe o rechace**: su ingreso no depende del resultado, y ese desacople es una decisión de producto deliberada.

## Product Purpose

Marketplace *permissioned* de private credit tokenizado sobre Arbitrum. Cada oportunidad financia un proyecto específico de una empresa concreta: se recauda en USDC, el capital queda en escrow en el contrato, se libera por hitos verificados, y el repago (o el recupero en default) se distribuye onchain según un waterfall explícito.

Éxito = una operación completa de punta a punta con sus dos finales: el camino de repago **y** el camino de default con waterfall ejecutado en el contrato. El producto mejora coordinación, trazabilidad, settlement y transparencia de una operación de crédito privado; no elimina el riesgo crediticio.

## Positioning

Infraestructura de private credit onchain para empresas con tracción y activos reales — no crowdfunding empresarial, no una app cripto especulativa.

Lo que un producto vecino no puede copiar sin cambiar su modelo:

- **El waterfall de default se ejecuta en el contrato, no en un PDF.** Costos de liquidación → servicing → principal → intereses → excedente, con recupero parcial visible para el inversionista.
- **Escrow con desembolso por hitos**: el capital no llega a la empresa al cerrar la ronda.
- **Pasaporte de negocio soulbound (ERC-5192)**: el buen comportamiento de pago se vuelve un activo portable de la empresa. Segundo crédito, mejor tasa.
- **Verificador con honorario fijo** (y, en roadmap, stake en garantía): elimina el conflicto de agencia de cobrar por aprobar.
- **La plataforma gana cuando los créditos se pagan** (servicing sobre saldo vivo), no cuando se aprueban.

## Operating Context

Doble contexto confirmado por el usuario: **demo ahora, piloto después**. Ninguna decisión debe optimizar la demo de forma que haya que deshacerla en el piloto.

- **Demo de hackathon** — track Arbitrum, categoría RWA. Criterios y pesos: implementación técnica 25%, uso de Arbitrum 20%, impacto del problema 20%, innovación 15%, **experiencia de usuario 15%**, presentación 5%. El guion recorre: problema → publicación de la oportunidad → inversión con capital visible en escrow → aprobación de hito → **default con waterfall** → cierre con gas medido.
- **Stand con público general** — confirmado el 2026-08-08, y es el escenario que manda sobre el de proyector. No es un jurado evaluando tres minutos: es gente que pasa, escanea un QR y entra **en su propio teléfono**, con 60 a 180 segundos de atención y sin saber qué es private credit. Consecuencias que no son de estética: móvil es la superficie primaria, varias personas recorren a la vez sobre el mismo catálogo, la sesión se la llevan puesta al irse, y cada travesía tiene que cerrar sola sin depender de que haya alguien del equipo libre. El wifi de evento hace de la espera de red un estado protagonista, no un detalle.
- **Piloto en Perú** — jurisdicción del MVP. La verificación de ventas se apoya en consulta RUC pública y en comprobantes electrónicos que la empresa delega; la garantía se inscribe en registro público (garantía mobiliaria o hipoteca) y su número de inscripción es mostrable en la ficha. Uso repetido, densidad de dato y estados de error importan tanto como el impacto inicial.
- **Documentos y datos personales viven fuera de cadena.** Onchain solo van identificadores y hashes `bytes32` verificables. Esto es una restricción operativa, no un detalle técnico.

## Capabilities and Constraints

**Superficies existentes** (todas dentro del rediseño): catálogo/deck del inversionista, ficha de oportunidad por pasos, panel de portafolio, autenticación y onboarding, landing y login de negocios, asistente de solicitud, dashboard de empresa, bandeja del verificador con publicación de oportunidad y servicing, y la puerta de elección de rol.

**Arquitectura de aplicación — se conserva sin cambios** (decisión explícita del usuario en este rediseño):

- Un solo módulo, cero scroll de página en la app del inversionista; todo lo demás son capas y transiciones sobre él.
- Se pagina, no se hace scroll, **y el eje es horizontal**: el catálogo es un riel lateral con anclaje obligatorio, el mismo en teléfono y escritorio. La rueda del ratón empuja de costado y ←/→ mueven una pantalla entera (tres tarjetas en escritorio, una en teléfono), sin botones de avance que dupliquen el gesto. La ficha avanza por pasos en los dos.
- Excepción honesta: dentro de la ficha y del panel lateral hay scroll interno en pantallas bajas. Rutas como `/solicitar` son documentos normales y sí scrollean.
- Calibrado a **390×844 y 1366×768**, en las cuatro superficies. El verificador es la única que no baja a 390: es la herramienta del operador, responde desde 768.
- El primer contacto no pide una wallet, pide una travesía: se elige inversionista o dueño de negocio y la wallet se crea como consecuencia. Al inversionista se le acredita saldo de prueba solo, en una pantalla dedicada; al dueño de negocio no, y esa asimetría se dice. Lo ya explicado no se repite (onboarding marcado en `localStorage`).

**Stack y restricciones técnicas:** Next.js 16 / React 19 con Tailwind v4; Privy como fuente de sesión y wallet; wagmi/viem para lectura, simulación, firma y receipts; Neon para datos fuera de cadena; recharts para gráficos; `motion` para animación. Build de producción en Webpack (Turbopack 16.3.0 entra en panic con PostCSS/local fonts en WSL). Contratos: Solidity/Foundry para identidad y registro, Rust Stylus para la máquina financiera. Arbitrum Sepolia con USDC de Circle como token canónico.

**Regla de implementación heredada, no negociable:** los componentes nunca leen colores literales, leen tokens. El sistema ya pasó por cinco identidades visuales distintas y cada giro costó horas en vez de días exactamente por eso. Cualquier mundo visual nuevo debe preservar esa propiedad.

**Terminología:** el término técnico vive en el código y la documentación; en pantalla se traduce a castellano llano (waterfall → orden de pago, haircut → castigo por tipo de activo, coverage ratio → cobertura de la garantía, escrow → retenido en contrato, APY → rentabilidad).

**Decisiones de dominio abiertas o de roadmap, no presentes hoy:** KYC automatizado, integración automática con SUNAT, ERC-3643 para transferencia restringida, indexer, auditoría, multi-deal simultáneo operado en vivo. El mercado secundario existe como libro de órdenes (no AMM: un pool tipo Uniswap es una mala herramienta para deuda con vencimiento fijo).

## Brand Commitments

- Nombre del producto: **Founding** (repo `fouding.eth`).
- **El copy es institucional, no de consumo.** Esto mueve capital real de terceros: nada de frases coloquiales como título. La ficha muestra el dato duro, titulado en castellano llano.
- Idioma de producto: español (Perú/Latam).
- Tipografía comprometida hoy: Mona Sans, familia única. Es la única constante visual que el usuario no puso en discusión; el resto del mundo visual es reemplazable.

## Evidence on Hand

Real y disponible:

- Contratos desplegados y funcionando: `MockUSDC → AccessRegistry → CompanyPassportSBT → CreditRegistry → CreditVault`, más `RepaymentRouter`, hitos/waterfall onchain, vaults por oportunidad y mercado secundario.
- Documentación de producto en `docs/`: propuesta, stack, plan de hackathon, sistema de diseño incumbente, checklist.
- Devnet Nitro local y despliegue en Arbitrum Sepolia con USDC de Circle.

Ausencias que el diseño **no debe fabricar**:

- **No existe SPV constituido.** El legal pack se muestra como documento diseñado con su hash anclado onchain; presentarlo como vehículo vigente sería falso, y decirlo bien es un punto a favor.
- **No hay cifra de brecha de crédito PyME con fuente citada todavía.** No inventar el número en pantalla.
- **No hay un caso de empresa real confirmado.** Los datos del catálogo son sembrados.
- `MockUSDC` es exclusivamente para desarrollo y **nunca debe presentarse como USDC oficial**.
- Sin auditoría, sin testimonios, sin clientes, sin benchmarks, sin pricing público.

## Product Principles

1. **La honestidad sobre qué es offchain es parte del producto.** El SPV, el underwriting humano y la ejecución de la garantía viven en el papel; la UI debe señalar dónde termina lo que el contrato garantiza y dónde empieza lo que garantiza un tercero.
2. **El camino de default es tan importante como el feliz.** Es el diferenciador y debe ser visible, no una letra chica.
3. **Explorar es libre; comprometer capital no.** La fricción de verificación se pone donde la regulación la exige, nunca antes.
4. **El dato duro se muestra; el término técnico se traduce.** No se simplifica quitando información, se simplifica nombrándola bien.
5. **Los incentivos son explicables en una frase.** El verificador cobra fijo; la plataforma gana cuando se paga, no cuando se aprueba.

## Accessibility & Inclusion

No hay un estándar formal comprometido con el usuario. Dos necesidades reales sí están establecidas por el contexto de uso: legibilidad en proyector durante la demo de 3 minutos, y que ningún estado del sistema (activa, pagada, en default, esperando decisión) dependa **solo** del color para distinguirse — el catálogo y los paneles ya se leen en escala de riesgo A–E y en estados que se repiten en gráficos.
