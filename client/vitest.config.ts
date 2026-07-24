import {defineConfig} from "vitest/config";

// Fork tests spin an anvil fork of BOT Chain 968 and make real RPC round-trips.
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
