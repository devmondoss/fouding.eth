# Árbitro

Monorepo Scaffold-Stylus para el producto Árbitro. El frontend existente vive
en `packages/nextjs`; la identidad y el registro del protocolo viven en
Solidity/Foundry y la máquina financiera vive en Rust Stylus.

## Desarrollo local

```bash
corepack yarn install
corepack yarn chain
corepack yarn deploy --network devnet
corepack yarn protocol:e2e
corepack yarn start
```

La aplicación está en `http://localhost:3000` y Nitro en
`http://127.0.0.1:8547` (chain ID `412346`). `yarn deploy` deja una
`CreditVault` abierta para la UI y usa instancias separadas para los escenarios
happy-path y recovery del E2E.

El orden de despliegue es `MockUSDC → AccessRegistry → CompanyPassportSBT →
CreditRegistry → CreditVault`. Después se configura Registry, se emite el
passport empresarial, se registra y aprueba al inversionista local, se
inicializan/registran los vaults y se regenera
`packages/nextjs/contracts/deployedContracts.ts`. Las direcciones no están
hardcodeadas en los hooks.

## Validación

```bash
corepack yarn next:lint
corepack yarn next:check-types
corepack yarn next:build
corepack yarn stylus:lint
corepack yarn stylus:test
corepack yarn verify-contracts
forge fmt --check --root packages/foundry
forge build --root packages/foundry
forge test --root packages/foundry -vvv
cargo fmt --manifest-path packages/stylus/contracts/Cargo.toml --all -- --check
cargo clippy --manifest-path packages/stylus/contracts/Cargo.toml -p credit-vault --all-targets -- -D warnings
cargo test --manifest-path packages/stylus/contracts/Cargo.toml -p credit-vault
```

`yarn deploy` requiere `solc` para exportar el ABI. En entornos sin el binario
usa la imagen Docker fijada por el scaffold. `cargo-stylus 0.10.8` no exporta
eventos `sol!`; por eso `credit-vault/abi-events.json` se combina de forma
explícita con su salida. No se versionan claves, `.env`, deployments locales,
artefactos Foundry ni artefactos Rust. Las únicas claves presentes en el
scaffold son las cuentas determinísticas, públicas y sin valor del Nitro
devnet; cualquier clave de testnet/mainnet se inyecta por variables de entorno.

## Estructura

```text
packages/nextjs  frontend Next.js 16 / React 19
packages/foundry Solidity, waitlist, tests de permisos/SBT/registry/token
packages/stylus  CreditVault Rust Stylus, scripts de deploy y E2E
nitro-devnode    cadena Arbitrum Nitro local
docs             propuesta, stack, sistema de diseño, plan y checklist de entrega
```

Privy sigue siendo la fuente de sesión y wallet. Wagmi/Viem se usan para
lecturas, simulación, firma, receipts e invalidación de queries. Los documentos
y datos personales permanecen fuera de cadena; el passport solo guarda
identificadores y hashes `bytes32` verificables. `MockUSDC` es exclusivamente
para desarrollo y nunca debe presentarse como USDC oficial.

La aprobación del verifier usa `PASSPORT_OPERATOR_PRIVATE_KEY` únicamente en
el servidor, deriva `companyId` y `metadataHash` de datos canónicos del
expediente y espera el receipt antes de marcarlo aprobado en Neon. También
acepta `PROTOCOL_CHAIN_ID`, `NITRO_RPC_URL`/`ARBITRUM_SEPOLIA_RPC_URL`,
`PASSPORT_TTL_DAYS` y `PASSPORT_DEFAULT_RISK_TIER`. Ninguna clave lleva el
prefijo `NEXT_PUBLIC_`.

`AccessRegistry` es la waitlist permissioned de inversionistas
(`Pending → Approved/Rejected → Revoked`). `CompanyPassportSBT` identifica a
la empresa prestataria y no se reutiliza como KYC del inversionista.
`CreditRegistry` conserva una instantánea inmutable de las dependencias de cada
vault, y `CreditVault.fund` contrasta esa configuración y exige acceso vigente.
Una pausa o revocación impide aportes nuevos, pero `claim` permanece disponible
para garantizar la salida de quien ya tiene una posición.

`next dev` conserva Turbopack. El build de producción usa Webpack porque
Turbopack 16.3.0 entra en panic al evaluar PostCSS/local fonts en WSL. Además,
`experimental.useTypeScriptCli: false` usa la API de TypeScript 5.9 y evita la
carrera del runner CLI que trunca la salida JSON de `tsc --showConfig`; el
typecheck sigue activo y también se ejecuta por separado con
`yarn next:check-types`.
