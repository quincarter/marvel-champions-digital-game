/**
 * `<sdk>/testing`: what a pack's own tests use. `smokeTestPack` is `mc-pack test`; `playToOutcome` is the greedy
 * headless driver it runs, for a test that sets up its own game (`cardPoolWithPack`, `gameDepsWithPack`).
 */
export { SMOKE_BASE_DECK, SMOKE_SCENARIOS, smokeTestPack } from "../src/smoke.ts";
export type { SmokeGame, SmokeOptions, SmokeResult } from "../src/smoke.ts";
export { playToOutcome } from "@mc/cards/testing";
export type { DriverOptions, DriverResult } from "@mc/cards/testing";
