# Tus notas, traducidas — conceptos y qué cambia en el diseño

Cada concepto explicado en cristiano, y al final qué se modifica de [start.md](start.md) y [stack.md](stack.md).

---

## Parte 1 — Los conceptos, uno por uno

### Soulbound Token (SBT) → el "pasaporte de negocio"

Un token **soulbound** es un token que **no se puede transferir, vender ni regalar**. Se pega a la wallet que lo recibió. Estándar: **ERC-5192**.

Sirve para identidad y reputación, no para valor. El pasaporte de negocio guarda: RUC verificado, años de operación, rango de ventas validado, historial de pagos y score. Si pudiera venderse, una empresa con mal historial compraría el pasaporte de una buena — se rompe todo.

**Por qué es potente:** hoy una PyME que paga bien tres créditos no acumula nada; empieza de cero con cada prestamista. El pasaporte convierte el buen comportamiento en un activo portable. Segundo crédito → mejor tasa. Eso es reputación crediticia onchain y es un argumento fuerte de innovación.

### Escrow

La caja fuerte programable. El dinero de los inversionistas entra al contrato y **se queda ahí**. No lo tiene la plataforma, no lo tiene la empresa. Solo sale cuando se cumple una condición escrita de antemano (un hito aprobado). Esto ya estaba en el diseño y es el corazón del producto.

### Vault ("smart contracts del volt")

Un **vault** es un contrato que custodia fondos y lleva la contabilidad de quién es dueño de qué parte. Es el escrow + el registro de posiciones de cada inversionista + la lógica de reparto. Estándar de referencia: **ERC-4626** (bóvedas tokenizadas).

⚠️ *Si "volt" era otra cosa — el nombre de un proyecto que te mostraron — dime cuál y lo reviso.*

### Waitlist contract

Contrato de lista de espera. Alguien se registra onchain, queda en estado "pendiente", y un administrador aprueba o rechaza. Al aprobar, se le da acceso (se mintea el pasaporte o se agrega a la whitelist de inversionistas).

Es la puerta de entrada del marketplace permissioned. Es simple, y para el hackathon tiene una ventaja: **se puede desplegar el día uno y empezar a juntar registros reales** aunque el resto no esté listo.

### Underwriting engine

*Underwriting* = el proceso de decidir si prestar y en qué condiciones. El **motor de underwriting** es el código que toma los datos de la empresa (ventas, antigüedad, sector, colateral, historial) y escupe tres cosas:

1. **Score de riesgo** (ej. 0-1000).
2. **Tasa sugerida** — más riesgo, más APY.
3. **Monto máximo prestable** contra ese colateral.

Es lo que hoy hace un analista de riesgo en un banco con un Excel. Acá es una función determinista y auditable: mismos datos → mismo resultado, y cualquiera puede verificar por qué se aprobó.

### Verificador con **honorario fijo** — esta nota es la mejor de todas

El problema se llama **conflicto de agencia**: si a quien aprueba los créditos le pagas un porcentaje de lo que se aprueba, va a aprobar de más. Es literalmente lo que reventó en 2008 con las calificadoras de riesgo — cobraban del emisor y por eso todo era AAA.

La nota lo resuelve bien: **el verificador cobra una tarifa fija por expediente revisado, apruebe o rechace**. Su ingreso no depende del resultado.

Se puede reforzar con algo que solo se puede hacer onchain: el verificador **deja un depósito en garantía (stake)**, y si un proyecto que aprobó entra en default por algo que debió detectar —un gravamen no declarado, documentación falsa— pierde parte de ese depósito. Se llama *skin in the game*. Eso es innovación real con blockchain, no decorativa.

**Esto obliga a corregir el modelo de negocio de [start.md](start.md)**, donde tenía un "fee de éxito sobre capital levantado". Ese fee crea exactamente el sesgo que la nota quiere evitar. Lo separo abajo.

### SUNAT — verificación de ventas

Acá se define la jurisdicción: **Perú**. Lo que existe, en orden de dificultad:

| Fuente | Qué da | Acceso |
| --- | --- | --- |
| Consulta RUC (público) | Que la empresa existe, razón social, estado activo/habido, fecha de inicio | Libre. Hay APIs de terceros. Fácil. |
| Comprobantes electrónicos | Facturación real de la empresa | Requiere que la empresa delegue acceso con su Clave SOL. **Es así como los fintech de factoring peruanos validan ventas hoy.** |
| Declaraciones / reporte tributario | Ventas declaradas formalmente | La empresa lo genera y lo entrega. No es público. |

⚠️ **Hay que verificar los requerimientos exactos y los nombres vigentes de cada trámite** — no los des por ciertos desde este documento. Para el prototipo: la empresa sube el PDF y el verificador lo revisa a mano. La integración automática es fase 2.

**Lo importante del diseño:** la verificación produce un dato firmado que va al pasaporte ("ventas anuales verificadas: rango X"), no el documento crudo. El documento tiene datos sensibles y se queda en storage privado; onchain va solo su hash.

### Garantía + capital de trabajo del negocio

Dos cosas distintas que la nota junta:

**a) Garantía real (colateral).** Ya estaba. Lo que faltaba es *cómo se hace ejecutable en Perú*:
- **Garantía mobiliaria** para maquinaria y vehículos — se inscribe en un registro público de SUNARP, lo que la hace oponible frente a terceros y verificable por cualquiera.
- **Hipoteca** para inmuebles, también en SUNARP.
- **Fideicomiso de garantía** — un tercero regulado administra la garantía. Es la estructura más sólida y probablemente **mejor que el SPV** que tenía en `start.md`, pero es cara para tickets chicos.

⚠️ Los tres puntos requieren confirmación de un abogado peruano. Lo que sí importa del diseño: la garantía **se inscribe en un registro público**, y el número de inscripción se puede mostrar en la ficha de la oportunidad. Eso es verificable de verdad, no una promesa.

**b) Aporte propio del negocio (*skin in the game*).** Que la empresa ponga parte del proyecto de su bolsillo. Estándar en project finance: si el proyecto cuesta 100, la empresa pone 20-30 y se financian 70-80. Si el negocio sale mal, la empresa pierde primero. Cambia radicalmente el incentivo a cumplir.

Se agrega como campo del modelo: `aportePropioBps`, visible en la ficha.

**Qué hace el web2 en préstamos PyME (lo que preguntas):**
- **Aval solidario** — el dueño responde con patrimonio personal. Es lo más usado en Latam y no cuesta nada implementar: es una firma.
- **Fondo de reserva** — se retiene 10-15% del desembolso como colchón para las primeras cuotas.
- **Cesión de facturas** — los clientes de la empresa pagan directamente a una cuenta controlada.
- **Domiciliación de cobranza** — la recaudación pasa por una cuenta que el prestamista supervisa.

Los dos últimos son los más fuertes y **son los más fáciles de traducir a onchain**: si el repago viene de un flujo identificable, el riesgo baja mucho más que con una máquina embargable.

### Pools

"Pools" puede ser dos cosas distintas y hay que elegir:

**a) Pool de inversión** — en vez de elegir deal por deal, el inversionista pone USDC en un fondo que se reparte entre varios créditos. Diversifica el riesgo. Es más cómodo pero más opaco, y en fase 1 contradice el modelo de "una oportunidad, un colateral, un waterfall".

**b) Pool de liquidez (Uniswap)** — para poder comprar y vender los tokens de deuda. Es lo de tu nota siguiente.

⚠️ *Dime a cuál te referías, porque son productos distintos.*

### Uniswap y liquidity pools

Un **pool de liquidez** es un contrato con dos tokens dentro (ej. tu token de deuda + USDC) que permite intercambiarlos sin necesidad de que haya alguien del otro lado en ese momento. El precio lo pone una fórmula, no un comprador.

**Te lo digo derecho: un AMM tipo Uniswap es una mala herramienta para deuda con vencimiento fijo.** Razones: el precio de un bono depende del tiempo que falta y de la probabilidad de pago, no de la proporción de tokens en un pool; y quien pone liquidez pierde plata sistemáticamente con un activo que amortiza. Además cada oportunidad sería su propio token, con lo cual habría 50 pools sin volumen.

**Lo que sí funciona para dar liquidez a deuda privada** es un **libro de órdenes**: yo publico "vendo mi posición de 5,000 USDC del deal #12 a 4,800", alguien de la whitelist lo compra, el contrato hace el intercambio atómico. Es más simple de construir que un pool y refleja precios reales.

Si quieres igual la integración con Uniswap para el pitch, la vía correcta es un **hook de Uniswap v4** que valide contra la whitelist antes de permitir un swap. Es viable y es un ángulo llamativo, pero yo lo dejaría de roadmap, no de MVP.

---

## Parte 2 — La contradicción, y cómo se resuelve

Tu nota dice: **"los tokens de los inversionistas deben ser transferibles"**. En [stack.md](stack.md) yo había decidido lo contrario: token intransferible.

**Tienes razón tú, y la solución es intermedia.**

Mi argumento era regulatorio: si el token circula libremente, es indefendible sostener que el marketplace es cerrado. Tu argumento es de producto: sin poder vender, el inversionista queda atrapado 12 meses y eso mata el interés. Ambos son válidos.

La salida que usa la industria real de private credit tokenizado se llama **transferencia restringida**: el token **sí se transfiere, pero solo a wallets que pasaron el proceso de acceso**. La restricción está dentro del token: al intentar transferir, el contrato pregunta al registro "¿este receptor está aprobado?" y bloquea si no lo está. Es el estándar **ERC-3643**.

Resultado: hay liquidez, se puede vender, regalar y ceder — dentro del universo de inversionistas verificados. Nadie termina con un token de deuda peruana en un exchange anónimo.

Y ahí encaja perfecto tu otra nota:

| Token | Transferible | Por qué |
| --- | --- | --- |
| **Pasaporte de negocio** (SBT) | ❌ Nunca | Es identidad y reputación. Si se vende, se compra un historial ajeno. |
| **Posición del inversionista** | ✅ Sí, entre wallets verificadas | Es un activo financiero. Debe poder cederse. |

Es una arquitectura limpia y **es más fuerte que lo que tenía antes**. Entra al diseño.

---

## Parte 3 — Cómo gana dinero la plataforma

Tu pregunta marcada IMPORTANT. Respuesta concreta, con el punto exacto del contrato donde se cobra cada cosa:

| Fee | Cuánto (ejemplo) | Quién paga | Cuándo se cobra | A quién va |
| --- | --- | --- | --- | --- |
| **Verificación** | Fijo, ej. 300 USDC | La empresa | Al enviar el expediente, **antes** de saber el resultado | Al verificador |
| **Originación** | 2-3% del monto | La empresa | Se descuenta del primer desembolso | Plataforma |
| **Servicing** | 0.5-1% anual sobre saldo | La empresa | Se descuenta de cada repago | Plataforma |
| **Mora** | Penalidad diaria | La empresa | Al atrasarse | Se reparte con inversionistas |
| **Recupero en default** | Posición 2 del waterfall | Sale del recupero | En la liquidación | Plataforma |

Cambios respecto de `start.md`:

- **Se elimina el "fee de éxito sobre capital levantado"** — es el que crea el sesgo a aprobar. Lo reemplaza el fee de originación, que se cobra igual pero está desacoplado de la decisión de aprobar porque **quien aprueba no es quien lo cobra**.
- **El fee de verificación es fijo y va al verificador**, no a la plataforma.

La plataforma gana cuando los créditos **se pagan** (servicing sobre saldo vivo), no cuando se aprueban. Ese es el incentivo correcto y es explicable en una slide.

---

## Parte 4 — El esqueleto de la plataforma

Tu última pregunta. Seis contratos:

```
1. BusinessPassport      SBT (ERC-5192). Identidad y reputación de la empresa.
2. AccessRegistry        Quién puede invertir. Lo consulta todo lo demás.
3. Waitlist              Registro y aprobación de acceso.
4. UnderwritingEngine    Score, tasa sugerida y monto máximo.  ← candidato a Stylus
5. OpportunityVault      Escrow + posiciones + hitos + repago + waterfall.
6. PositionToken         ERC-20 transferible solo entre wallets verificadas.
```

Y fuera de cadena, porque tiene datos personales: expedientes, documentos, tasaciones y decisiones del verificador — en base de datos, con solo el hash anclado onchain.

---

## Parte 5 — Stylus: cambio de recomendación

En [hackathon.md](hackathon.md) te dije que no valía la pena. **Con el motor de underwriting sobre la mesa, cambio la recomendación.**

El scoring es cálculo puro: muchas variables, ponderaciones, simulación de escenarios de recupero. Eso en Solidity es caro y engorroso; en Rust sobre Stylus es natural y barato. Es el único componente del sistema donde Stylus se justifica de verdad y no queda forzado, y es exactamente lo que busca el bounty.

La condición no cambia: **primero el vault funcionando en Solidity**. El motor de scoring en Stylus va encima, con un fallback en Solidity por si falla en la demo.

---

## Lo que necesito que me aclares

1. **"Volt"** — ¿era *vault* (bóveda) o el nombre de un proyecto que te mostraron?
2. **"Empezar por el track intermedia"** — ¿el hackathon tiene niveles de dificultad, o te refieres a otra cosa?
3. **"Pools"** — ¿pool de inversión diversificado, o pool de liquidez para vender posiciones?
4. **¿Perú confirmado** como jurisdicción única para el MVP? Lo de SUNAT y SUNARP lo da por hecho.
5. **¿Estas notas salieron de un mentor del hackathon?** Si sí, importa: lo que un mentor sugiere suele reaparecer en la evaluación.

---

## Qué hago ahora

Estos cambios tocan `start.md` (modelo de negocio y transferibilidad), `stack.md` (estándares de token) y `hackathon.md` (Stylus). **No los toco todavía** — primero confírmame los cinco puntos de arriba, porque cambian cómo los escribo.

Mientras tanto puedo seguir con la Fase 1 del prototipo, que no depende de nada de esto.
