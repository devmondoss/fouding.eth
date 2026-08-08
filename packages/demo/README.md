# @founding/demo — el video, como código

Un demo de la plataforma en menos de 45 segundos, generado por dos piezas:

1. **Playwright** maneja la app real y graba un clip por escena.
2. **Remotion** monta esos clips como una composición de React y renderiza el mp4.

No hay edición manual en el medio. El guion vive en un solo archivo
([scenes.mjs](scenes.mjs)) que leen los dos lados: cambiar el orden, el texto o
la duración de una escena ahí cambia la grabación **y** el montaje. Si querés
tocar el video, ese es el archivo — no hay un proyecto de edición escondido.

## Correrlo

Requisitos: la app levantada en `localhost:3000` (`yarn start` desde la raíz) con
la base de datos respondiendo, porque lo que se graba son las oportunidades
reales, no el seed.

```bash
yarn workspace @founding/demo login     # una sola vez: iniciás sesión a mano
yarn workspace @founding/demo capture   # graba las 6 escenas
yarn workspace @founding/demo render    # out/founding-demo.mp4
```

O el atajo, capturar y renderizar de una: `yarn demo` desde la raíz.

### Por qué hay un paso manual

La sesión la emite Privy con código por correo. Automatizarla pediría un tenant
de prueba y credenciales en el repo; no vale la pena para un video. En vez de
eso, `login` abre un Chromium con perfil persistente en `.profile/`, iniciás
sesión **como inversionista** una vez, y todas las capturas siguientes reusan ese
perfil. `.profile/` está en `.gitignore`: tiene tokens de verdad.

## Trabajar el montaje

```bash
yarn workspace @founding/demo duration  # la línea de tiempo, sin renderizar
yarn workspace @founding/demo studio    # Remotion Studio, con scrubbing
```

`duration` falla con código 1 si el guion se pasa de 45s, así que el techo se
verifica en un segundo y no al final de un render.

El Studio abre aunque no hayas capturado nada: las escenas sin clip se dibujan
como un hueco rotulado en vez de romper el bundle.

## Regrabar una sola escena

```bash
yarn workspace @founding/demo capture prelacion
```

El manifest conserva los demás clips y respeta el orden del guion, no el de
captura.

## Detalles que importan

- **Resolución.** Se graba nativo a 1920×1080: viewport y lienzo del mismo
  tamaño. Playwright solo escala hacia **abajo**, así que grabar el viewport
  calibrado de 1366×768 dentro de un lienzo de 1080p no lo agranda — lo pega
  arriba a la izquierda con el resto en gris. La otra salida era agrandar en
  Remotion, que ablanda las etiquetas de 13px justo donde el jurado tiene que
  leer. 1920 cae en el mismo breakpoint `lg` que 1366, así que es la misma
  composición con más aire. Para grabar el viewport exacto de PRODUCT.md:
  `DEMO_VIEWPORT=1366x768 yarn capture` — el tamaño queda anotado en el
  manifest y la composición lo sigue sola.
- **Recorte.** Cada escena tiene pasos de `setup` (navegar, abrir la ficha) que
  se graban igual porque Playwright graba toda la vida de la página. El
  capturador anota en qué milisegundo terminó el andamiaje y Remotion lo recorta
  con `trimBefore`. Por eso el guion se reordena sin volver a cortar nada.
- **Sin audio.** No hay pista de música: meter una genérica abarata un video
  cuyo argumento es institucional. Si la agregás, va como `<Audio>` en `Demo.tsx`.
- **Tokens.** Los colores del video son los mismos de `app/globals.css`,
  copiados en un único bloque en [src/theme.ts](src/theme.ts). Es la excepción
  consciente a "los componentes leen tokens": el video no monta Tailwind.

## Si una escena falla

El capturador nombra el selector que no encontró y en qué escena. Para verlo
pasar en vivo:

```bash
DEMO_HEADLESS=0 yarn workspace @founding/demo capture garantia
```

Los pasos marcados `optional: true` (el onboarding, por ejemplo) avisan y siguen
en vez de tumbar la corrida.
