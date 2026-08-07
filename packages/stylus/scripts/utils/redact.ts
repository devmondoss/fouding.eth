const SENSITIVE_ENVIRONMENT_VARIABLES = [
  "ARBITRUM_SEPOLIA_RPC_URL",
  "DEPLOYER_PRIVATE_KEY",
  "ETHERSCAN_API_KEY",
  "RPC_URL_SEPOLIA",
  "PRIVATE_KEY_SEPOLIA",
] as const;

export function redactSensitiveError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const variableName of SENSITIVE_ENVIRONMENT_VARIABLES) {
    const value = process.env[variableName];
    if (value) message = message.split(value).join("[REDACTED]");
  }
  return message.replace(/https?:\/\/[^\s"']+/g, "[REDACTED_RPC]");
}
