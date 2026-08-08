# Sistema de diseño — marketplace de inversión

**Decisión cerrada.** Marketplace de consumo profesional: superficies blancas sobre gris claro, **Chartreuse + Gun Metal** como identidad de marca, y tarjetas de producto con portada, avance de recaudación y calificación de riesgo. Referencia de arquitectura: plataformas de crowdfunding de inversión — pero con el **copy y la profundidad de un producto de crédito privado institucional**, no de una app de consumo.

> **Historial de iteraciones.** El sistema pasó por: oscuro con luz cromática → claro con luz cromática → monocromo mono → marketplace en azul → **Chartreuse + Gun Metal**. Cada giro costó horas y no días porque **los componentes nunca leen colores literales: leen tokens**. Esa es la regla que hay que preservar por encima de cualquier estética concreta.

Fuente de verdad ejecutable: [packages/nextjs/app/globals.css](packages/nextjs/app/globals.css). Si este documento y el CSS discrepan, gana el CSS.

---

## 1. Los cinco principios

1. **Un solo módulo, cero scroll de página.** El catálogo es la aplicación; todo lo demás son capas y transiciones sobre él.
2. **Chartreuse es relleno, nunca texto.** Es un verde-amarillo muy claro: ilegible como tipografía o borde fino sobre blanco. Se usa solo en superficies de relleno (botones, chips, barras); todo texto o ícono "de marca" usa `--brand-ink` (Gun Metal) encima, nunca `--brand` directo. Ver §4.
3. **El color semántico solo aparece cuando el dato lo exige**: verde para lo que va bien, ámbar para lo que espera decisión, rojo para pérdida e incumplimiento.
4. **Una sola familia tipográfica.** Mona Sans en todo el producto; la jerarquía la marca el peso, no la fuente.
5. **El copy es institucional, no de consumo.** Esto mueve capital real de terceros. Nada de "si algo sale mal" ni frases coloquiales como título — ver §8.
6. **Calibrado para 1366×768.** Una pantalla de trabajo debe entregar lo esencial sin scroll.

---

## 2. Tokens

```css
:root {
  /* Superficies */
  --bg:           #F6F7F9;   /* fondo de página */
  --surface:      #FFFFFF;   /* tarjetas y barras */
  --surface-soft: #FAFBFC;   /* cabeceras de tabla, zonas secundarias */

  /* Neutros */
  --border:        #E4E7EC;
  --border-strong: #D0D5DD;
  --text-hi:       #00272B;   /* Gun Metal — reemplaza el gris casi negro */
  --text-mid:      #475467;
  --text-low:      #667085;   /* 4.98:1 sobre --surface, 4.64:1 sobre --bg */

  /* Marca — Chartreuse para relleno, Gun Metal como tinta legible.
     Chartreuse pierde contraste como texto/borde fino sobre blanco:
     se usa solo en superficies de relleno (botones, barras, chips),
     siempre con --brand-ink encima, nunca como texto directo. */
  --brand:        #E0FF4F;
  --brand-hover:  #CBE93A;
  --brand-ink:    #00272B;
  --brand-soft:   #F8FFDF;
  --brand-border: #D8EF85;
  --brand-strong: #6F8000;   /* chartreuse oscurecido: barras, puntos, íconos */

  /* Semánticos, apagados a propósito */
  --positive: #147A54;   --positive-soft: #E7F4EE;
  --warning:  #A4671A;   --warning-soft:  #FDF3E7;
  --negative: #B3261E;   --negative-soft: #FBECEB;

  /* Geometría */
  --r-card: 10px;  --r-panel: 8px;  --r-input: 8px;  --r-pill: 999px;

  /* Shell y anchos de contenido — tres medidas, no cuatro literales */
  --shell-max: 1240px;  --shell-min: 1120px;
  --w-wide:  1240px;   /* ficha de operación: la capa más ancha */
  --w-panel:  980px;   /* panel lateral: portafolio, perfil */
  --w-doc:    860px;   /* documento y formulario: negocios, solicitud, verificador */

  /* Elevación */
  --shadow-sm: 0 1px 2px rgba(16,24,40,0.05);
  --shadow-md: 0 4px 12px -2px rgba(16,24,40,0.10);
  --shadow-lg: 0 12px 28px -8px rgba(16,24,40,0.16);
}
```

### Dos correcciones de agosto 2026, con su motivo

**`--text-low` pasó de `#98A2B3` a `#667085`.** El valor viejo medía 2.58:1 sobre blanco y 2.40:1 sobre `--bg` — por debajo incluso del piso de 3:1 para elementos no textuales. Y es el color de la clase `.label`, que titula **cada métrica del producto**: el token más repetido era el que menos se leía. Se usaba 85 veces.

**`--brand-strong` es nuevo, y existe porque `--brand` no puede sostenerse solo en una superficie pequeña o delgada.** Chartreuse sobre la pista `--border` mide 1.10:1: la barra de avance de recaudación —una por tarjeta, más la del panel de inversión— era literalmente invisible. Lo mismo pasaba con el punto activo del paginador, que a 1.30:1 se veía *más claro* que los inactivos.

La regla resultante, que reemplaza la de §4:

| Rol | Token | Por qué |
| --- | --- | --- |
| Relleno grande con texto encima | `--brand` | Botón, chip seleccionado, monograma. `--brand-ink` encima da 14:1 |
| Relleno pequeño o delgado, sin texto | `--brand-strong` | Barra de avance, punto de paginador, ícono de estado |
| Texto, ícono sobre neutro, borde fino | `--brand-ink` | Subrayado de pestaña, enlaces, borde de silueta |
| Wash decorativo que no comunica estado | `--brand-soft` | Fondo de `CoverArt`, chip de ícono |

`--brand-border` (1.26:1) queda solo para separadores decorativos. No sirve para nada que haya que ver.

---

## 3. Tipografía

Una sola familia en todo el producto: **Mona Sans** (variable, pesos 200–900). La jerarquía se marca con peso y tamaño, no con familias distintas.

| Uso | Clase | Peso |
| --- | --- | --- |
| Títulos | `.h1` (30px), `.h2` (19px), `.h3` (15px) | 600–700 |
| Etiquetas | `.label` — 11px, mayúsculas, tracking 0.06em | 600 |
| Cuerpo base | — | 14px / 1.55, 400 |
| Toda cifra | `.num` — tabular por defecto | hereda el peso del contexto |

---

## 4. Color semántico

| Situación | Token | Dónde aparece |
| --- | --- | --- |
| Marca, acción, rentabilidad, "te corresponde" | `--brand` (relleno) / `--brand-ink` (texto e íconos) | Botón primario, APY, tramos del waterfall que son del inversionista |
| Va bien: activa, pagada, cobertura suficiente, ganancia | `--positive` | Estado, coverage ≥ 1x, ganancia estimada |
| Espera decisión, castigo aplicado | `--warning` | Hito presentado, haircut |
| Pérdida o incumplimiento | `--negative` | Estado en default, cobertura < 1x, recupero parcial |

La calificación de riesgo recorre la escala: **A** positivo, **B** marca, **C/D** ámbar, **E** rojo.

**Regla no negociable — sin relleno de color.** Ninguna superficie que comunique un estado (pill, tarjeta, banner, badge) lleva fondo teñido del color semántico. El fondo es siempre `--surface` (o `--surface-soft` si es neutro); el color solo aparece en **borde y texto/ícono, en el mismo tono pleno** — nunca tres variaciones del mismo color (fondo tenue + borde medio + texto pleno). Motivo: la combinación de relleno+borde+texto en tonos distintos se ve saturada y amateur; un borde+texto sólido sobre fondo neutro se ve profesional y es lo que ya usa `Pill`/`StatusPill`, `Button` (`soft`), y los paneles de estado (`CollateralPanel`, `PassportPanel`, `ActivityRow`, `MilestoneTimeline`, `WaterfallPanel`).

Los tokens `--positive-soft`, `--warning-soft`, `--negative-soft` y `--brand-soft` quedan reservados **solo** para washes puramente decorativos que no comunican un estado (fondo de `CoverArt`, chip de ícono en `Onboarding`) — nunca para tarjetas, pills o banners de información.

---

## 5. Componentes

- **`card`** — superficie blanca, borde 1px, sombra mínima. Unidad de composición. `card-hover` añade elevación y desplazamiento de 2px.
- **`Button`** — `primary` (`--brand` sólido, texto `--brand-ink`), `outline`, `soft` (fondo `--surface`, borde y texto `--brand-ink`), `ghost`, `danger`. Tres tamaños; 40px de alto en `md`.
- **`Pill` / `StatusPill`** — fondo `--surface`, borde y texto en el mismo tono pleno, con punto de color. Sin relleno teñido.
- **`ProgressBar`** — azul sobre `--border`. Verde cuando la ronda ya cerró.
- **`Row` / `Metric` / `MetricCard`** — etiqueta + cifra en `.num`.
- **`Table`** — cabecera en `--surface-soft`, filas con separador de 1px.
- **`Field`** — input blanco, borde neutro, foco en azul.
- **`OpportunityCard`** — la pieza central. Banda superior con monograma de la empresa, ciudad y sector; título; etiquetas; rentabilidad grande en azul y meta; recaudado con barra de avance; inversionistas y días restantes; pie con calificación y cobertura.
- **`frosted`** — vidrio esmerilado, único resto del glassmorphism original. Se usa solo donde algo se superpone al contenido: la barra fija superior.

---

## 6. Arquitectura: un módulo, cero scroll

**No hay rutas ni scroll de página.** La aplicación es **una sola pantalla** (`h-screen`, `overflow: hidden` en `body`); todo lo demás son capas y transiciones sobre ella.

| Capa | Rol | Cómo entra |
| --- | --- | --- |
| `AuthFlow` | Primer contacto: **wallet generada al instante, sin pedir datos** | Pantalla completa, **sin cabecera ni pie** |
| `Onboarding` | Explicación en 4 pasos | Pantalla completa, **una sola vez por navegador** |
| `Deck` | Catálogo paginado de operaciones | Base de la aplicación |
| `DetailOverlay` | Ficha de la operación, en 6 pasos | Diálogo que crece desde el centro |
| `PortfolioPanel` | Posiciones y movimientos | Panel lateral desde la derecha |

Reglas de esta arquitectura:

- **El primer contacto no tiene chrome ni formulario.** Un botón crea la wallet y entras. Nadie necesita registrarse para mirar un catálogo.
- **La verificación se mueve al momento de invertir**, que es donde la regulación la exige. Explorar es libre; comprometer capital no. Esta puerta **todavía no está construida** — ver `build-plan.md`.
- **Lo que ya se explicó no se repite.** El onboarding se marca como visto en `localStorage` y no vuelve; queda accesible desde el botón de ayuda de la barra.
- **Se pagina, no se hace scroll.** El catálogo avanza por páginas (flechas, puntos o teclado ←/→) y la ficha avanza por pasos.
- **Excepción honesta:** dentro de la ficha y del panel lateral el contenido puede desbordar en pantallas bajas; ahí sí hay scroll interno. Es la válvula de seguridad, no el patrón.

**Alcance:** el sistema cubre **cuatro superficies**, no una. La regla de un módulo sin scroll aplica solo a la primera.

| Superficie | Rutas | Arquitectura |
| --- | --- | --- |
| Inversionista | `/`, `/login` | Módulo único, cero scroll de página, capas y paginación |
| Empresa | `/negocios`, `/solicitar` | Documento normal con scroll; overlay para el asistente de solicitud |
| Verificador | `/verifier` | Herramienta de trabajo: cabecera fija + secciones, un trabajo a la vez |
| Puerta de rol | `/rol` | Pantalla de elección, sin chrome |

Las tres últimas **no** heredan el cero-scroll: son documentos y herramientas, y forzarlas a la pantalla única fue lo que las dejó sin diseñar. Lo que sí heredan es todo lo demás — tokens, tipografía, movimiento, componentes y lenguaje.

**El verificador se ordena por secciones, no por apilamiento.** Tenía cuatro herramientas —subir documentos, cola de expedientes, acceso de inversionistas, servicing— apiladas en una columna como hermanas de igual peso, así que la pantalla del operador tenía cuatro trabajos sin jerarquía. Ahora son pestañas con la cola por defecto y el contador de pendientes en la cabecera: un trabajo a la vez.

---

## 7. Movimiento

El movimiento es parte del sistema, no del componente. Todo sale de [packages/nextjs/lib/motion.ts](packages/nextjs/lib/motion.ts).

**Criterio: en una plataforma financiera el movimiento debe orientar, no entretener.** Indica de dónde viene y hacia dónde va cada cosa; nunca llama la atención sobre sí mismo.

```
EASE  [0.22, 0.9, 0.3, 1]     una sola curva en todo el producto
DUR   fast 0.20  base 0.28  slow 0.40
```

| Variante | Uso |
| --- | --- |
| `fadeUp` | Aparición estándar de un bloque |
| `stagger()` | Entrada escalonada de listas y tarjetas |
| `slide(dir)` | Pasos y páginas del carrusel — la dirección indica el sentido de avance |
| `dialog` + `scrim` | Ficha de operación y modales |
| `sheet` | Panel lateral |
| `press` | Respuesta táctil de todo lo pulsable (`y: -1` al pasar, `scale: 0.97` al presionar) |
| `T.indicator` | Subrayado que se desplaza entre pestañas (`layoutId`) |
| `T.spring` | **Solo** confirmaciones de una acción del usuario |

Dos detalles que hacen la diferencia:

- **`AnimatedNumber`** — las cifras transicionan al cambiar. Cuando inviertes, el saldo no salta: baja. Es lo que más hace sentir que detrás hay una cuenta viva.
- **`layoutId`** en los subrayados de pestañas: el indicador se desplaza entre secciones en vez de reaparecer.

Reglas: una sola curva; nada rebota salvo confirmaciones; las transiciones de entrada y salida siempre son direccionales y coherentes entre sí.

**Agosto 2026 — esta sección describía una intención, no el código.** `slide()`, `sheet` y `T.indicator` estaban exportados y **no se importaban en ningún lado**; la curva estaba escrita a mano como literal `[0.22, 0.9, 0.3, 1]` en ocho archivos, con cinco duraciones ad-hoc donde el sistema define cuatro. Ese es el mecanismo exacto por el que las superficies nuevas se sintieron como otro producto: cada autor reinventaba el movimiento porque nadie estaba obligado a leerlo de acá.

Ahora los ocho consumen `lib/motion.ts`. `DUR.count` (0.7s) se agregó para `AnimatedNumber`: es más largo que cualquier transición de UI a propósito, porque ahí el movimiento **cuenta algo** en vez de orientar. Es la única excepción y está nombrada.

`prefers-reduced-motion: reduce` corta todo a 0.01ms en `globals.css`, y `AnimatedNumber` salta directo a la cifra final.

---

## 7.1 Teclado y capas — `lib/keyboard.ts`

La aplicación es una pantalla con capas encima. Si cada capa engancha su listener a `window`, **todas escuchan a la vez**: Escape cerraba el modal de confirmación *y* la ficha que lo contenía, perdiendo el monto tecleado, y ← movía el cursor dentro del campo de monto mientras paginaba el catálogo de atrás. Había seis listeners de Escape apilados.

Hay una pila. Solo la capa de arriba actúa, y la base solo actúa cuando no hay ninguna capa abierta.

| Hook | Para | Regla |
| --- | --- | --- |
| `useLayerKeys({ onEscape, onPrev, onNext, active })` | Ficha, paneles, modales | Se registra en la pila; actúa solo si es la de arriba. Escape hace `stopPropagation` |
| `useBaseKeys({ onPrev, onNext })` | El catálogo | Actúa solo si `layersOpen() === 0` |
| `useFocusTrap(active)` | Los seis overlays | Lleva el foco al panel, lo mantiene dentro, lo devuelve al disparador al cerrar |
| `isTypingTarget(target)` | Interno | Un campo editable se queda con las flechas |

**Ningún componente vuelve a llamar `window.addEventListener("keydown", …)` por su cuenta.** Igual que con los colores y el movimiento: sale de acá.

---

## 7.2 Accesibilidad — el piso

No hay un estándar formal comprometido, pero estas cinco cosas dejaron de ser opcionales:

1. **Contraste medido, no estimado.** Texto ≥4.5:1, elementos de UI ≥3:1. El barrido en vivo sobre estilos computados debe dar cero nodos por debajo del piso en las cuatro rutas.
2. **Ningún estado depende solo del color.** La cobertura insuficiente cambia el ícono a `ShieldX` *y* dice "insuficiente"; los tramos del inversionista en el waterfall llevan borde de tinta *y* la palabra "te corresponde"; la verificación pendiente en la barra lleva ícono *y* la palabra "Sin acceso".
3. **`.focusable` en todo control propio.** Es la misma regla de foco que ya tenía `Button`, disponible como clase. Tarjetas, pestañas, chips, puntos de paginador y filas de tabla la llevan. `Field` la resuelve en el envoltorio porque el input anula su propio contorno.
4. **Los diálogos son diálogos.** `role="dialog"`, `aria-modal`, `aria-labelledby`, trampa de foco y restauración. Las tiras de pestañas son `role="tablist"` con `aria-selected`.
5. **Los errores se anuncian.** `role="alert"` en el mensaje de `Field` y en los errores de decisión del verificador.

Un objetivo pulsable suelto mide al menos 24px de alto — un enlace en medio de un párrafo está exento, uno que vive solo no.

---

## 8. Lenguaje

El copy dejó de ser técnico donde no aportaba. La ficha muestra el dato duro, pero titulado en castellano llano:

| Antes | Ahora |
| --- | --- |
| Waterfall de pagos | Orden de pago si algo sale mal |
| Cronograma de hitos | Cronograma de desembolsos |
| Haircut | Castigo por tipo de activo |
| Coverage ratio | Cobertura de la garantía |
| Escrow | Retenido en contrato |
| APY | Rentabilidad |

Los términos técnicos siguen en el código y en la documentación de producto; en pantalla se traducen.

---

## 9. Reglas duras

- ✅ Un solo módulo **en la superficie del inversionista**. Se pagina y se navega por capas, nunca por scroll de página.
- ✅ Toda cifra en `.num`.
- ✅ El color semántico se usa por significado, nunca por decoración.
- ✅ Diseñar para 1366×768.
- ✅ **Los componentes leen tokens, nunca literales.** Vale para color, y desde agosto 2026 también para **geometría** (`--w-wide`/`--w-panel`/`--w-doc`) y **movimiento** (`lib/motion.ts`). Esta era la regla que el proyecto decía tener y solo cumplía para color.
- ✅ **Un estado, un nombre.** Los cinco estados salen de `STATUS_LABEL`. Llegó a haber tres nombres para `funding` —"En recaudación", "En fondeo", "Levantando capital"— visibles a dos clics de distancia.
- ✅ **Toda acción irreversible se confirma**, y con el mismo peso: si borrar la cuenta tiene un modal diseñado, declarar un incumplimiento y emitir un pasaporte soulbound también. Nada de `window.confirm`.
- ✅ **Todo rechazo lleva motivo.** El dashboard de la empresa le promete al dueño que puede "corregir lo observado": si el verificador no tiene dónde escribirlo, esa promesa es mentira.
- ✅ **Ninguna respuesta no-2xx se traga en silencio.** `if (res.ok) await load()` sin `else` es un bug de diseño, no de red.
- ❌ Sin degradados.
- ❌ Sin sombras de color.
- ❌ Sin `backdrop-filter` en filas de listas largas — solo en la barra pegajosa de `/negocios`, que es el único sitio donde algo se superpone a contenido que scrollea.
- ❌ Sin antetítulos (`label` en 11px encima de un `h1`). El titular se sostiene solo; si el antetítulo tenía información —como las etapas del onboarding— esa información va a la navegación, no encima del título.
- ❌ Sin tres tarjetas del mismo tamaño con ícono, título y texto como estructura de página. Es el contenedor perezoso y se nota.
- ❌ Sin breakpoints responsive en la superficie del inversionista: desktop only. Las otras tres sí responden.

---

Cualquier componente nuevo se deriva de acá. Si algo no se resuelve con estas piezas, se extiende el sistema en este archivo — no se improvisa en el componente.
