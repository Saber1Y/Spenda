# Spenda Mainnet Implementation Plan

Date: 2026-08-20

## 1. Goal

Transform the current BOT Chain prototype into a production-oriented autonomous spending control plane without weakening its core security model.

Spenda must give agents programmable authorization to request economic actions while keeping user funds inside a policy-controlled vault.

The primary invariant for every phase is:

> Spenda does not give AI agents access to user wallets.
> Agents receive programmable authorization to request economic actions.
> User funds remain in policy-controlled vaults, and every action is independently validated before execution.

The implementation must preserve these properties:

- The vault remains the ultimate value-movement boundary.
- Agent accounts never custody user funds.
- Agent-generated language never directly becomes contract calldata.
- On-chain validation remains authoritative over off-chain previews.
- Human approvals are scoped to one specific intent and cannot become unlimited permissions.
- Every decision can be traced to an intent, agent, budget, policy, risk assessment, approval, and transaction receipt.

## 2. Current Baseline

The existing system already provides:

- `BOTSpendVault` with per-agent policy, per-transaction caps, rolling daily caps, token allowlists, target allowlists, revocation, expiry, action ID deduplication, reentrancy protection, and event receipts.
- `BOTSpendPaymaster` with destination gating, short sponsorship validity windows, UserOperation calldata binding, and a storage-free ERC-4337 validation path.
- ERC-4337 `SimpleAccountFactory`, `SimpleAccount`, EntryPoint v0.7, UserOperations, and paymaster-sponsored gas.
- Next.js, wagmi, and viem dashboard infrastructure.
- Base44 entities and synchronization functions.
- On-chain event reconstruction for approved and blocked actions.
- Deployment flow for vault, paymaster, agent account, policies, allowlists, funding, and paymaster deposit.
- Foundry unit, fork, differential, and client-side UserOperation tests.

The implementation should extend these components rather than create a parallel wallet, dashboard, or policy engine.

## 3. Target Architecture

```text
AI Agent
  |
  | normalized SpendIntent
  v
Intent Service
  |
  +--> Agent Registry
  +--> Budget Service
  +--> Policy Preview
  +--> Deterministic Risk Engine
  +--> Approval Service
  |
  +--> blocked / requires approval / approved
                              |
                              v
                    Execution Service
                              |
                 revalidate intent and policy
                              |
                              v
                    ERC-4337 UserOperation
                              |
                         EntryPoint
                              |
                      Restricted Agent Account
                              |
                         Spenda Vault
                              |
                    approved transfer only
                              |
                         Receipt Service
                              |
                   on-chain proof + Base44 record
```

### Custody boundary

The vault holds user funds and executes transfers.
Agent accounts should not hold ERC-20 funds, native gas, or EntryPoint deposits.
For mainnet, this must be structurally enforced rather than only monitored operationally.

### Authorization boundary

The system will have three independent authorization layers:

1. The intent and application layer validates the request shape, ownership, agent status, budget, category, merchant, and risk decision.
2. The ERC-4337/paymaster layer authorizes only the intended agent account and configured vault execution path.
3. The vault layer authorizes value movement using on-chain policy, allowlists, expiry, deduplication, and atomic spend accounting.

An operation must pass all applicable layers.

## 4. Non-Goals

The first mainnet release will not include:

- A general-purpose AI wallet.
- Agent custody of user funds.
- Arbitrary AI-generated contract calls.
- A generic unlimited approval signature.
- A full RWA marketplace.
- Automatic integration claims for Spotify, Netflix, AWS, OpenAI, or other merchants without real integrations.
- LLM-dependent security authorization.
- Cross-chain spending unless the vault, policy, and monitoring model is designed for it separately.

The Merchant Sandbox can simulate merchant fulfillment while the payment and authorization transaction remain real on BOT Chain.
The UI must clearly label sandbox fulfillment as simulated.

## 5. Phase 0: Foundation and Configuration

### Objective

Remove architectural ambiguity before adding product features.

### Work

1. Centralize deployment configuration.
   - Define one canonical chain/deployment manifest containing chain ID, RPC, EntryPoint, vault, paymaster, factory, supported tokens, deployment block, and explorer URLs.
   - Generate web and Base44 configuration from that manifest or load both from the same environment-backed source.
   - Remove stale hard-coded vault, paymaster, and agent defaults.
   - Require explicit deployment identity for all synchronization functions.

2. Define environment separation.
   - Local development.
   - Testnet demo.
   - Mainnet staging.
   - Mainnet production.
   - Prevent test tokens and test deployment addresses from being used in production configuration.

3. Add authenticated vault context.
   - Resolve the active vault from the authenticated user and Base44 ownership.
   - Never trust client-supplied vault, agent, token, paymaster, or recipient values without server-side resolution and validation.

4. Define canonical status and state-transition enums.
   - Intent: `draft`, `submitted`, `validated`, `blocked`, `requires_approval`, `approved`, `rejected`, `expired`, `executing`, `executed`, `failed`.
   - Approval: `pending`, `approved`, `rejected`, `expired`, `consumed`.
   - Receipt decision: `approved`, `blocked`, `human_approved`, `human_rejected`.

5. Add correlation identifiers.
   - `vaultId`.
   - `agentId`.
   - `intentId`.
   - `actionId`.
   - `approvalId` when applicable.
   - `userOpHash`.
   - `transactionHash`.

### Exit criteria

- Web and Base44 read the same deployment.
- A sync operation cannot write records for an unrelated vault.
- All request paths have authenticated ownership and server-side address validation.
- Existing 43 Foundry tests and web/client tests remain green where configured.

## 6. Phase 1: Restricted Agent Account and Mainnet Custody Hardening

This is the first real-funds prerequisite.

### Objective

Close the documented `SimpleAccount` self-sponsorship and arbitrary-call limitation.

### Preferred design

Introduce a purpose-built `RestrictedAgentAccount` or a carefully reviewed account module with:

- Immutable or owner-configured vault address.
- Immutable or owner-configured EntryPoint.
- Execution allowed only through EntryPoint or the account owner according to the intended operational model.
- Destination restricted to the configured vault.
- Selector restricted to the supported vault execution function.
- Calldata validation for token, target, amount, data, and action ID shape.
- No arbitrary native transfer path.
- No arbitrary ERC-20 transfer path.
- No self-modification of vault, policy, allowlists, owner, or account configuration.
- No account funding or EntryPoint deposit path that enables off-scope self-sponsorship.
- Replay protection through EntryPoint nonce and the vault action ID.

The account must not become a second policy engine with behavior that can drift from the vault.
Its role is to prevent arbitrary account execution and enforce the outer call shape.
The vault remains the value authorization boundary.

### Alternatives to evaluate

- A custom account factory that deploys restricted accounts.
- An ERC-4337 account abstraction module if it provides equivalent on-chain destination and selector constraints.
- A modified audited account implementation with narrowly scoped execution.

Choose one design only after comparing auditability, EntryPoint compatibility, upgradeability, and deployment complexity.

### Tests

- Direct arbitrary destination call fails.
- Direct arbitrary token transfer fails.
- EntryPoint arbitrary destination call fails.
- Vault execution path succeeds when policy allows it.
- Configured vault cannot be changed by the agent.
- Owner permissions cannot be changed by the agent.
- Account cannot create or use an EntryPoint deposit to bypass the paymaster.
- Account cannot call policy or allowlist configuration.
- Reentrancy and malformed calldata fail safely.
- Counterfactual address matches deployed address.

### Exit criteria

- Independent review of account code.
- Fork tests against the target EntryPoint.
- Attack simulation proves a compromised agent cannot move value outside the vault.
- The operational zero-balance invariant remains monitored even after structural restrictions exist.

## 7. Phase 2: Data Model and Intent Pipeline

### Objective

Replace direct amount-based demo requests with validated, normalized economic intents.

### Canonical intent

```ts
interface SpendIntent {
  id: string
  vaultId: string
  agentId: string
  intentType: "purchase" | "transfer" | "service" | "agent_payment" | "rwa_purchase"
  description: string
  token: Address
  amount: string
  recipient?: Address
  category?: string
  merchantId?: string
  metadata?: Record<string, unknown>
  expiresAt: number
  status: IntentStatus
  actionId: Hex
}
```

`amount` is serialized as a decimal string at API and persistence boundaries.
The execution layer converts it to `bigint` only after validation.

### Normalization rules

- Validate schema with a strict allowlist of fields.
- Reject unknown execution-relevant fields.
- Normalize addresses and token identifiers.
- Enforce positive amounts and configured token decimals.
- Require an expiry within a bounded maximum window.
- Require a stable agent and vault relationship.
- Resolve merchant and recipient from server-side registry data where possible.
- Convert descriptions into metadata for explanation only.
- Generate an action ID from the intent ID, vault, agent, execution parameters, and nonce.
- Never allow metadata or description text to select a destination, token, function selector, or amount.

### Base44 entities

Add:

- `SpendIntent`.
- `RiskAssessment`.
- `ApprovalRequest`.
- `SpendingReceipt`.
- `AgentBudget` if budget lifecycle and policy lifecycle need to be independently represented.

Retain and extend:

- `Vault`.
- `Agent`.
- `Policy`.
- `AllowlistEntry`.
- `Transaction` as the chain execution projection.
- `AuditLog`.

Every new entity must include `vault_id`, ownership rules, created/updated timestamps, and immutable correlation IDs where relevant.

### Service boundaries

Implement server-side services with narrow responsibilities:

- `intentService.createAndNormalize`.
- `budgetService.evaluate`.
- `policyService.preview`.
- `riskService.calculate`.
- `approvalService.create`, `approve`, `reject`, `expire`, `consume`.
- `executionService.prepare`, `submit`, `reconcile`.
- `receiptService.issueFromChainEvent`.
- `agentService.register`, `update`, `pause`, `revoke`, `list`.

### Exit criteria

- A structured intent can be created and persisted.
- Invalid intent fields are rejected before execution.
- Existing vault execution still receives only the existing supported calldata shape.
- Every intent has an action ID and expiry.
- No intent can be executed twice.

## 8. Phase 3: Separate Agent Budgets

### Objective

Support multiple agents under one vault with independent authorization budgets without creating separate custodial balances.

### Design

The on-chain `Policy` remains the final enforcement mechanism for max transaction, daily cap, expiry, active status, and allowlists.
`AgentBudget` is an application projection and configuration record, not a substitute for on-chain enforcement.

```ts
interface AgentBudget {
  id: string
  vaultId: string
  agentId: string
  dailyCap: string
  maxPerTransaction: string
  spentToday: string
  active: boolean
  startsAt?: string
  expiresAt?: string
  autoApprovalLimit: string
  humanApprovalLimit?: string
}
```

### Required flows

- Create agent and compute or deploy its restricted account.
- Configure on-chain policy and persist the matching budget.
- Update budget only through owner-authorized wallet transactions.
- Pause and revoke through the owner wallet.
- Display remaining allowance from on-chain state.
- Track historical spend from chain-derived receipts.
- Preserve spent accounting when policy limits are edited.

### Concurrency requirement

The application may reserve or preview budget, but only on-chain execution can finalize spend accounting.
Two concurrent intents must not both pass based on the same off-chain `spentToday` value.
Tests must submit concurrent or sequentially racing UserOperations and prove that the daily cap cannot be exceeded.

### Exit criteria

- One vault can display and manage at least three agents.
- Each agent has separate policy and budget values.
- A compromised agent cannot use another agent's budget.
- Dashboard remaining budget matches on-chain state.
- Concurrent spend tests cannot bypass daily caps.

## 9. Phase 4: Deterministic Risk Engine

### Objective

Calculate explainable risk without making security-critical authorization dependent on an LLM.

### Initial factors

Use a deterministic, versioned calculation:

- Amount band.
- Recipient known or new.
- Recipient allowlisted or not.
- Token allowlisted or not.
- Contract known or unknown.
- Agent spend velocity.
- Budget utilization before the request.
- Intent expiry window.
- Intent category, including `rwa_purchase`.
- Historical blocked or failed behavior.

Each factor must produce a bounded integer contribution.
The final score is clamped to `0..100`.

```ts
interface RiskAssessment {
  id: string
  intentId: string
  algorithmVersion: string
  score: number
  level: "low" | "medium" | "high" | "critical"
  factors: Array<{code: string; label: string; points: number; evidence: string}>
  recommendation: "automatic" | "policy_dependent" | "human_approval" | "block"
  createdAt: string
}
```

### Configurable thresholds

Default thresholds:

- `0..29`: low.
- `30..59`: medium.
- `60..79`: high.
- `80..100`: critical.

Thresholds and factor weights must be versioned per vault or system policy.
Changing them must be owner-authorized and audited.

### Decision matrix

The final decision must consider all of budget, policy, risk, expiry, and approval requirements.

- Invalid budget or policy: `blocked`.
- Critical risk: `blocked`.
- Low risk within auto-approval threshold: `approved`.
- Medium risk: policy-dependent.
- High risk or amount above auto-approval threshold: `requires_approval`.
- Expired or revoked request: `blocked` or `expired` without execution.

The LLM may classify or explain a description, but its output is advisory and cannot reduce a deterministic risk score or bypass policy.

### Exit criteria

- Identical input and configuration produce identical scores.
- Every score has persisted factor evidence.
- Risk configuration changes are auditable.
- Critical risk never executes automatically.
- Unknown recipient and unknown target behavior is covered by tests.

## 10. Phase 5: Human Approval Escalation

### Objective

Allow a user to approve one specific intent through the connected wallet.

### Approval design

The approval must bind to:

- Vault.
- Agent.
- Intent ID.
- Action ID.
- Token.
- Amount.
- Recipient.
- Intent expiry.
- Risk assessment hash or version.
- Policy version or relevant policy snapshot.
- Chain ID.
- Intended execution contract.
- Approval nonce.

The user must never sign an authorization such as “this agent may spend freely.”

### Preferred authorization flow

1. Create and validate intent.
2. Persist risk assessment and approval request.
3. Display exact amount, token, recipient, purpose, risk factors, expiry, and policy reason.
4. User connects the owner wallet.
5. Wallet signs a typed, domain-separated approval for that intent.
6. Server verifies the signature and that the signer owns the vault.
7. Execution service re-reads all critical on-chain state.
8. Execution service submits the exact pre-approved UserOperation.
9. Approval is atomically marked consumed only after successful submission protocol handling, with reconciliation for uncertain outcomes.
10. Receipt links the approval and transaction.

If the on-chain vault must verify the approval signature directly, add a dedicated scoped approval method with nonce and expiry rather than passing an unverified signature through arbitrary calldata.
The exact contract change requires a separate security review.

### Reject path

- Mark the approval request rejected.
- Do not submit a UserOperation.
- Issue a human-rejected receipt.
- Preserve the original intent and risk assessment.

### Replay protection

- Approval nonce.
- Intent/action ID deduplication.
- Expiry.
- Chain ID and verifying contract domain separation.
- Consumed approval state.
- EntryPoint nonce.

### Exit criteria

- Approve and reject work through the normal connected wallet.
- The approval cannot be reused for a changed amount, token, recipient, agent, vault, chain, or intent.
- Rejected and expired approvals move no funds.
- A previously approved intent cannot execute twice.

## 11. Phase 6: Spending Receipts

### Objective

Create a permanent, searchable explanation of every attempted autonomous economic action.

```ts
interface SpendingReceipt {
  id: string
  receiptNumber: string
  vaultId: string
  intentId: string
  agentId: string
  amount: string
  token: Address
  recipient: Address
  intentType: string
  category?: string
  riskAssessmentId?: string
  riskScore: number
  decision: "approved" | "blocked" | "human_approved" | "human_rejected"
  decisionReason: string
  policySnapshot?: Record<string, string | boolean>
  approvalId?: string
  userOpHash?: string
  transactionHash?: string
  blockNumber?: string
  createdAt: string
}
```

### Source of truth

Critical execution fields must be derived from on-chain logs and receipts:

- Actual amount.
- Actual token.
- Actual target.
- Agent address.
- Action ID.
- Approval or blocked event.
- Transaction hash.
- Block number.

The original intent and explanation are off-chain context and must not overwrite chain-derived facts.

### Reconciliation

Implement an idempotent event indexer that:

- Tracks per-vault deployment block and sync cursor.
- Supports multiple agents.
- Identifies approved and blocked events.
- Correlates events with action IDs and intents.
- Handles reorg or finality policy appropriate for BOT Chain.
- Does not duplicate receipts on retry.
- Marks uncertain UserOperation submissions for reconciliation rather than resubmitting blindly.

### Exit criteria

- Every executed or blocked action produces one receipt.
- Receipt search supports agent, decision, category, recipient, risk level, date, and transaction hash.
- Receipts remain correct after repeated sync runs.
- Dashboard can open the explorer transaction and the full decision context.

## 12. Phase 7: Agent Registry and Agent-to-Agent Payments

### Objective

Support agentic commerce without bypassing the existing authorization pipeline.

### Registry fields

- Agent ID.
- Display name.
- Agent account address.
- Owner.
- Description.
- Capabilities.
- Payment address.
- Supported tokens.
- Status.
- Verification or trust metadata.

The registry is initially an application directory.
The vault still requires the payment target to be allowlisted for the paying agent.

### Payment flow

```text
Paying agent
  -> agent_payment SpendIntent
  -> recipient registry resolution
  -> budget check
  -> token/target policy check
  -> deterministic risk
  -> approval if required
  -> existing vault executeSpend path
  -> SpendingReceipt
```

There must be no special agent-to-agent bypass.
The receiving agent is not automatically trusted merely because it is in the registry.

### Exit criteria

- A procurement agent can pay a registered data agent.
- The payment is visible as `agent_payment` in intents and receipts.
- Recipient allowlisting and token policy still apply.
- A compromised paying agent cannot use the registry to bypass its own budget.

## 13. Phase 8: RWA Category and Merchant Sandbox

### RWA category

Add `rwa_purchase` to the common intent type.
Treat RWA as a category and policy classification, not a separate custody or marketplace system.

The RWA intent should include structured metadata such as asset reference, provider, maximum amount, and expiry.
The recipient, token, amount, and contract target still require normal validation and allowlisting.

RWA should default to stronger risk treatment in the initial configuration because assets, providers, and fulfillment may be less familiar.

### Merchant Sandbox

Build a clearly labeled demo environment inside the existing dashboard.
Recommended scenarios:

- Spotify renewal.
- AI API credit top-up.
- GPU compute purchase.
- Domain renewal.
- Cloud hosting top-up.
- Agent-to-agent market data.
- Tokenized invoice or RWA purchase.

Each merchant record should define:

- Merchant ID.
- Display name.
- Category.
- Payment address.
- Supported token.
- Price or quote.
- Fulfillment status.
- Sandbox flag.

The sandbox should initiate real on-chain Spenda payments but simulate merchant fulfillment.
The UI must say that merchant fulfillment is simulated.
Do not present a sandbox payment as a live Spotify or cloud-provider integration.

### Killer demo sequence

1. Renew Spotify for `$11.99` under an auto-approval limit.
2. Top up AI API credits when balance falls below a threshold.
3. Pay a data agent `$5` for market data.
4. Attempt `$500` from a `$250` daily budget and show a deterministic block.
5. Request a `$40` payment to a new recipient and show human approval.
6. Approve with the owner wallet and show the receipt.
7. Request a `$100` RWA-category purchase and show risk plus approval.
8. Open the receipt and trace intent, agent, policy, risk, approval, UserOperation, and transaction.

## 14. Phase 9: Dashboard Expansion

Upgrade the existing dashboard rather than creating another application.

### Overview

Add:

- Total vault balance.
- Total configured agent budgets.
- Today's autonomous spend.
- Pending approvals.
- Blocked transaction count and amount.
- Average risk score.
- Recent receipts.

### Agents

Support:

- Multiple agent cards.
- Status and revocation.
- Daily cap, max transaction, spent, remaining.
- Auto-approval and human-approval thresholds.
- Capabilities and payment address.
- View, pause, revoke, and edit through owner wallet transactions.

### Spending

Filters:

- All.
- Approved.
- Blocked.
- Pending.
- Human approved.
- Human rejected.
- Agent-to-agent.
- RWA.
- Merchant category.

### Approvals

Create `/dashboard/approvals` or an equivalent existing route.
Each approval card must show:

- Agent.
- Amount and token.
- Recipient and label.
- Purpose.
- Category.
- Risk score and factor breakdown.
- Budget impact.
- Expiry.
- Exact approve and reject controls.

### Receipts

Create a searchable receipt view with:

- Receipt number.
- Intent description.
- Agent.
- Decision.
- Amount.
- Recipient.
- Risk.
- Policy reason.
- Approval signer if applicable.
- UserOperation hash.
- Transaction hash.
- On-chain explorer link.

### User experience states

Every new flow needs loading, empty, error, rejected-wallet, expired, pending-chain, successful, and reconciliation states.

## 15. API and Service Security

### Request authentication

- Require authenticated user ownership for vault and agent operations.
- Use agent authentication or signed agent requests for autonomous intent submission.
- Do not use a public endpoint that accepts arbitrary execution addresses.
- Rate-limit intent creation and sponsorship independently.
- Enforce per-vault and per-agent request quotas.

### Validation

- Validate all addresses with chain-aware checksums or normalized comparison.
- Validate token decimals and integer amount bounds.
- Validate recipient against registry and allowlist.
- Validate expiry and chain ID.
- Validate that the intent belongs to the agent submitting it.
- Validate status transitions server-side.

### Idempotency

Require an idempotency key for intent creation, approval submission, execution submission, and event reconciliation.
Never blindly resubmit an uncertain UserOperation because EntryPoint nonce and action ID make duplicate execution unsafe.

### Server-side execution

The execution service must construct calldata from a validated internal intent object.
It must not forward arbitrary calldata supplied by the client or LLM.

## 16. Contract Change Policy

Avoid contract changes where the existing vault already provides the necessary invariant.

### No contract change initially for

- Intent descriptions.
- Merchant labels.
- Risk explanations.
- Receipt text.
- Dashboard filtering.
- Agent registry metadata.
- RWA categorization.

These belong off-chain and must be linked to on-chain proof.

### Contract changes likely required for mainnet

- Restricted agent account or account module.
- Scoped approval verification if off-chain wallet approval alone is insufficient for the execution trust model.
- Potential explicit policy/version or authorization nonce support if policy changes must invalidate pending approvals.

Every contract change requires:

- New unit tests.
- Fuzz tests.
- Fork tests against the target EntryPoint and chain.
- Access-control review.
- Replay and expiry tests.
- Reentrancy and failed-call tests.
- Independent review before real funds.

## 17. Test and Security Matrix

### Contract tests

- Vault owner guard.
- Agent policy isolation.
- Per-transaction cap.
- Daily cap.
- Concurrent or sequential race attempts.
- Token allowlist.
- Target allowlist.
- Expiry.
- Revocation.
- Action ID replay.
- Reentrancy.
- Failed ERC-20 transfer.
- Failed native transfer.
- Restricted account destination.
- Restricted account selector.
- Restricted account configuration immutability.

### UserOperation tests

- Valid sponsorship.
- Wrong sender.
- Wrong vault.
- Wrong selector.
- Changed calldata after paymaster signing.
- Expired sponsorship.
- Invalid signature.
- EntryPoint nonce replay.
- Account initialization and counterfactual address.
- UserOperation execution with zero agent balance.

### Backend tests

- Intent schema rejection.
- Unknown-field rejection.
- Amount and expiry validation.
- Vault ownership isolation.
- Agent ownership isolation.
- Budget preview versus execution-time revalidation.
- Deterministic risk scoring.
- Risk threshold decisions.
- Approval signature scope.
- Approval replay.
- Approval expiry.
- Approval state transitions.
- Idempotent execution.
- Receipt idempotency.
- Event indexer retries.
- Reorg/finality handling.

### Attack simulations

- Compromised agent attempts `$10,000` against a `$100` daily cap.
- Compromised agent targets an unknown recipient.
- Compromised agent uses an unknown token.
- Compromised agent attempts a policy or allowlist mutation.
- Compromised agent tries another agent's budget.
- Two requests race to exceed the daily cap.
- Previously approved intent is replayed.
- Expired intent is submitted.
- Revoked agent submits.
- Approval is reused with modified recipient or amount.
- Public sponsor endpoint is spammed with blocked requests.
- Account is funded unexpectedly and attempts arbitrary execution.
- ERC-20 token attempts reentrancy.
- Merchant registry entry is changed after approval.

## 18. Observability and Operations

Implement before mainnet:

- RPC and bundler health checks.
- Paymaster deposit balance monitoring.
- Vault token and native balance monitoring.
- Failed and blocked transaction alerts.
- Approval backlog alerts.
- Event indexer lag monitoring.
- Duplicate or uncertain UserOperation detection.
- Agent budget utilization alerts.
- Agent revocation emergency procedure.
- Paymaster signer key rotation procedure.
- Owner wallet recovery procedure.
- Incident response runbook.
- Deployment manifest and verified contract address registry.

The paymaster signer should be isolated from the vault owner where possible.
Production keys must not be embedded in the repository or client bundle.

## 19. Deployment and Rollout

### Staging rollout

1. Deploy restricted account implementation and factory to a fresh staging deployment.
2. Deploy the existing vault and paymaster against the target EntryPoint.
3. Configure multiple agents, token allowlists, target allowlists, and budgets.
4. Run the complete attack matrix.
5. Run event synchronization repeatedly and compare chain-derived receipts with expected state.
6. Test wallet approval from at least two supported wallet paths.
7. Run Merchant Sandbox demo flows.
8. Verify contracts and publish the deployment manifest.

### Mainnet launch phases

1. Read-only mode.
   - Deploy contracts and indexer.
   - Allow users to inspect policies, agents, and receipts.
   - Disable autonomous value movement.

2. Capped pilot.
   - Restrict supported tokens and targets.
   - Set low per-agent and per-vault caps.
   - Require human approval for all non-trivial payments.
   - Monitor every execution manually.

3. Controlled autonomous mode.
   - Enable low-risk auto-approval under strict limits.
   - Retain human approval for new recipients, RWA, high risk, and threshold violations.

4. Broader availability.
   - Expand supported merchants and agents only after monitoring proves stable.
   - Increase limits gradually with explicit owner authorization.

## 20. Mainnet Readiness Gates

Do not support meaningful real funds until all gates pass.

### Architecture

- Active deployment configuration is centralized.
- Custody boundary is documented and implemented.
- Restricted agent account prevents arbitrary execution.
- No client-controlled execution addresses reach signed calldata unchecked.

### Security

- Independent smart-contract review completed.
- Replay, expiry, revocation, concurrency, reentrancy, and access-control tests pass.
- Approval signatures are scoped and domain-separated.
- Production key management and rotation procedures exist.

### Data integrity

- Receipts are chain-derived for critical fields.
- Intent, risk, approval, execution, and receipt correlations are idempotent.
- Indexer retry and finality behavior is tested.
- Vault and agent ownership isolation is tested.

### Operations

- Paymaster and RPC monitoring is active.
- Emergency agent revocation is tested.
- Capped pilot procedure exists.
- Incident response and rollback or disable procedures exist.

### Product

- User can understand why each action was approved, blocked, or escalated.
- User can see remaining budget per agent.
- User can approve one request without granting general spending authority.
- User can trace every payment to a transaction receipt.
- Sandbox integrations are clearly labeled as simulated fulfillment.

## 21. Recommended Delivery Order

The practical order is:

1. Centralize deployment configuration and fix the web/Base44 address mismatch.
2. Implement authenticated vault and agent context.
3. Build `SpendIntent`, `RiskAssessment`, `ApprovalRequest`, `SpendingReceipt`, and optional `AgentBudget` entities.
4. Implement strict intent normalization and server-side execution construction.
5. Implement multiple-agent registry and budget projection while preserving current on-chain policies.
6. Implement deterministic risk scoring and policy-dependent decisions.
7. Implement scoped wallet approvals.
8. Implement receipt reconciliation and searchable receipt UI.
9. Implement restricted agent account and factory, then migrate execution tests and deployment flow.
10. Implement agent-to-agent payments through the common pipeline.
11. Implement RWA category and Merchant Sandbox scenarios.
12. Complete mainnet attack testing, monitoring, deployment verification, and capped rollout.

The restricted account is listed late in the product sequence only to allow application work to proceed in parallel.
It is an absolute prerequisite for real-funds mainnet launch.

## 22. Definition of Done

The implementation is complete when a user can:

- Create or connect a vault.
- Deposit supported funds.
- Register multiple restricted agents.
- Configure independent budgets and policies.
- Submit structured intents.
- See deterministic risk factors.
- Get safe intents automatically executed.
- See invalid intents blocked.
- Approve a specific risky intent through the wallet.
- Reject an intent without funds moving.
- Pay a registered agent through the same pipeline.
- Submit an RWA-category intent through the same pipeline.
- Run clearly labeled Merchant Sandbox scenarios.
- Search complete spending receipts.
- Trace each outcome to on-chain evidence.
- Demonstrate that a compromised agent cannot drain the vault or bypass policy.

The product should feel like a financial control plane for AI agents, not a generic DeFi dashboard.
