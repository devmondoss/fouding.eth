# Propuesta de proyecto: private credit tokenizado sobre Arbitrum

## One-liner

Plataforma de financiamiento privado onchain para empresas de Latam con tracción comprobable, donde proyectos específicos se fondean en USDC sobre Arbitrum y el capital queda respaldado por garantías reales estructuradas mediante un vehículo legal, con desembolso por hitos verificables y derechos económicos tokenizados para inversionistas. `[cite:5][cite:18][cite:39][cite:42]`

---

## Problema

En Latam, muchas empresas con ventas reales, activos y operación sostenida siguen teniendo dificultades para acceder a financiamiento flexible de corto y mediano plazo para proyectos específicos. La banca tradicional suele ser lenta, rígida y poco adecuada para estructuras con desembolso por hitos, mientras los mercados privados siguen siendo opacos para inversionistas y emisores. `[cite:18][cite:39][cite:57]`

Además, tokenizar activos o deuda no elimina por sí solo los riesgos centrales del crédito privado. La ejecutabilidad legal, el análisis de riesgo, la estructura contractual y la gestión del colateral siguen siendo indispensables, incluso cuando la emisión y liquidación se hagan onchain. `[cite:39][cite:42][cite:44][cite:56]`

---

## Solución

La propuesta se estructura como un **marketplace permissioned de oportunidades de private credit** para empresas de Latam con al menos 2 años de operación, ventas verificables y activos elegibles como colateral. Cada oportunidad financia un proyecto específico con plazo entre 8 y 12 meses, APY fijo, capital recaudado en USDC y cronograma de hitos verificables. `[cite:39][cite:42]`

La garantía real **no se tokeniza como propiedad fraccionada del activo**, sino que se canaliza mediante un SPV u otro vehículo legal que recibe la garantía y emite una participación económica digital asociada a una oportunidad concreta. Este enfoque se alinea mejor con las estructuras institucionales de tokenized private credit, donde el wrapper legal conecta los derechos offchain con la representación digital onchain. `[cite:42][cite:52][cite:58]`

Arbitrum se utiliza como capa operativa para tokenización, escrow, settlement en stablecoins y ejecución programable de hitos. Esto encaja con su posicionamiento como infraestructura para finanzas onchain, tokenización y aplicaciones empresariales con mayor eficiencia operativa que Ethereum L1. `[cite:5][cite:18]`

---

## Propuesta de valor

### Para la empresa

- Acceso a liquidez para proyectos concretos sin depender de un préstamo bancario genérico.
- Posibilidad de estructurar una operación respaldada por activos existentes.
- Desembolso por hitos, lo que reduce mal uso de capital y mejora trazabilidad. `[cite:18][cite:39]`

### Para el inversionista

- Acceso a oportunidades primarias de private credit con retorno pactado.
- Visibilidad sobre proyecto, cronograma, colateral, waterfall y estado del préstamo.
- Derecho económico sobre pagos ordinarios y, en caso de default, sobre el recupero del colateral, total o parcial. `[cite:39][cite:42][cite:53]`

### Para el ecosistema Arbitrum

- Caso de uso serio de stablecoins, tokenización y private credit.
- Aplicación real de infraestructura financiera programable sobre Arbitrum. `[cite:5][cite:18]`

---

## Estructura del producto

### Supuestos adoptados

| Parámetro | Definición |
| --- | --- |
| Instrumento | Participación económica tokenizada por oportunidad específica |
| Stablecoin principal | USDC |
| Acceso | Permissioned |
| Validación de hitos | Admin o multisig |
| Mercado secundario | Sin mercado secundario en fase 1 |
| Plazo | 8 a 12 meses |
| Rendimiento | APY fijo |
| Default | Impago, fraude documental o incumplimiento material de obligaciones |

### Estructura legal y operativa

1. La empresa prestataria solicita financiamiento para un proyecto específico.
2. El originador evalúa elegibilidad, ventas, documentación y activo en garantía.
3. Un SPV o vehículo legal equivalente recibe la garantía real y firma la documentación principal.
4. El SPV emite el instrumento económico tokenizado asociado a esa oportunidad.
5. Inversionistas verificados fondean la oportunidad en USDC sobre Arbitrum.
6. El smart contract mantiene el capital en escrow y libera fondos por hitos aprobados.
7. Si el proyecto cumple, la empresa devuelve principal más interés.
8. Si hay default, el SPV activa la ejecución y liquidación del colateral, y distribuye el recupero según un waterfall predefinido. `[cite:39][cite:42][cite:52][cite:58]`

---

## User flow

### Flujo de la empresa

1. Conecta wallet y crea solicitud.
2. Define monto, plazo, APY y proyecto a financiar.
3. Sube documentación de ventas, RUC y activo en garantía.
4. Espera aprobación del originador.
5. Una vez completada la ronda, observa el capital en escrow.
6. Recibe liberaciones parciales según hitos aprobados.
7. Devuelve principal más rendimiento al vencimiento.

### Flujo del inversionista

1. Conecta wallet y pasa proceso de acceso.
2. Revisa oportunidades disponibles con métricas clave.
3. Invierte USDC en una oportunidad específica.
4. Recibe el token que representa su derecho económico.
5. Hace seguimiento del estado del proyecto y los hitos.
6. Cobra rendimiento normal o participa del recupero si ocurre default.

### Flujo del administrador / originador

1. Revisa documentación legal y financiera.
2. Valora el colateral con metodología conservadora.
3. Publica la oportunidad con score y disclosure.
4. Aprueba o rechaza hitos.
5. Activa el proceso de default cuando corresponda.
6. Gestiona la distribución del recupero. `[cite:39][cite:42][cite:44]`

---

## Cobertura y colateral

### Política recomendada

El proyecto **no debe usar valor en libros como criterio decisivo**. El valor en libros es una referencia contable, pero el crédito debe evaluarse contra valor de liquidación estimado, aplicando haircuts y costos esperados de ejecución. Esa disciplina es importante porque la tokenización no transforma un activo ilíquido en liquidez inmediata ni elimina el riesgo de pérdida parcial. `[cite:44][cite:56]`

- Activos aceptados: maquinaria, vehículos e inmuebles.
- Revisión documental de titularidad.
- Análisis de gravámenes o cargas previas.
- Haircut por clase de activo.
- Cálculo de valor neto recuperable estimado.
- Coverage ratio visible para inversionistas. `[cite:39][cite:44][cite:58]`

### Waterfall de pagos

En caso de default y ejecución del colateral, la cascada de distribución propuesta es:

1. Costos legales y de liquidación.
2. Fee operativo o servicing previamente pactado.
3. Devolución proporcional de principal a inversionistas.
4. Pago de intereses, si el recupero alcanza.
5. Excedente residual, si existiera.

Esta estructura hace explícito que el inversionista tiene un derecho económico sobre el recupero y que la recuperación puede ser total o parcial. `[cite:39][cite:42][cite:53]`

---

## Modelo de negocio

El modelo de negocio más realista no depende de especulación ni de mercado secundario, sino de fees de estructuración y administración:

- **Fee de originación** a la empresa emisora.
- **Fee de éxito** sobre capital efectivamente levantado.
- **Fee de servicing** por administración de escrow, seguimiento y reportes.
- **Fee legal o documental** para operaciones complejas.

Esta lógica se parece más a infraestructura de private credit que a una app cripto especulativa, y es consistente con cómo se diseñan plataformas más serias de tokenización crediticia. `[cite:39][cite:42][cite:55]`

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Ejecutabilidad legal del colateral | Crítico | SPV o wrapper legal que mantenga la garantía y documentación ejecutable. `[cite:39][cite:52]` |
| Riesgo crediticio del borrower | Crítico | Underwriting mínimo, scoring, filtros de elegibilidad y aprobación manual. `[cite:39][cite:42]` |
| Sobrevaloración del activo | Alto | Haircuts y foco en valor neto recuperable, no en valor en libros. `[cite:44]` |
| Riesgo regulatorio | Alto | Marketplace permissioned, KYC, whitelisting y expansión por jurisdicción. `[cite:41][cite:42][cite:44]` |
| Riesgo de hitos mal verificados | Alto | Validación híbrida con evidencia documental y aprobador humano o multisig. `[cite:39]` |
| Riesgo técnico del smart contract | Alto | Contratos simples, pausables y con alcance de MVP limitado. `[cite:39][cite:44]` |
| Riesgo de stablecoin | Medio | Usar USDC como activo principal y definir contingencias operativas. `[cite:37][cite:45][cite:49]` |

---

## Qué no debe prometer el pitch

Para mantener credibilidad, el proyecto **no debe afirmar** que:

- la blockchain elimina el riesgo crediticio;
- la garantía se liquida automáticamente solo por existir un smart contract;
- el recupero será siempre total;
- el token equivale a propiedad directa del inmueble o activo;
- el producto puede abrirse al retail masivo desde el día uno.

La tesis correcta es otra: la plataforma mejora coordinación, trazabilidad, settlement y transparencia de una operación de private credit, pero mantiene una capa legal y operativa híbrida donde siguen siendo esenciales el originador, el wrapper legal y el análisis de riesgo. `[cite:39][cite:42][cite:44][cite:56]`

---

## Posicionamiento final

El proyecto debe presentarse como una **infraestructura de private credit onchain para empresas con tracción y activos reales**, no como simple crowdfunding empresarial. Esa formulación encaja mejor con la lógica de tokenized private credit, con el uso de stablecoins y con la propuesta de Arbitrum como infraestructura financiera programable. `[cite:5][cite:18][cite:39][cite:42]`
