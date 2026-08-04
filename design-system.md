# Sistema de diseño — glassmorphism + color sólido

**Decisión cerrada.** Esta es la única dirección visual del producto. No se evalúan alternativas (neobrutalismo, flat corporativo, skeuomorfismo, light mode por defecto). Cualquier pantalla nueva se construye con las piezas de este documento.

Referencia: superficie de vidrio esmerilado sobre fondo azul-noche profundo, con una fuente de luz cromática (azul → violeta → magenta) detrás del vidrio, tipografía blanca condensada en mayúsculas y controles de color plano.

---

## 1. Los tres principios

1. **El color vive en la luz, no en la interfaz.** El degradado cromático es *ambiente detrás del vidrio*. Los elementos de UI (botones, badges, estados, tablas) usan **color plano y sólido**. Nunca un botón con degradado.
2. **El vidrio es una capa, no una textura.** Máximo dos niveles de vidrio superpuestos. Un tercer nivel se vuelve sopa gris y mata la legibilidad.
3. **El texto nunca flota sobre el degradado.** Si hay texto encima de la zona cromática, va sobre una placa de vidrio o sobre un velo oscuro. Esto no es negociable: el producto muestra montos, tasas y coverage ratios.

---

## 2. Tokens

```css
:root {
  /* --- Base: azul noche --- */
  --bg-void:        #05060F;  /* fondo de página, el más profundo */
  --bg-deep:        #0A0B1A;  /* fondo de sección */
  --bg-raised:      #12142A;  /* superficie sólida cuando el vidrio no aplica */

  /* --- Cromáticos sólidos (la paleta viva) --- */
  --chroma-blue:    #2E6BFF;  /* azul eléctrico — acción primaria */
  --chroma-azure:   #4CC2FF;  /* azul claro — acentos, links */
  --chroma-violet:  #7B3DF5;  /* violeta — puente del degradado */
  --chroma-magenta: #C838E8;  /* magenta — acento fuerte */
  --chroma-pink:    #FF4D9A;  /* rosa — remate del degradado */

  /* --- Estado (planos, sin degradado) --- */
  --state-funding:  #4CC2FF;
  --state-active:   #2ED47A;
  --state-warning:  #FFB020;
  --state-default:  #FF3D5A;
  --state-repaid:   #7B3DF5;

  /* --- Vidrio --- */
  --glass-fill:      rgba(255, 255, 255, 0.05);
  --glass-fill-hi:   rgba(255, 255, 255, 0.08);  /* hover / capa 2 */
  --glass-stroke:    rgba(255, 255, 255, 0.12);
  --glass-stroke-hi: rgba(255, 255, 255, 0.20);  /* borde superior, luz */
  --glass-blur:      28px;
  --glass-sat:       160%;

  /* --- Texto --- */
  --text-hi:   rgba(255, 255, 255, 0.96);
  --text-mid:  rgba(255, 255, 255, 0.68);
  --text-low:  rgba(255, 255, 255, 0.44);

  /* --- Geometría --- */
  --r-card:  28px;
  --r-panel: 20px;
  --r-input: 12px;
  --r-pill:  999px;
}
```

**Tailwind v4** — mapear en `globals.css`:

```css
@theme inline {
  --color-void: var(--bg-void);
  --color-deep: var(--bg-deep);
  --color-blue: var(--chroma-blue);
  --color-azure: var(--chroma-azure);
  --color-violet: var(--chroma-violet);
  --color-magenta: var(--chroma-magenta);
  --color-pink: var(--chroma-pink);
  --radius-card: var(--r-card);
}
```

---

## 3. La receta de vidrio

```css
.glass {
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid var(--glass-stroke);
  border-radius: var(--r-card);
  box-shadow:
    inset 0 1px 0 0 var(--glass-stroke-hi),   /* borde de luz superior */
    0 24px 60px -20px rgba(0, 0, 0, 0.6);      /* sombra de elevación */
}
```

Los cuatro ingredientes son obligatorios juntos. Un `background` translúcido sin `backdrop-filter` es un rectángulo gris; un `backdrop-filter` sin borde de luz interior no se lee como vidrio.

**Fallback**: si `backdrop-filter` no está soportado, cae a `--bg-raised` sólido. Nunca dejes la superficie translúcida sin blur.

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: var(--bg-raised); }
}
```

---

## 4. La luz cromática

Es lo que se ve *a través* del vidrio. Se compone de tres piezas apiladas.

**a) Blobs de color** — tres radial-gradients, sin bordes duros:

```css
.chroma-light {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(60% 55% at 30% 25%, var(--chroma-azure)  0%, transparent 70%),
    radial-gradient(55% 60% at 55% 45%, var(--chroma-magenta) 0%, transparent 68%),
    radial-gradient(70% 65% at 80% 70%, var(--chroma-blue)    0%, transparent 72%);
  filter: blur(40px);
}
```

**b) Estriado vertical** — las líneas finas de la referencia. Encima del color, en `multiply`:

```css
.chroma-light::after {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(0,0,0,0.22) 0 1px,
    transparent 1px 10px
  );
  mix-blend-mode: multiply;
}
```

**c) Grano** — un PNG de ruido al 3–4% de opacidad sobre todo el degradado. Sin esto, cualquier degradado grande hace *banding* visible en pantallas de 8 bits. Es el detalle que separa "hecho a mano" de "plantilla".

---

## 5. Componentes

### GlassCard
Contenedor base. `--r-card`, padding 24–32px. Es la unidad de composición: oportunidad, panel de hitos, formulario.

### Pill / badge
Borde `--glass-stroke-hi`, fondo transparente, texto `--text-hi` en mayúsculas, tracking amplio, `--r-pill`. Para estados: **fondo plano** del color de estado al 14% + borde del mismo color al 40% + texto en el color puro. Sin degradado.

### Botón primario
Fondo **sólido** `--chroma-blue`, texto blanco, `--r-pill`. Hover: aclarar 6%, no cambiar de color.
Botón secundario: vidrio con borde, texto `--text-hi`.

### Tipografía
- **Display**: sans condensada, mayúsculas, peso 700–800, tracking negativo (`-0.02em`). Ej. Archivo, Anton, o Inter Tight. Reservada para el título de oportunidad y cifras grandes.
- **Cuerpo / datos**: Inter, 14–16px, `--text-mid`.
- **Etiquetas**: 11px, mayúsculas, tracking `0.12em`, `--text-low`.
- **Cifras**: variante tabular (`font-variant-numeric: tabular-nums`) siempre. Montos y porcentajes desalineados en una tabla de crédito se ven amateur.

### Marca de acento
El asterisco de la referencia funciona como sello. Usarlo con moderación: esquina de la tarjeta hero, estado vacío, footer. No es un icono de UI.

---

## 6. Aplicación al producto

| Pantalla | Cómo se aplica |
| --- | --- |
| **Landing / hero** | Máxima expresión: card de vidrio grande sobre luz cromática completa, display en mayúsculas, un pill y un botón sólido. Es la pantalla que se parece 1:1 a la referencia. |
| **Marketplace de oportunidades** | Grid de GlassCards. La luz cromática pasa a **ambiente de fondo de página**, muy difusa, no dentro de cada card. Si cada tarjeta tuviera su propio degradado, el grid sería ilegible. |
| **Detalle de oportunidad** | Card principal de vidrio; dentro, paneles de segundo nivel con `--glass-fill-hi`. Ahí se cierra: no hay tercer nivel. |
| **Tabla de datos / waterfall** | Contenedor de vidrio, **filas sin vidrio** — separadores de 1px en `--glass-stroke`. Fondo de la zona de tabla ligeramente más opaco para asegurar contraste. |
| **Timeline de hitos** | Línea en `--glass-stroke`; nodo completado en `--state-active` sólido, pendiente en hueco con borde. El color comunica estado, no decora. |
| **Coverage ratio / gráficos** | Barras y arcos en color plano de la paleta. Un solo degradado permitido: la barra de progreso de fondeo, azul → magenta. |
| **Formularios del originador** | Vidrio de bajo contraste, casi funcional. Inputs con fondo `rgba(0,0,0,0.25)` para separarlos del vidrio y que se lean como campos editables. |

---

## 7. Reglas duras

- ✅ Degradado **detrás** del vidrio. ❌ Degradado **en** un botón, badge, borde o texto.
- ✅ Dos niveles de vidrio como máximo.
- ✅ Todo texto ≥ 4.5:1 de contraste. Si el degradado sube el fondo, sube la opacidad del vidrio hasta cumplir — la legibilidad gana siempre.
- ❌ Nada de `backdrop-filter` en elementos que hagan scroll dentro de una lista larga: mata el rendimiento. Vidrio en contenedores, no en filas.
- ❌ Sin light mode. El producto es dark-only por decisión de marca.
- ❌ Sin sombras de color (`box-shadow` magenta glow). La elevación es negra; el color es luz de fondo.
- ✅ Bordes redondeados generosos y consistentes. Nada de esquinas a 4px.

---

## 8. Rendimiento

`backdrop-filter` es caro. Tres precauciones que evitan un producto que se siente lento:

1. Un solo elemento de luz cromática por pantalla, en `position: fixed`, con `will-change: transform`.
2. Cards con `contain: paint`.
3. En listas de más de ~20 items, el vidrio va en el contenedor; las filas son translúcidas planas sin blur. Visualmente idéntico, sin el costo.

---

Cualquier componente nuevo se deriva de acá. Si algo no se puede resolver con estas piezas, se extiende el sistema en este archivo — no se improvisa en el componente.
