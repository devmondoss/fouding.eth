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
6. **Calibrado para 390×844 y 1366×768.** Una pantalla debe entregar lo esencial sin scroll de página, en el teléfono y en el escritorio. Ver §6.1.

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
- **`Logo` / `Wordmark`** — la marca. Un asterisco tipográfico en Mona Sans sobre un cuadro `--brand`. Sale de un solo sitio: estaba copiada a mano en cuatro archivos con tres tamaños distintos, y el glifo lo ponía una librería de íconos.
- **`Waiting`** — la espera. Una regla de 2px que barre su pista. Reemplaza al spinner en las once superficies donde aparecía. `WaitingScreen` es la versión a pantalla completa.
- **`Choice` / `ChipChoice`** — radiogroup de verdad, con punto que se rellena. No es una fila de botones y la marca no es un check.

---

## 5.1 Sin iconografía — regla dura

**Ningún ícono de librería, en ninguna superficie.** No `lucide-react`, no `heroicons`, no `react-icons`. La regla la sostiene ESLint (`no-restricted-imports` en `packages/nextjs/eslint.config.mjs`), no la buena voluntad.

**Y dentro de un botón, nunca un glifo.** La etiqueta tiene que completar el concepto sola: si hace falta un dibujo para entender "Aprobar", el problema es la palabra. `Button` ya no acepta `icon` ni `iconRight` — la prop no existe, así que no hay dónde reincidir.

**Motivo.** El producto tenía 33 archivos importando `lucide-react` y unos 60 glifos en pantalla: escudos de estado, flechas en cada botón de avance, checks verdes por viñeta, chips de ícono en el onboarding, un aro girando en once sitios. Es la estampa exacta de una interfaz generada, y en una plataforma que mueve capital de terceros esa estampa cuesta credibilidad — un jurado y un dueño de PyME la leen igual. La anti-referencia de §1 ("si parece una app cripto, está mal") se extiende: **si parece hecho con IA, está mal**.

**Qué reemplaza a qué:**

| Caso | Antes | Ahora |
| --- | --- | --- |
| Acción en un botón | `icon` + etiqueta | Solo la etiqueta |
| Cerrar una capa | `<X />` | La palabra "Cerrar" |
| Paginar, avanzar, volver | Chevrón / flecha | "Anterior" / "Siguiente" / "Atrás" |
| Espera | `<Loader2 className="animate-spin" />` | `Waiting` (`.waiting` en `globals.css`) |
| Espera dentro de un control | Spinner sustituyendo la etiqueta | `.working` — barre el borde inferior, la etiqueta no se mueve |
| Estado (cobertura, verificación, hito) | Dos escudos que solo cambian de color | La palabra: "Suficiente"/"Insuficiente", "Con acceso"/"Sin acceso", "hecho"/"pendiente" |
| Viñeta de una lista de hechos | Check verde | `.marker` — cuadro de marca de 6px |
| Selección en un radiogroup | Check | Punto que se rellena (`Dot` en `Choice`) |
| Copiar / copiado | Dos glifos de 12px | "Copiar" / "Copiado" |
| Portada de la operación | Ícono de sector | Patrón de la garantía, inclinado por sector |
| Confirmación de una acción | Medallón con candado o billetera | La cifra, con el `T.spring` puesto en ella |

El check verde merece una nota aparte: además de genérico, **afirmaba de más**. Puesto como viñeta de "Aspectos destacados" o de "Qué necesitas para calificar", decía "verificado" sobre frases que son declaraciones del expediente o requisitos por cumplir.

**Excepción nombrada:** `utils/scaffold-eth/notification.tsx` sigue con heroicons. Es andamio de scaffold-eth que ningún archivo de `app/` o `components/` alcanza —su toast no se pinta nunca— y está eximido explícitamente en la config de ESLint. Si algún día un hook de scaffold se usa de verdad, ese toast entra al barrido.

**Cinco superficies quedan pendientes en esta rama**, y no por criterio: `app/verifier/page.tsx`, `PassportPanel`, `BusinessDashboard`, `SolicitudWizard` y `PublishOpportunityForm` se barrieron en el árbol de trabajo, pero dependen de `lib/verifier/submission.ts` y de campos nuevos de `VerifierSubmission` que llegan con el trabajo del bucle de expedientes. Entran cuando esa rama aterrice. Hasta entonces, la regla de ESLint y el `Button` sin `icon` hacen fallar el lint y el typecheck en esos cinco archivos — **es el resultado esperado del corte, no una regresión**.

---

## 5.2 Lo que no se explica

**Una superficie no explica cómo funciona por dentro.** El dato en pantalla vale más que el párrafo que lo narra, y si el dato ya está, el párrafo es ruido.

Se retiró, en las cuatro superficies:

- **La glosa del estado.** La píldora dice "En revisión"; la línea debajo que volvía a decirlo en prosa se fue (`DetailOverlay`, `ProfilePanel`).
- **El procedimiento interno.** Contra qué se contrasta el RUC, qué es un token soulbound, cómo se calcula el valor neto recuperable, qué define el verificador después.
- **La doctrina junto al botón.** "Explorar el catálogo es libre; comprometer capital exige…" delante de un botón que dice "Solicitar acceso". "Tu honorario es fijo: no cambia si apruebas o rechazas" al lado de Aprobar/Rechazar.
- **La repetición.** El recibo de inversión volvía a explicar hitos y prelación por tercera vez a alguien que ya invirtió.
- **El desplegable para leer una línea.** El "Ver detalle técnico" de `InvestPanel` era un control extra para mostrar texto que cabía debajo del titular.

Se queda: **la restricción** ("Mínimo 10 000 USDC", "11 dígitos", "No se puede cambiar"), **la consecuencia irreversible** ("No se revierte", "Se borra tu wallet"), **el riesgo antes de firmar** ("Sin comprador, el capital queda inmovilizado") y **la honestidad sobre el dato** ("Catálogo de demostración", "Declarado", "Referencial").

Criterio para decidir: si la frase se puede borrar y la persona igual sabe qué hacer y qué le puede pasar, se borra.

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

## 6.1 El teléfono — agosto 2026

**El cero-scroll no se abandonó en móvil: cambió de eje.** Hasta este cambio, debajo de `lg` el catálogo era una lista vertical corriente y `body.app-shell` solo bloqueaba el scroll desde 1024px. O sea que el principio 1 del sistema solo existía en escritorio, y en el teléfono —donde ahora entra la mayoría de la gente— el producto se leía como un feed.

**El catálogo es un riel horizontal, el mismo en los dos tamaños.** Siempre avanzó de lado —←/→ paginan, `slide(dir)` desplaza en X— pero el dedo y la rueda iban en vertical, en contra de todo eso. Ahora el eje es uno solo y **la rueda del ratón empuja de costado**.

| Gesto | Qué mueve |
| --- | --- |
| Rueda o trackpad vertical | Una tarjeta, con cierre temporal para que un gesto no cruce el catálogo entero |
| Trackpad horizontal, Shift+rueda | Libre y nativo — no se intercepta |
| ←/→ | Una pantalla entera: tres tarjetas en escritorio, una en teléfono |
| Dedo | Deslizamiento nativo con anclaje |

**El riel no lleva botones de "Anterior" y "Siguiente".** Duplicaban con dos controles lo que la rueda, el dedo y el teclado ya hacen con un gesto, y ocupaban la barra inferior entera para eso. Queda solo la cifra —"3 de 9"— porque dice algo que ningún gesto dice: cuántas hay y cuánto falta. El teclado no se pierde: ←/→ siguen moviendo una pantalla, y como cada tarjeta es un botón, el tabulador las recorre y el navegador las trae a la vista solo. **Un control que solo repite un gesto disponible es peso muerto, no accesibilidad** — lo segundo se comprueba con el tabulador y el teclado, no con un par de flechas.

Esto reemplazó dos mecánicas por una: la pila vertical del teléfono y el carrusel con `AnimatePresence` del escritorio, que además remontaba las tarjetas en cada página.

La ficha sigue el mismo criterio de eje: diálogo que crece desde el centro en escritorio, **hoja que sube** desde el borde de abajo en teléfono (`sheetUp`) — una capa no puede crecer desde un centro cuando ya ocupa el viewport entero, y el borde inferior es el único que el pulgar alcanza.

Cuatro reglas que sostienen esto:

- **El gesto sale del navegador, no de una librería.** El riel es `snap-x snap-mandatory` sobre un contenedor con `overflow-x`. Un arrastre interpretado a mano da lo mismo en pantalla y cuesta el teclado, el lector de pantalla, el orden del documento y el impulso nativo.
- **La rueda se intercepta con `addEventListener`, no con `onWheel`.** React registra `wheel` como pasivo, y en un listener pasivo `preventDefault()` no hace nada. Nunca se intercepta con una capa abierta encima: la ficha tiene su propio contenido que desplazar.
- **`svh`, nunca `vh`.** La barra de direcciones de un navegador móvil aparece y desaparece; con `vh` el pie del riel queda cortado bajo ella.
- **Objetivo táctil ≥44px.** El piso de 24px de §7.2 es de puntero. Un dedo en un stand, de pie, con el teléfono en la otra mano, necesita 44.

**Qué se pliega y qué no.** En la barra superior el saldo es lo único que no se achica: es el dato que dice si puedes hacer algo. Lo que se va es la dirección de la wallet —cuatro caracteres de un hash no le dicen nada a nadie— y lo que se queda en su lugar es el estado que gobierna la inversión: "Con acceso" / "Sin acceso".

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
2. **Ningún estado depende solo del color — y ahora lo carga la palabra, no un glifo.** La cobertura insuficiente dice "Insuficiente"; los tramos del inversionista en el waterfall llevan borde de tinta *y* la palabra "tramo del inversionista"; la cuenta en la barra dice "Con acceso" o "Sin acceso". Los dos escudos que solo cambiaban de color eran, en la práctica, codificación cromática con un dibujo encima: la misma silueta a 14px en verde o en rojo. Ver §5.1.
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
- ✅ Diseñar para 390×844 **y** 1366×768.
- ✅ **Los componentes leen tokens, nunca literales.** Vale para color, y desde agosto 2026 también para **geometría** (`--w-wide`/`--w-panel`/`--w-doc`) y **movimiento** (`lib/motion.ts`). Esta era la regla que el proyecto decía tener y solo cumplía para color.
- ✅ **Un estado, un nombre.** Los cinco estados salen de `STATUS_LABEL`. Llegó a haber tres nombres para `funding` —"En recaudación", "En fondeo", "Levantando capital"— visibles a dos clics de distancia.
- ✅ **Toda acción irreversible se confirma**, y con el mismo peso: si borrar la cuenta tiene un modal diseñado, declarar un incumplimiento y emitir un pasaporte soulbound también. Nada de `window.confirm`.
- ✅ **Todo rechazo lleva motivo.** El dashboard de la empresa le promete al dueño que puede "corregir lo observado": si el verificador no tiene dónde escribirlo, esa promesa es mentira.
- ✅ **Ninguna respuesta no-2xx se traga en silencio.** `if (res.ok) await load()` sin `else` es un bug de diseño, no de red.
- ❌ **Sin íconos de librería, en ninguna parte.** Y nunca un glifo dentro de un botón: la palabra completa el concepto sola — ver §5.1. Lo sostiene ESLint.
- ❌ **Sin explicar el mecanismo al lado del dato.** Restricción, consecuencia y riesgo se dicen; el procedimiento interno no — ver §5.2.
- ❌ Sin degradados.
- ❌ Sin sombras de color.
- ❌ Sin `backdrop-filter` en filas de listas largas — solo en la barra pegajosa de `/negocios`, que es el único sitio donde algo se superpone a contenido que scrollea.
- ❌ Sin antetítulos (`label` en 11px encima de un `h1`). El titular se sostiene solo; si el antetítulo tenía información —como las etapas del onboarding— esa información va a la navegación, no encima del título.
- ❌ Sin tres tarjetas del mismo tamaño con ícono, título y texto como estructura de página. Es el contenedor perezoso y se nota.
- ❌ Sin gestos reimplementados a mano donde el navegador ya tiene uno. La pila del catálogo usa anclaje de scroll de CSS y no un arrastre interpretado: un arrastre propio se lleva puestos el teclado, el lector de pantalla y el impulso nativo, y hay que reconstruir los tres.

---

Cualquier componente nuevo se deriva de acá. Si algo no se resuelve con estas piezas, se extiende el sistema en este archivo — no se improvisa en el componente.
