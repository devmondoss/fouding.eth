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
  --text-low:      #98A2B3;

  /* Marca — Chartreuse para relleno, Gun Metal como tinta legible.
     Chartreuse pierde contraste como texto/borde fino sobre blanco:
     se usa solo en superficies de relleno (botones, barras, chips),
     siempre con --brand-ink encima, nunca como texto directo. */
  --brand:        #E0FF4F;
  --brand-hover:  #CBE93A;
  --brand-ink:    #00272B;
  --brand-soft:   #F8FFDF;
  --brand-border: #D8EF85;

  /* Semánticos, apagados a propósito */
  --positive: #147A54;   --positive-soft: #E7F4EE;
  --warning:  #A4671A;   --warning-soft:  #FDF3E7;
  --negative: #B3261E;   --negative-soft: #FBECEB;

  /* Geometría */
  --r-card: 10px;  --r-panel: 8px;  --r-input: 8px;  --r-pill: 999px;

  /* Shell */
  --shell-max: 1240px;  --shell-min: 1120px;

  /* Elevación */
  --shadow-sm: 0 1px 2px rgba(16,24,40,0.05);
  --shadow-md: 0 4px 12px -2px rgba(16,24,40,0.10);
  --shadow-lg: 0 12px 28px -8px rgba(16,24,40,0.16);
}
```

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

**Alcance:** el producto es exclusivamente el lado del **inversionista**. No hay panel de originador ni flujo de empresa; esas operaciones existen en el dominio pero no se exponen.

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

- ✅ Un solo módulo. Se pagina y se navega por capas, nunca por scroll de página.
- ✅ Toda cifra en `.num`.
- ✅ El color semántico se usa por significado, nunca por decoración.
- ✅ Diseñar para 1366×768.
- ❌ Sin degradados salvo el sutil de la textura del hero.
- ❌ Sin sombras de color.
- ❌ Sin `backdrop-filter` en filas de listas largas — solo en la barra fija.
- ❌ Sin breakpoints responsive por ahora: desktop only.

---

Cualquier componente nuevo se deriva de acá. Si algo no se resuelve con estas piezas, se extiende el sistema en este archivo — no se improvisa en el componente.
