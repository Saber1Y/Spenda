# Vendored — DO NOT EDIT

`getHash.ts`, `userOp.ts`, `signer.ts` are **byte-identical copies** of
`client/src/{getHash,userOp,signer}.ts` — the proven, differential-fuzzed sponsor code
(getHash verbatim from VerifyingPaymaster v0.7.0; TS↔Solidity equivalence tested).

Vendored (not cross-package-imported) to keep the Next server bundle self-contained.
If the source in `client/src` changes, re-copy these — never diverge them, or the paymaster
signature stops recovering to `verifyingSigner` (silent SIG_VALIDATION_FAILED on every op).
