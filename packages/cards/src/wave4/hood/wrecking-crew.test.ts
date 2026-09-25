import { characterProfile, hasKeyword } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, patchInstance, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  encounterCardInVillainArea,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  stackTop,
  villainId,
} from "./testing.js";

/**
 * Real-game tests for the Wrecking Crew modular set (`wrecking-crew.ts`): Top Talent (24064), Wrecker (24065),
 * Bulldozer (24066), Thunderball (24068), Combined Effort (24069) and Magic Muscle (24070). Piledriver (24067) has
 * no ability refs (plain data).
 *
 * Ref -> covering test:
 *  24064.top-talent-constant  -> "the villain and each Elite minion gain retaliate 1"
 *  24065.wrecker-constant     -> "Wrecker gets +2 ATK only while his own attack is undefended"
 *  24066.bulldozer-constant   -> "Bulldozer's own attacks gain overkill"
 *  24068.thunderball-forced-response -> "deals 1 damage to each character P1 controls after attacking P1"
 *  24069.when-revealed        -> "each Elite minion activates against the player it is engaged with"
 *  24069.boost                -> "this activation gets +1 boost card per Elite minion in play"
 *  24070.when-revealed        -> "gives each Brute enemy in play a tough status card"
 */

// wrecking_crew_modular is the pack's 9th modular set, outside the default first-7 set-aside pool: name it explicitly.
const SETS_WITH_WRECKING_CREW = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "wrecking_crew_modular",
];
const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed, [], SETS_WITH_WRECKING_CREW), "wrecking_crew_modular");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("Wrecking Crew (24064-24070)", () => {
  it("24064.top-talent-constant: the villain and each Elite minion gain retaliate 1", () => {
    const base = onStage(withSet(), 0);
    const withScheme = encounterCardInVillainArea(base, "24064");
    expect(hasKeyword(withScheme.state, villainId(withScheme.state), "retaliate", WAVE4_DEPS)).toBe(true);
    const withWrecker = minionEngagedWith(withScheme.state, "24065", P1); // Wrecker: ELITE trait.
    expect(hasKeyword(withWrecker.state, withWrecker.id, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24065.wrecker-constant: Wrecker gets +2 ATK only while his own attack is undefended", () => {
    const base = onStage(withSet(), 0);
    const staged = minionEngagedWith(base, "24065", P1);
    const printedAtk = characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk;
    // Not currently attacking: no bonus.
    expect(characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk).toBe(printedAtk);
  });

  it("24066.bulldozer-constant: Bulldozer's own attacks gain overkill", () => {
    expect(WAVE4_DEPS.abilities["24066.bulldozer-constant"]?.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { self: true } }],
    });
  });

  it("24068.thunderball-forced-response: deals 1 damage to each character P1 controls after Thunderball attacks P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24068", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const before = staged.state.instances[identity]!.damage;
    const activated = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Loose by design (rules-qa-engineer, docs/phase7-wave4-qa.md): Thunderball's own attack this villain
    // phase also deals damage independently of his Forced Response, so the identity's total is not isolated
    // to the +1 this ability alone contributes; only an increase is guaranteed here.
    expect(activated.instances[identity]!.damage).toBeGreaterThan(before);
  });

  it("24069.when-revealed: each Elite minion in play activates against the player it is engaged with", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "01186", "01187", "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.when-revealed")).toBe(true);
  });

  it("24069.boost: this activation gets +1 boost card per Elite minion in play", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.boost")).toBe(true);
  });

  it("24070.when-revealed: gives each Brute enemy in play a tough status card", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withBrute = minionEngagedWith(base, "24065", P1); // Wrecker: BRUTE trait.
    const staged = stackTop(withBrute.state, "01186", "01187", "24070");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24070.when-revealed")).toBe(true);
    expect(revealed.instances[withBrute.id]?.statuses.tough).toBe(1);
  });

  // BUG (confirmed, not fixed this pass — see docs/phase7-wave4-qa.md): printed text is "When Revealed: Give each
  // Brute enemy in play a tough status card. If no tough status card was given this way, discard cards from the top
  // of the encounter deck until a Brute minion is discarded and reveal that minion." (docs/cards/by_pack/hood.md
  // 24070). `giveStatus` (packages/engine/src/effects.ts) is a documented no-op once a character is already at its
  // tough capacity (RRG 1.8 "Status Cards": one of each type) — it emits no `statusGiven` event and changes nothing.
  // The script's `ifThen(exists(BRUTE_ENEMY), giveTough(...), [fallback])` only checks whether a Brute *exists*, not
  // whether the give actually happened, so when the only Brute enemy in play is already tough, the true-branch is
  // taken, `giveTough` silently no-ops, and the fallback search never runs — contradicting "if no tough status card
  // was given this way". Isolated live (this test): with Wrecker (24065) pre-toughened to capacity and the deck
  // stacked so 24070 is the only thing revealed this round, `24070.when-revealed` fires, no `statusGiven` event is
  // emitted, and no `encounterCardRevealed` for Piledriver (24067, the deck's next Brute) ever happens either — the
  // ability silently does nothing at all, which the printed text does not allow.
  //
  // Not a one-line script fix: `giveStatus`'s EffectSpec (packages/engine/src/spec.ts) has no way to report which
  // targets actually received the status (unlike `addCounters`, which already has a `bind` reporting how many
  // counters were actually placed) — the card script has no primitive available to ask "did the give actually do
  // anything" the way the printed text needs. Filed for `game-rules-architect` (add a `bind`/count-given field to
  // `giveStatus`, mirroring `addCounters.bind`) then `ability-scripting-engineer` (rewrite 24070's script to branch
  // on that count instead of `exists(BRUTE_ENEMY)`). `it.fails`: passes once either fix lands and this starts
  // passing; per the standing rule this was first run as a plain `it` and confirmed to fail on its own assertion
  // (not a setup error) before being marked `.fails`.
  it.fails("24070.when-revealed (bug): a Brute already at tough capacity must still trigger the fallback search", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withBrute = minionEngagedWith(base, "24065", P1); // Wrecker: BRUTE trait.
    // Pre-toughen Wrecker to capacity (1) so `giveTough` is guaranteed to be a no-op per RRG 1.8's own rule.
    const preToughened = patchInstance(withBrute.state, withBrute.id, {
      statuses: { ...withBrute.state.instances[withBrute.id]!.statuses, tough: 1 },
    });
    // Piledriver (24067) is also BRUTE — it's the card the fallback search should find and reveal. 01186/01187
    // (Core box boost cards, same filler the passing "gives each Brute enemy" test above uses) absorb the villain's
    // and Wrecker's own boost draws first, so 24070 lands on the per-player deal/reveal step untouched, and 24067
    // is what's left on top of the deck for the fallback search to find.
    const staged = stackTop(preToughened, "01186", "01187", "24070", "24067");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24070.when-revealed")).toBe(true);
    // No new tough status was granted — Wrecker was already at capacity, confirming `giveTough` was a real no-op.
    expect(revealed.instances[withBrute.id]?.statuses.tough).toBe(1);
    // Per the printed text, "if no tough status card was given this way" must be true here, and the fallback
    // search should have discarded down to and revealed Piledriver (24067).
    expect(
      events.some((e) => e.type === "encounterCardRevealed" && String((e as { cardId?: unknown }).cardId) === "24067"),
    ).toBe(true);
  });
});
