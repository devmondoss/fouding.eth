import deployStylusContract from "./deploy_contract";

deployStylusContract({
  network: "arbitrumSepolia",
  contract: "repayment-router",
  name: "RepaymentRouter",
  constructorArgs: [],
  isOrbit: false,
  verify: false,
  estimateGas: false,
}).catch((e: unknown) => {
  console.error("FATAL", e);
  process.exit(1);
});
