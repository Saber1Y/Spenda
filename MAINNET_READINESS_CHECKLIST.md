# Spenda Mainnet Readiness Checklist

This checklist is intentionally separate from testnet readiness.
Do not broadcast a mainnet deployment until every required value is verified.

Status: core stack deployed on chain 677 on 2026-08-22. Addresses and tx hashes in
`deployments/mainnet.json`. Remaining items below gate the first live pilot.

## Network and Contracts

- [x] Official BOT Chain mainnet chain ID confirmed: `677`.
- [x] Official mainnet RPC confirmed: `https://rpc.botchain.ai`.
- [x] Official mainnet bundler confirmed: `https://bundler.botchain.ai/rpc` (chain 677, supports EntryPoint `0x0000000071727De22E5E9d8BAf0edAc6f37da032`).
- [x] Official mainnet EntryPoint address confirmed: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`, code live on chain 677.
- [x] Official supported stablecoin confirmed: USDT at `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`, 6 decimals.
- [ ] Contract source verified on the mainnet explorer.
- [x] `BOTSpendVault` owner constructor address verified: reads back as the deployer owner wallet.
- [x] `BOTSpendPaymaster.VAULT()` matches the deployed vault.
- [x] `RestrictedAgentAccountFactory.vault()` matches the deployed vault.
- [x] `RestrictedAgentAccountFactory.paymaster()` matches the deployed paymaster.

## Key Separation

- [ ] Mainnet vault owner is a dedicated multisig or protected owner wallet.
- [x] Mainnet paymaster verifying signer is a separate key (`0xc06859dC7cf92360a79B7C6684fAD32cAE674f8B`, distinct from owner; enforced by `DeployMainnet.s.sol` and read back on-chain).
- [ ] Mainnet agent owner keys are separate from the vault owner where possible.
- [ ] No testnet private key is reused for mainnet.
- [ ] Key backup and rotation procedure is documented.

## Funding and Limits

- [ ] Initial vault funding amount approved.
- [ ] Initial paymaster deposit approved.
- [ ] Agent max transaction limits approved.
- [ ] Agent daily caps approved.
- [ ] RWA approval thresholds approved.
- [ ] Auto-approval is disabled for the first pilot or limited to a very small amount.
- [ ] Emergency revocation procedure tested.

## Monitoring and Incident Response

- [ ] Monitoring snapshot runs against mainnet.
- [ ] Paymaster low-balance alert tested.
- [ ] Vault low-balance alert tested.
- [ ] Agent custody violation alert tested.
- [ ] Stuck execution reconciliation tested.
- [ ] RPC and bundler outage response tested.
- [ ] Incident runbook reviewed by the project owner.

## Pilot Gate

- [ ] One low-value real-token transaction succeeds.
- [ ] One policy-blocked transaction is observed.
- [ ] One human approval transaction succeeds.
- [ ] Receipts contain chain-derived transaction hashes.
- [ ] No agent holds native funds or EntryPoint deposits.
- [ ] Independent security review completed.
