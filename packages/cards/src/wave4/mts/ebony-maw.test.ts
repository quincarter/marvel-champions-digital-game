import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  traitsOf,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for the Ebony Maw scenario's own scripted refs (`ebony-maw.ts`). Every test seats Spectrum's own
 * precon at the "ebony-maw" scenario (`wave4Scenario`, which now builds `MTS_SCENARIOS`'s single-villain record).
 */

const ebonyMawGame = (seed = 1) => startWave4Game(spectrumScenario("ebony-maw", { seed }));

/** Test-only surgery, `encounterCardInVillainArea`'s sibling for the "in a player's play area" shape §3.16 needs
 * (docs/phase7-wave4.md §3.16): moves an encounter card straight from the encounter deck/discard into `player`'s
 * play area, uncontrolled, the way the scenario's Spell rule routes a revealed one (docs/phase7-wave4.md §3.40), with
 * a chosen counter count, so abilities that read "Spell environments in your play area" can be set up exactly. */
function encounterCardInPlayerArea(
  state: GameState,
  code: string,
  player: PlayerId,
  counters: Readonly<Record<string, number>> = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, counters },
      },
    },
  };
}

/**
 * Stacks `code` on top of the active encounter deck and ends the turn, revealing it for real as that player's own
 * villain-phase encounter card (`wave2/trors/crossbones.test.ts`'s own pattern) — the sibling of
 * `../../testing/staging.ts`'s `revealFromEncounterDeck`, which only works for a nemesis-set card staged set aside.
 */
function revealTopEncounterCard(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  // A filler card (Advance, `01186`, from the shared Standard set every scenario includes) goes on top of `code`
  // itself: the villain's own activation deals itself a boost card from the top of the deck *before* this player's
  // own encounter card is revealed, so with no filler that boost draw would consume `code` as fodder instead
  // (`wave2/trors/crossbones.test.ts`'s own `stageNemesisCardForReveal` comment, same shape here).
  // A second filler under `code`: a Spell has surge, and the card it surges into must not be one that touches it
  // (Channeling Trance removes a counter from each Spell in your play area).
  const staged = stackEncounterDeck(state, "01186", code, "01186");
  // Not a copy already in play before the reveal (Attack on Knowhere 1B's setup Spell may be one).
  const already = new Set(cardsInPlay(staged));
  const revealed = settle(runWave4(staged, endTurn(player)), pick, undefined, WAVE4_DEPS);
  const id = instancesOf(revealed, code).find(
    (candidate) => cardsInPlay(revealed).includes(candidate) && !already.has(candidate),
  )!;
  return { state: revealed, id };
}

describe("Ebony Maw (21071–21073) — Forced Interrupt", () => {
  it("21071.ebony-maw-forced-interrupt / 21076.fireball-forced-response: removing Fireball's last invocation counter when Ebony Maw attacks discards it and deals 4 damage to your identity", () => {
    const hero = settle(runWave4(ebonyMawGame(3), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: staged, id: fireball } = encounterCardInPlayerArea(hero, "21076", P1, { invocation: 1 });
    const before = inst(staged, identityOf(staged, P1)).damage;
    const after = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    // Ebony Maw's forced interrupt removed Fireball's last counter, discarding it and dealing 4 damage.
    expect(playerOf(after, P1).playArea).not.toContain(fireball);
    expect(inst(after, identityOf(after, P1)).damage).toBeGreaterThanOrEqual(before + 4);
  });

  it("21072.ebony-maw-forced-interrupt, 21073.ebony-maw-forced-interrupt: stages II and III repeat 21071's identical script verbatim", () => {
    for (const id of ["21072.ebony-maw-forced-interrupt", "21073.ebony-maw-forced-interrupt"] as const) {
      expect(WAVE4_DEPS.abilities[id]).toEqual(WAVE4_DEPS.abilities["21071.ebony-maw-forced-interrupt"]);
    }
  });
});

describe("Fireball (21076)", () => {
  it("21076.fireball-constant: enters play with 4 invocation counters", () => {
    const state = ebonyMawGame(4);
    const { state: revealed, id } = revealTopEncounterCard(state, "21076");
    expect(inst(revealed, id).counters.invocation).toBe(4);
  });
});

describe("Manipulation (21077)", () => {
  it("21077.manipulation-constant: enters play with 2 invocation counters", () => {
    const state = ebonyMawGame(6);
    const { state: revealed, id } = revealTopEncounterCard(state, "21077");
    expect(inst(revealed, id).counters.invocation).toBe(2);
  });

  it("21077.manipulation-forced-response: the last counter removed discards a random hand card and confuses your identity", () => {
    const hero = settle(runWave4(ebonyMawGame(6), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: staged, id: manipulation } = encounterCardInPlayerArea(hero, "21077", P1, { invocation: 1 });
    const handBefore = playerOf(staged, P1).hand.length;
    const after = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(after, P1).playArea).not.toContain(manipulation);
    expect(playerOf(after, P1).hand.length).toBeLessThan(handBefore);
    expect(inst(after, identityOf(after, P1)).statuses.confused ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("Pacification (21078)", () => {
  it("21078.pacification-constant: enters play with 3 invocation counters", () => {
    const state = ebonyMawGame(7);
    const { state: revealed, id } = revealTopEncounterCard(state, "21078");
    expect(inst(revealed, id).counters.invocation).toBe(3);
  });

  it("21078.pacification-forced-response: the last counter removed stuns your identity", () => {
    const hero = settle(runWave4(ebonyMawGame(7), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: staged, id: pacification } = encounterCardInPlayerArea(hero, "21078", P1, { invocation: 1 });
    const after = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(after, P1).playArea).not.toContain(pacification);
    expect(inst(after, identityOf(after, P1)).statuses.stunned ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("Rubblestorm (21079)", () => {
  it("21079.rubblestorm-constant: enters play with 3 invocation counters", () => {
    const state = ebonyMawGame(8);
    const { state: revealed, id } = revealTopEncounterCard(state, "21079");
    expect(inst(revealed, id).counters.invocation).toBe(3);
  });

  it("21079.rubblestorm-forced-response: the last counter removed deals 2 damage to each character you control", () => {
    const hero = settle(runWave4(ebonyMawGame(8), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: staged, id: rubblestorm } = encounterCardInPlayerArea(hero, "21079", P1, { invocation: 1 });
    const before = inst(staged, identityOf(staged, P1)).damage;
    const after = settle(runWave4(staged, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(after, P1).playArea).not.toContain(rubblestorm);
    expect(inst(after, identityOf(after, P1)).damage).toBeGreaterThanOrEqual(before + 2);
  });
});

describe("Agent of Thanos (21080)", () => {
  it("21080.when-revealed-alter-ego: places 1 threat on the main scheme per Spell environment in your play area", () => {
    // Start the main scheme at 0 so the villain phase's threat cannot complete 1B (6 threat) and reset the count.
    const game = ebonyMawGame(9);
    const state = patchInstance(game, game.mainScheme.instanceId, { threat: 0 });
    const { state: staged } = encounterCardInPlayerArea(state, "21076", P1, { invocation: 4 });
    const before = inst(staged, staged.mainScheme.instanceId).threat;
    const { state: revealed } = revealTopEncounterCard(staged, "21080");
    expect(inst(revealed, revealed.mainScheme.instanceId).threat).toBeGreaterThanOrEqual(before + 1);
  });

  it("21080.when-revealed-hero: deals damage to your hero equal to the Spell environments in your play area, or gains surge with none", () => {
    const def = WAVE4_DEPS.abilities["21080.when-revealed-hero"]!;
    expect(def.trigger).toMatchObject({ kind: "whenRevealed" });
    const json = JSON.stringify(def.effects);
    // Gated on hero form, dealing damage sized by the Spell-in-your-play-area count, with a surge fallback.
    expect(json).toContain('"form":"hero"');
    expect(json).toContain('"kind":"dealDamage"');
    expect(json).toContain('"kind":"count","query":{"trait":"SPELL","inPlayAreaOf":{"kind":"controller"}}');
    expect(json).toContain('"kind":"gainSurge"');
  });
});

describe("Abjuration (21082)", () => {
  it("21082.abjuration-constant: a real attack against Ebony Maw deals him no damage while it's attached", () => {
    const hero = settle(runWave4(ebonyMawGame(10), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const [villain] = hero.villains;
    const { state: staged, id: abjuration } = encounterCardInPlayerArea(hero, "21082", P1);
    const attached: GameState = {
      ...staged,
      instances: {
        ...staged.instances,
        [abjuration]: { ...staged.instances[abjuration]!, attachedTo: villain!.instanceId, controllerId: null },
        [villain!.instanceId]: {
          ...staged.instances[villain!.instanceId]!,
          attachments: [...staged.instances[villain!.instanceId]!.attachments, abjuration],
        },
      },
      players: staged.players.map((p) => ({ ...p, playArea: p.playArea.filter((c) => c !== abjuration) })),
    };
    const identity = identityOf(attached, P1);
    const attacked = settle(
      runWave4(attached, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain!.instanceId,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(attacked, villain!.instanceId).damage).toBe(inst(attached, villain!.instanceId).damage);
  });

  it("21082.abjuration-forced-response: after it prevents 2 or more damage from a single attack, it discards itself", () => {
    const def = WAVE4_DEPS.abilities["21082.abjuration-forced-response"]!;
    expect(def.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "damagePrevented", selfIs: "source", fromAttack: true, eventAtLeast: { amount: 2 } },
    });
    expect(def.effects).toEqual([{ kind: "discardFromPlay", target: { kind: "self" } }]);
  });
});

describe("Restrained (21083)", () => {
  it("21083.restrained-constant, 21083.restrained-constant-2: exhausts the host on entering play attached, and the host cannot ready", () => {
    const def1 = WAVE4_DEPS.abilities["21083.restrained-constant"]!;
    expect(def1.trigger).toMatchObject({ kind: "response", forced: true, on: { on: "cardEntersPlay" } });
    expect(def1.effects).toEqual([{ kind: "exhaust", target: { kind: "host" } }]);
    expect(WAVE4_DEPS.abilities["21083.restrained-constant-2"]!.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "cannotReady", target: { hostOfSelf: true } }],
    });
  });

  it("21083.restrained-action: spends [energy][physical] resources to discard this card", () => {
    const def = WAVE4_DEPS.abilities["21083.restrained-action"]!;
    expect(def.cost).toMatchObject({ resources: { energy: 1, physical: 1 } });
    expect(def.effects).toEqual([{ kind: "discardFromPlay", target: { kind: "self" } }]);
  });
});

describe("Reactor Overload (21084)", () => {
  it("21084.when-revealed: each player must choose to take 2 damage or place 2 threat here", () => {
    const state = ebonyMawGame(12);
    const before = inst(state, identityOf(state, P1)).damage;
    const { state: revealed, id } = revealTopEncounterCard(state, "21084");
    // `firstLegal` declines nothing here (it's a forced choice); one branch or the other must have resolved.
    const damageTaken = inst(revealed, identityOf(revealed, P1)).damage - before;
    const threatPlaced = inst(revealed, id).threat;
    expect(damageTaken === 2 || threatPlaced >= 2).toBe(true);
  });
});

describe("Black Dwarf (21085)", () => {
  it("21085.black-dwarf-constant: Black Dwarf's own attacks gain overkill", () => {
    expect(WAVE4_DEPS.abilities["21085.black-dwarf-constant"]!.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { self: true } }],
    });
  });
});

describe("Supergiant (21086)", () => {
  it("21086.supergiant-forced-response: after it attacks and damages a character, that character is stunned", () => {
    const def = WAVE4_DEPS.abilities["21086.supergiant-forced-response"]!;
    expect(def.trigger).toMatchObject({ kind: "response", forced: true });
    expect(def.effects).toEqual([{ kind: "giveStatus", target: { kind: "eventTarget" }, status: "stunned" }]);
  });
});

describe("The Black Order (21087)", () => {
  it("21087.the-black-order-constant: threat cannot be removed while a Black Order minion is in play", () => {
    expect(WAVE4_DEPS.abilities["21087.the-black-order-constant"]!.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "threatCannotBeRemoved", target: { self: true } }],
    });
  });
});

describe("Blood to Spare (21088)", () => {
  it("21088.when-revealed: a player not engaged with a minion is engaged with a searched-for Black Order minion", () => {
    const state = ebonyMawGame(13);
    expect(Object.values(state.instances).some((i) => i.engagedWith === P1)).toBe(false);
    const { state: revealed } = revealTopEncounterCard(state, "21088");
    expect(Object.values(revealed.instances).some((i) => i.engagedWith === P1)).toBe(true);
  });
});

describe("Black Order Infantry (21089)", () => {
  it("21089.when-defeated: gives the villain a tough status card", () => {
    const hero = settle(runWave4(ebonyMawGame(14), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const [villain] = hero.villains;
    const { state: staged, id } = encounterCardInPlayerArea(hero, "21089", P1);
    const engaged: GameState = {
      ...staged,
      instances: { ...staged.instances, [id]: { ...staged.instances[id]!, engagedWith: P1 } },
    };
    const defeated = defeatWithAttack(WAVE4_DEPS, engaged, id);
    expect(inst(defeated, villain!.instanceId).statuses.tough ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("21089.boost: the same tough status, granted from its boost text", () => {
    expect(WAVE4_DEPS.abilities["21089.boost"]!.effects).toEqual([
      { kind: "giveStatus", target: { kind: "villain" }, status: "tough" },
    ]);
  });
});

describe("Outrider (21090)", () => {
  it("21090.when-revealed: discards 1 card at random from your hand", () => {
    const state = ebonyMawGame(15);
    const before = playerOf(state, P1).hand.length;
    const { state: revealed } = revealTopEncounterCard(state, "21090");
    expect(playerOf(revealed, P1).hand.length).toBeLessThan(before);
  });

  it("21090.boost: the same, discards 1 card at random from your hand", () => {
    expect(WAVE4_DEPS.abilities["21090.boost"]!.effects).toEqual([
      { kind: "discardFromHand", amount: { kind: "const", value: 1 }, player: { kind: "controller" }, random: true },
    ]);
  });
});

describe("Landing Craft (21091)", () => {
  it("21091.when-defeated: discards from the encounter deck until a minion is discarded and engages the defeating player with it", () => {
    const hero = settle(runWave4(ebonyMawGame(16), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: revealed, id: landingCraft } = revealTopEncounterCard(hero, "21091");
    const identity = identityOf(revealed, P1);
    const ready = patchInstance(patchInstance(revealed, landingCraft, { threat: 1 }), identity, { exhausted: false });
    const defeated = settle(
      runWave4(ready, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: landingCraft,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const engagedMinion = Object.values(defeated.instances).find(
      (i) => i.engagedWith === P1 && i.instanceId !== landingCraft,
    );
    expect(engagedMinion).toBeDefined();
  });
});

describe("MC21 p. 6's Spell rule, seeded at setup (docs/phase7-wave4.md §3.40)", () => {
  const spellsIn = (state: GameState, player: PlayerId) =>
    playerOf(state, player).playArea.filter((id) => traitsOf(state, id, WAVE4_DEPS).includes("SPELL" as never));

  it("the scenario carries the rule, and 21074b.when-revealed puts a Spell into each player's play area at setup", () => {
    const state = ebonyMawGame(3);
    expect(state.scenarioRules.rules).toEqual([{ kind: "entersRevealersPlayArea", cards: { trait: "SPELL" } }]);
    expect(spellsIn(state, P1)).toHaveLength(1);
    expect(state.villainArea.some((id) => traitsOf(state, id, WAVE4_DEPS).includes("SPELL" as never))).toBe(false);
  });

  it("21072.when-revealed / 21073.when-revealed / 21075a.when-revealed: each player puts a Spell into play in their own area (the same effect 21074b.when-revealed runs at setup)", () => {
    for (const ref of ["21072.when-revealed", "21073.when-revealed", "21075a.when-revealed", "21074b.when-revealed"]) {
      const json = JSON.stringify(WAVE4_DEPS.abilities[ref]!.effects);
      expect(json, ref).toContain('"kind":"forEachPlayer"');
      expect(json, ref).toContain('"kind":"discardEncounterUntil"');
      expect(json, ref).toContain(
        '"kind":"putIntoPlay","card":{"kind":"slot","slot":"spell"},"controller":{"kind":"scoped"}',
      );
    }
    // The Power Stone shuffles the encounter discard pile back first, Attack on Knowhere after.
    const powerStone = JSON.stringify(WAVE4_DEPS.abilities["21075a.when-revealed"]!.effects);
    expect(powerStone.indexOf("encounterDeckShuffle")).toBeLessThan(powerStone.indexOf("forEachPlayer"));
  });

  it("21081.when-revealed: with no Spell in your play area, Channeling Trance puts one there", () => {
    const start = ebonyMawGame(4);
    const [spell] = spellsIn(start, P1);
    // Clear the setup Spell (test surgery) so Channeling Trance takes its "if you have no Spell" branch.
    const cleared: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== spell) } : p,
      ),
      removedFromGame: [...start.removedFromGame, spell!],
    };
    expect(spellsIn(cleared, P1)).toHaveLength(0);
    const staged = stackEncounterDeck(cleared, "01186", "21081");
    const after = settle(
      runWave4(staged, endTurn()),
      firstLegal,
      (s) => s.step.phase === "player" && s.round > staged.round,
      WAVE4_DEPS,
    );
    expect(spellsIn(after, P1).length).toBeGreaterThanOrEqual(1);
  });
});
