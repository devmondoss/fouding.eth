/**
 * Parámetros de la recarga de prueba. Client-safe a propósito: la UI
 * necesita decir cuánto va a recibir alguien ANTES de pedirlo, y el
 * servidor tiene que gotear exactamente eso — dos constantes distintas
 * en dos archivos es como se rompe esa promesa.
 */

/** Lo que recibe una wallet nueva.
 *
 * Es el mismo número que `FAUCET_AMOUNT` del MockUSDC a propósito: hay
 * dos caminos para entregar el token —lo mintea la dispensadora, o lo
 * reclama la propia wallet del contrato— y con un solo monto la pantalla
 * dice la verdad en los dos. */
export const TOPUP_TOKEN_AMOUNT = 10_000;

/** Por debajo de esto se considera que la wallet está vacía y se
 * recarga. No es cero: alguien con 3 USDC tampoco puede hacer nada. */
export const TOPUP_TOKEN_THRESHOLD = 1_000;

/** Gas para firmar: la wallet embebida se crea sin un wei, así que sin
 * este goteo no puede ni aprobar el token.
 *
 * 0.0003 ETH y no más, porque el número que manda es el techo de la
 * cuenta operadora: con ~0.037 ETH, gotear 0.002 alcanzaba para 18
 * visitantes y gotear esto alcanza para ~120. La medición que lo fija:
 * una llamada a `faucet()` en Arbitrum Sepolia costó 0.0000019 ETH, así
 * que 0.0003 son ~150 transacciones por wallet — de sobra para aprobar,
 * invertir y cobrar. */
export const TOPUP_GAS_ETH = "0.0003";
export const TOPUP_GAS_THRESHOLD_ETH = "0.0001";

/** Una recarga por wallet cada tantos minutos. No es antifraude —es
 * testnet— sino un tope para que un bucle del cliente no vacíe la
 * cuenta operadora en una tarde. */
export const TOPUP_COOLDOWN_MINUTES = 10;

/** Techo diario de la dispensadora, en número de recargas. Cuando se
 * agota, la API responde 429 y lo dice en pantalla en vez de fallar en
 * silencio. */
export const TOPUP_DAILY_LIMIT = 200;

export type TopUpStatus = {
  /** Si la dispensadora está configurada y con fondos. */
  available: boolean;
  /** Motivo cuando no está disponible, ya traducido. */
  reason?: string;
  symbol: string;
  tokenAmount: number;
  gasEth: string;
  /** Saldos actuales de quien pregunta, en unidades enteras. */
  balance?: { token: number; eth: string };
  /** Si con los saldos actuales corresponde recargar. */
  needsTopUp?: boolean;
};

export type TopUpResult = {
  granted: { token: boolean; gas: boolean };
  txHashes: { token?: string; gas?: string };
  balance: { token: number; eth: string };
  /** Mensaje corto para la UI, ya en castellano. */
  message: string;
  /**
   * El servidor mandó el gas pero no puede emitir el token; la wallet
   * tiene que reclamarlo ella misma llamando `faucet()` del MockUSDC,
   * cosa que ya puede hacer porque acaba de recibir gas. El cliente
   * firma esa segunda parte (ver useAutoTopUp).
   */
  selfClaim?: boolean;
};
