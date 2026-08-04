# Founding

Monorepo Scaffold-Stylus para el producto Founding. El frontend existente vive en `packages/nextjs`; los contratos Stylus y sus scripts de despliegue viven en `packages/stylus`.

## Desarrollo local

```bash
corepack yarn install
corepack yarn chain
corepack yarn start
```

La aplicación está en `http://localhost:3000`, Debug Contracts en `/debug` y Nitro en `http://127.0.0.1:8547`.

## Validación

```bash
corepack yarn next:lint
corepack yarn next:check-types
corepack yarn next:build
corepack yarn deploy --network devnet
```

`yarn deploy` requiere `solc` para exportar el ABI. En entornos sin el binario se puede usar una imagen Docker de solc de forma temporal; no se versionan claves, `.env`, deployments locales ni artefactos Rust.

## Estructura

```text
packages/nextjs  frontend Next.js 16 / React 19
packages/stylus  contrato Rust Stylus de ejemplo y scripts
nitro-devnode    cadena Arbitrum Nitro local
```
