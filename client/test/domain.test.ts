import {describe, expect, test} from "vitest";
import {calculateRisk, validateSpendIntent, type SpendIntent} from "../../shared/spenda-domain.js";

const NOW = 1_800_000_000;
const VALID_INTENT: SpendIntent = {
  id: "intent-1",
  vaultId: "vault-1",
  agentId: "agent-1",
  intentType: "purchase",
  description: "Renew approved service",
  token: "0x0000000000000000000000000000000000000001",
  amount: "1200000",
  recipient: "0x0000000000000000000000000000000000000002",
  expiresAt: NOW + 3600,
  status: "submitted",
  actionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
};

describe("SpendIntent validation", () => {
  test("accepts a normalized intent", () => {
    expect(validateSpendIntent(VALID_INTENT, NOW)).toEqual({valid: true, errors: []});
  });

  test("rejects invalid execution fields and long expiry", () => {
    const result = validateSpendIntent({...VALID_INTENT, token: "token", amount: "0", expiresAt: NOW + 2 * 86400}, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "token must be a valid address",
      "amount must be a positive integer string",
      "expiresAt cannot be more than 24 hours away",
    ]));
  });
});

describe("deterministic risk engine", () => {
  test("returns low automatic risk for a known small payment", () => {
    const result = calculateRisk({
      amount: 1n,
      maxPerTransaction: 100n,
      remainingDailyBudget: 1000n,
      recipientAllowlisted: true,
      tokenAllowlisted: true,
      knownContract: true,
      unusualVelocity: false,
    });
    expect(result).toMatchObject({score: 0, level: "low", recommendation: "automatic"});
  });

  test("returns high human approval risk for a new recipient and unknown contract", () => {
    const result = calculateRisk({
      amount: 80n,
      maxPerTransaction: 100n,
      remainingDailyBudget: 100n,
      recipientAllowlisted: false,
      tokenAllowlisted: true,
      knownContract: false,
      unusualVelocity: false,
    });
    expect(result).toMatchObject({score: 78, level: "high", recommendation: "human_approval"});
    expect(result.factors.map((factor) => factor.code)).toEqual(expect.arrayContaining(["new_recipient", "unknown_contract"]));
  });
});
