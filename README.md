<div align="center">

# Spenda

**Give your AI agent a wallet it can't drain.**

Policy-checked, **gasless** spend vaults for autonomous agents on **BOT Chain**. The agent holds
nothing — a sponsor policy fences it to the vault at the gas layer, and the vault enforces caps,
allowlists, dedup and receipts on-chain.

**▶ Live demo: https://botspend-production.up.railway.app**

[Architecture](./architecture.md) · [Security](./security.md) · [Adversarial Testing](./adversarialtesting.md)

`BOT Chain testnet 968` · `ERC-4337 v0.7` · `Foundry` · `Next.js` · `viem` · `MIT`

</div>

---

## The idea

Autonomous agents need to move money to act — pay a vendor, settle a task, swap on a DEX. Hand one an
unrestricted key and a single prompt injection, hallucinated action, or runaway loop can drain it.

Spenda gives the agent a wallet that **holds nothing** and can only ever move value **inside policy**,
enforced by **two independent fences**:

- **Fence 1 — gas layer (ERC-4337).** The agent is a zero-balance smart account. Every action is a
  sponsored UserOp, and the paymaster's off-chain signer only signs calls **into the vault**. An
  off-policy action is never sponsored — with no gas, it can't even be broadcast.
- **Fence 2 — contract layer (`BOTSpendVault`).** Any sponsored call is checked against the full policy
  (active, not expired, token allowed, target allowed, per-tx cap, daily cap, dedup) **before** moving a
  cent. Blocked actions emit an on-chain record and move nothing — no revert.

Neither fence substitutes the other. See **[architecture.md](./architecture.md)** for the full design and
**[security.md](./security.md)** for the guarantees and threat model.

## Live on BOT Chain testnet 968

RPC `https://rpc.bohr.life` · Explorer `https://scan.bohr.life` · Bundler `https://bundler.bohr.life/rpc`

| Contract | Address |
|----------|---------|
| **BOTSpendVault** | [`0xbE4e1109d0c8f9558E16A6C59388B6Fb210a2F88`](https://scan.bohr.life/address/0xbE4e1109d0c8f9558E16A6C59388B6Fb210a2F88) |
| **BOTSpendPaymaster** | [`0x5431d8538Fc62Da83A02dCFc275616f24b4587c4`](https://scan.bohr.life/address/0x5431d8538Fc62Da83A02dCFc275616f24b4587c4) |
| **SimpleAccountFactory** | [`0xC7e8a13d62752Eb58b21391f2BA302B1043D13b1`](https://scan.bohr.life/address/0xC7e8a13d62752Eb58b21391f2BA302B1043D13b1) |
| **MockUSD** (mUSD, 6dp) | [`0x981a7E272F309193D846dc585b64E4a2f172aD21`](https://scan.bohr.life/address/0x981a7E272F309193D846dc585b64E4a2f172aD21) |
| **EntryPoint v0.7** (canonical, pre-existing) | [`0x0000000071727De22E5E9d8BAf0edAc6f37da032`](https://scan.bohr.life/address/0x0000000071727De22E5E9d8BAf0edAc6f37da032) |

### Proven on-chain artifacts

- **Gasless deploy + approved spend** (one sponsored UserOp deploys the account *and* spends): tx
  [`0xb2143fb3…`](https://scan.bohr.life/tx/0xb2143fb3de65583fa75655b068cf23189a39b1a810c98e41653f67c7f6997d2c)
- **Blocked-by-policy** (over-cap, sponsored but held; paymaster still pays — no value moves): tx
  [`0x299021d9…`](https://scan.bohr.life/tx/0x299021d91bdd354f3c9462629b0f10219578be08f1fe9c3e9e187e982e7f25f9)

The two are the *same* op with one variable changed (4 mUSD vs 6 mUSD against a 5 mUSD cap) — the
difference lives entirely in the events and the untouched balances.

## Repository layout

```
src/                      Solidity — SpendaVault.sol, MockUSD.sol
test/                     Foundry suite (unit, fuzz, fork) + mocks
script/                   deploy scripts (DeployAll, DeployAccountFactory, …)
client/                   TypeScript agent client + off-chain sponsor signer (viem)
  src/{getHash,userOp,signer,config}.ts     paymaster getHash + UserOp packing + signer policy
  test/                                     differential + fork tests
web/                      Next.js frontend (marketing + dashboard + /api/sponsor)
lib/                      vendored deps (OpenZeppelin, forge-std, account-abstraction @ v0.7.0)
foundry.toml              evm_version = cancun
```

## Quick start

```bash
# Contracts — build + test (Foundry)
forge build
forge test                       # hermetic unit + fuzz
forge test --match-path "test/fork/*"   # fork tests vs the real EntryPoint on 968

# Agent client — off-chain signer equivalence + end-to-end (viem)
cd client && npm i && npm test

# Frontend — marketing + dashboard
cd web && npm i && npm run dev   # http://localhost:3000
```

To run the **live gasless demo** locally, set the two signer keys (see `web/.env.example`) — the
`/api/sponsor` route signs sponsorship + submits the UserOp server-side. Without them the dashboard is
still fully live in read-only + owner-write mode.

## Documentation

- **[architecture.md](./architecture.md)** — the two fences, components, the UserOp lifecycle, the
  address model, the three replay layers.
- **[security.md](./security.md)** — guarantees, the storage-free paymaster invariant, the F6 tradeoff,
  key management, and the known v1 limitation.
- **[adversarialtesting.md](./adversarialtesting.md)** — the test strategy: unit, differential fuzz,
  fork-against-real-EntryPoint, the live simulation gate, and on-chain acceptance.

## License

[MIT](./LICENSE).
