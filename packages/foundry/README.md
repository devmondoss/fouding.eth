# Solidity protocol layer

`AccessRegistry`, `CompanyPassportSBT`, `CreditRegistry` and `MockUSDC` live
here. The financial state machine lives in the Stylus `credit-vault` crate.

`AccessRegistry` owns the investor waitlist and stores only an application
hash. `CompanyPassportSBT` owns borrower/company credentials. `CreditRegistry`
records the complete immutable dependency set of every official vault. The
Stylus vault reads those narrow interfaces before funding; claims deliberately
remain independent from access revocation so investors always retain a safe
exit.

`AccessControl` is intentionally used instead of `AccessManager`: PR-02 has a
small, fixed, non-upgradeable contract graph. Per-contract roles are easier to
audit and deploy locally, while preserving separation between issuer,
verifier, revoker, originator, underwriter, servicer and pauser. A centralized
permission router would add cross-contract configuration and failure modes
without reducing authority in this slice.

`MockUSDC` is development-only, has six decimals, and is not Circle USDC.

```bash
cd packages/foundry
forge fmt --check
forge build
forge test -vvv
```
