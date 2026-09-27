import { cardsInPlay, characterProfile } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  settle,
  P1,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE5_DEPS } from "../../index.js";
import { playFromHand, revealFromEncounterDeck, runWave5, startWave5Game } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";

const ADVANCE = "01186";
const HYDRA_MERCENARY = "01101";
const GANKE_LEE = "27035";
const JEFFERSON_DAVIS = "27036";

const milesVsRhino = (seed = 1) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else. The `nebula-
 * obligation-nemesis.test.ts` (`wave4/nebu`) `pickingLabelStartingWith` precedent. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Spider-Man (Miles Morales)'s obligation (Keeping Secrets, 27056)", () => {
  it("27056.obligation: exhausting Miles Morales removes it from the game", () => {
    const staged = stackEncounterDeck(milesVsRhino(1), ADVANCE, "27056");
    const revealed = settle(runWave5(staged, endTurn(P1)), pickingLabelStartingWith("Exhaust"), undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "27056");
    expect(revealed.removedFromGame).toContain(obligation);
  });

  it("27056.obligation: discarding Ganke Lee and Jefferson Davis from play discards the obligation instead", () => {
    const { state: withGanke } = playFromHand(milesVsRhino(2), GANKE_LEE, 2);
    const { state: withBoth } = playFromHand(withGanke, JEFFERSON_DAVIS, 2);
    const staged = stackEncounterDeck(withBoth, ADVANCE, "27056");
    const revealed = settle(
      runWave5(staged, endTurn(P1)),
      pickingLabelStartingWith("Discard Ganke Lee"),
      undefined,
      WAVE5_DEPS,
    );
    const [obligation] = instancesOf(revealed, "27056");
    expect(revealed.removedFromGame).not.toContain(obligation);
    expect(playerOf(revealed, P1).discard.some((id) => instancesOf(revealed, GANKE_LEE).includes(id))).toBe(true);
    expect(playerOf(revealed, P1).discard.some((id) => instancesOf(revealed, JEFFERSON_DAVIS).includes(id))).toBe(true);
  });

  it("27056.obligation: with neither Ganke Lee nor Jefferson Davis in play, the card gains surge instead", () => {
    const staged = stackEncounterDeck(milesVsRhino(3), ADVANCE, "27056");
    const { events } = driveEventsPicking(
      WAVE5_DEPS,
      staged,
      pickingLabelStartingWith("Discard Ganke Lee"),
      endTurn(P1),
    );
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });
});

describe("Tracking Prey (27057, side scheme)", () => {
  it("27057.when-revealed: places 1 acceleration token here when revealed in alter-ego form", () => {
    // The default form at setup is alter-ego (RRG 1.8 Appendix II step 1).
    const { state: revealed, id } = revealFromEncounterDeck(milesVsRhino(1), "27057");
    expect(inst(revealed, id).counters["acceleration"]).toBe(1);
  });

  it("27057.when-revealed: places no acceleration token when revealed in hero form", () => {
    const hero = runWave5(milesVsRhino(2), { type: "changeForm", playerId: P1 });
    const { state: revealed, id } = revealFromEncounterDeck(hero, "27057");
    expect(inst(revealed, id).counters["acceleration"] ?? 0).toBe(0);
  });
});

describe("Prowler (27058, nemesis minion)", () => {
  it("27058.when-revealed: gives Prowler a tough status card when revealed in alter-ego form", () => {
    const { state: revealed, id } = revealFromEncounterDeck(milesVsRhino(1), "27058");
    expect(inst(revealed, id).statuses.tough).toBe(1);
  });

  it("27058.when-revealed: gives no tough status card when revealed in hero form", () => {
    const hero = runWave5(milesVsRhino(2), { type: "changeForm", playerId: P1 });
    const { state: revealed, id } = revealFromEncounterDeck(hero, "27058");
    expect(inst(revealed, id).statuses.tough ?? 0).toBe(0);
  });
});

describe("Razor Claws (27059, attachment)", () => {
  it("27059.razor-claws-constant-2: the attached minion's own attacks gain piercing (registry, the tech-gauntlets/black-dwarf precedent)", () => {
    expect(WAVE5_DEPS.abilities["27059.razor-claws-constant-2"]?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { hostOfSelf: true } }],
    });
  });

  it("27059.razor-claws-constant: attaches to the minion with the highest printed hit points", () => {
    // Bring Hydra Mercenary into play first (a real minion to attach to), the same setup Ghost-Spider's
    // Experimental Injection test uses (`ghost-spider/obligation-nemesis.test.ts`).
    const staged = stackEncounterDeck(milesVsRhino(1), ADVANCE, HYDRA_MERCENARY);
    const withMinion = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const minion = instancesOf(withMinion, HYDRA_MERCENARY).find((candidate) =>
      cardsInPlay(withMinion).includes(candidate),
    )!;
    expect(minion).toBeDefined();
    const { state: revealed } = revealFromEncounterDeck(withMinion, "27059", firstLegal, 1);
    expect(inst(revealed, minion).attachments.length).toBeGreaterThan(0);
    const [claws] = instancesOf(revealed, "27059").filter((id) => cardsInPlay(revealed).includes(id));
    expect(claws).toBeDefined();
    expect(inst(revealed, minion).attachments).toContain(claws);
  });

  it("27059.razor-claws-constant: gains surge when there is no minion in play to attach to", () => {
    const state = milesVsRhino(4); // Only Rhino (a villain, not a minion) is in play.
    const discardBefore = Object.values(state.encounterDecks)[0]!.discard.length;
    const { state: after } = revealFromEncounterDeck(state, "27059");
    const deckId = Object.keys(after.encounterDecks)[0]!;
    // Surge draws and reveals a further encounter card, so the discard pile grows by more than the reveal itself
    // and Rhino's own boost draw (docs/card-scripting-process.md's `stackSetAsideBehindBoost` lesson).
    expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 1);
  });
});

describe("Slice and Dice (27060, treachery)", () => {
  it("27060.when-revealed: Prowler attacks the player with the fewest remaining hit points", () => {
    const { state: withProwler, id: prowler } = revealFromEncounterDeck(milesVsRhino(1), "27058");
    const identity = identityOf(withProwler, P1);
    const before = inst(withProwler, identity).damage;
    // Only the villain draws an automatic boost card (RRG 1.8 p. 11) — Prowler has no `villainous` keyword.
    const { state: after } = revealFromEncounterDeck(withProwler, "27060", firstLegal, 1);
    expect(inst(after, identity).damage).toBe(before + 2); // Prowler's printed ATK.
    expect(cardsInPlay(after)).toContain(prowler);
  });

  it("27060.when-revealed: gains surge when Prowler is not in play (no attack was made)", () => {
    const state = milesVsRhino(2); // Prowler was never revealed into play.
    const discardBefore = Object.values(state.encounterDecks)[0]!.discard.length;
    const { state: after } = revealFromEncounterDeck(state, "27060");
    const deckId = Object.keys(after.encounterDecks)[0]!;
    expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 1);
  });

  it("27060.when-revealed: gains surge when the attack defeats a character", () => {
    // Bring the identity's remaining hit points down to less than Prowler's printed ATK (2) so this attack defeats
    // it — exercising the "attack defeats a character" half of the surge condition, distinct from "no attack was
    // made this way" above.
    const { state: withProwler } = revealFromEncounterDeck(milesVsRhino(3), "27058");
    const identity = identityOf(withProwler, P1);
    const maxHp = characterProfile(withProwler, identity, WAVE5_DEPS)!.maxHp;
    const nearDeath = patchInstance(withProwler, identity, { damage: maxHp - 1 });
    const discardBefore = Object.values(nearDeath.encounterDecks)[0]!.discard.length;
    const { state: after } = revealFromEncounterDeck(nearDeath, "27060", firstLegal, 1);
    // The 2 damage from Prowler's attack (ATK 2) against 1 remaining hit point defeated the identity — confirming
    // the surge below comes from "that attack defeats a character", not incidentally from "no attack was made".
    expect(playerOf(after, P1).eliminated).toBe(true);
    const deckId = Object.keys(after.encounterDecks)[0]!;
    expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 1);
  });
});
