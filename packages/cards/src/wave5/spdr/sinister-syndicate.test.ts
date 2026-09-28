import { encounterSetId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  hasKeyword,
  locateCard,
  threatCannotBeRemoved,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  P1,
  P2,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents, driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { defeatWithAttack, playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

/**
 * Iron Spider's Sinister Syndicate (`ironspider_sinister` `spdr` 31030–31037, docs/phase7-wave5-handoff.md):
 * Grand Larceny (side scheme), six unique Criminal minions and the Surge in Crime environment.
 */
const withSyndicate = (
  seed = 1,
  extra: { readonly extraPlayers?: readonly { readonly starterDeckId: string }[] } = {},
) => startWave5Game(spdrScenario("rhino", { seed, modularSetIds: [encounterSetId("ironspider_sinister")], ...extra }));

/**
 * `stackEncounterDeck` alone isn't enough to make `code` the card a player's own villain-phase step-2 activation
 * (or their own reveal step) deals: the activation's own boost draw (one per activation) reads the top of the
 * same deck first (RRG 1.8 "Boost", p. 11) — one 0-icon filler (`01186` Advance) ahead of `code` survives it and
 * reaches the real reveal/activation (`spiderham/inheritors.test.ts`'s own `stageForReveal` precedent).
 */
const withFiller = (state: GameState, ...codes: readonly string[]): GameState =>
  stackEncounterDeck(state, "01186", ...codes);

/** Test surgery: put `code` into play already engaged with P1, so it activates in the villain phase (Solus's own
 * `engagedWithP1` helper, `spiderham/inheritors.test.ts`). */
const engagedWithP1 = (state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } => {
  const staged = encounterCardInVillainArea(state, code);
  const id = staged.id;
  return {
    id,
    state: {
      ...staged.state,
      villainArea: staged.state.villainArea.filter((i) => i !== id),
      players: staged.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...staged.state.instances, [id]: { ...staged.state.instances[id]!, engagedWith: P1 } },
    },
  };
};

/** Hand cards to pay for an ally with (spdr's own precon codes, `allies.test.ts`'s `topUp`). */
const topUpForAlly = (state: GameState): GameState => moveToHand(state, P1, "31004", "31004", "31006").state;

const resolvedAbility = (events: readonly GameEvent[], abilityId: string): boolean =>
  events.some((e) => e.type === "abilityResolved" && e.abilityId === abilityId);

describe("Grand Larceny (31030)", () => {
  it("31030.grand-larceny-constant: threat cannot be removed from this scheme while a Criminal minion is in play", () => {
    const base = withSyndicate();
    const { state: withScheme, id: scheme } = encounterCardInVillainArea(base, "31030", 4);
    expect(threatCannotBeRemoved(withScheme, WAVE5_DEPS, scheme)).toBe(false);
    const { state: withMinion } = encounterCardInVillainArea(withScheme, "31035"); // Sandman, CRIMINAL
    expect(threatCannotBeRemoved(withMinion, WAVE5_DEPS, scheme)).toBe(true);
  });
});

describe("Bombshell (31031)", () => {
  /** P1 in hero form with Daredevil (ally, 31014, 3 hit points) in play and Bombshell (ATK 3) engaged with them. */
  const bombshellTable = (withAlly: boolean) => {
    const hero = runWave5(withSyndicate(), toHero(P1));
    const allied = withAlly ? playFromHand(topUpForAlly(hero), "31014", 2) : { state: hero, id: null };
    const { state: engaged, id: bombshell } = engagedWithP1(allied.state, "31031");
    // 0-boost fillers: Rhino's own boost and the encounter reveal add nothing that deals damage.
    return { state: stackEncounterDeck(engaged, "01186", "01186"), bombshell, ally: allied.id };
  };
  const extraTo =
    (target: InstanceId | null): ((state: GameState) => readonly string[]) =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "divideEvenlyRemainder" && target) return [target];
      return firstLegal(state);
    };
  const bombshellDamage = (events: readonly GameEvent[], bombshell: InstanceId) =>
    events.flatMap((e) =>
      e.type === "damageDealt" && e.sourceInstanceId === bombshell ? [[e.targetInstanceId, e.amount] as const] : [],
    );

  it("31031.bombshell-constant: her 3 damage splits 2/1 between the identity and the ally, the first player placing the 2", () => {
    const { state, bombshell, ally } = bombshellTable(true);
    const identity = identityOf(state, P1);
    const prompts: { amount: number; each: number; authority: string }[] = [];
    const pick = (s: GameState) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "divideEvenlyRemainder") {
        prompts.push({ amount: choice.prompt.amount, each: choice.prompt.each, authority: choice.authority });
      }
      return extraTo(ally)(s);
    };
    const { events } = driveEventsPicking(WAVE5_DEPS, state, pick, endTurn(P1));
    expect(prompts).toEqual([{ amount: 1, each: 1, authority: "firstPlayerTargets" }]);
    expect(bombshellDamage(events, bombshell).sort()).toEqual(
      [
        [ally, 2],
        [identity, 1],
      ].sort(),
    );
  });

  it("31031.bombshell-constant: the leftover point can go to the identity instead (2 to the identity, 1 to the ally)", () => {
    const { state, bombshell, ally } = bombshellTable(true);
    const identity = identityOf(state, P1);
    const { events } = driveEventsPicking(WAVE5_DEPS, state, extraTo(identity), endTurn(P1));
    expect(bombshellDamage(events, bombshell).sort()).toEqual(
      [
        [ally, 1],
        [identity, 2],
      ].sort(),
    );
  });

  it("31031.bombshell-constant: with no ally, all 3 go to the identity and nobody is asked", () => {
    const { state, bombshell } = bombshellTable(false);
    const identity = identityOf(state, P1);
    let asked = false;
    const pick = (s: GameState) => {
      if (s.pendingChoice?.prompt.kind === "divideEvenlyRemainder") asked = true;
      return firstLegal(s);
    };
    const { events } = driveEventsPicking(WAVE5_DEPS, state, pick, endTurn(P1));
    expect(asked).toBe(false);
    expect(bombshellDamage(events, bombshell)).toEqual([[identity, 3]]);
  });

  it("31031.boost: deals 1 indirect damage to each player, sourced from Bombshell, exactly once each", () => {
    const state = withSyndicate(1, { extraPlayers: [{ starterDeckId: "spiderham-justice" }] });
    const bombshellId = instancesOf(state, "31031")[0]!;
    const p1Identity = identityOf(state, P1);
    const p2Identity = identityOf(state, P2);
    const staged = withFiller(state, "31031"); // drawn as Rhino's own boost card during his attack
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1), endTurn(P2));
    expect(resolvedAbility(events, "31031.boost")).toBe(true);
    const dealt = events.filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === bombshellId,
    );
    const forP1 = dealt.filter((e) => e.targetInstanceId === p1Identity);
    const forP2 = dealt.filter((e) => e.targetInstanceId === p2Identity);
    expect(forP1).toHaveLength(1);
    expect(forP1[0]!.amount).toBe(1);
    expect(forP2).toHaveLength(1);
    expect(forP2[0]!.amount).toBe(1);
  });
});

/** Test surgery: replace a player's whole hand with exactly these cards, so a "choose a card from your hand
 * matching X" ability has a deterministic, known-legal set of options — the opening hand otherwise deals random
 * cards from the deck (seeded), some of which may also match a broad filter like "a printed [energy] resource". */
const withExactHand = (state: GameState, player: typeof P1, ids: readonly InstanceId[]): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...ids] } : p)),
});

describe("Electro (31032)", () => {
  it("31032.electro-constant: base 3 hit points with no attachment", () => {
    const state = withSyndicate();
    const { state: withElectro, id } = encounterCardInVillainArea(state, "31032");
    expect(characterProfile(withElectro, id, WAVE5_DEPS)?.maxHp).toBe(3);
  });

  it("31032.electro-forced-response: after she engages you, attaches a chosen energy-resource card from your hand and gains +1 hit point for it", () => {
    const state = withSyndicate();
    const { state: withCard, ids } = moveToHand(state, P1, "31003"); // VEN#m: printed [energy] resource icon.
    const venom = ids[0]!;
    const soleHand = withExactHand(withCard, P1, [venom]); // only 1 legal choice: deterministic.
    const staged = withFiller(soleHand, "31032"); // reveal step: Electro enters play, engaging P1.
    const electroId = instancesOf(staged, "31032")[0]!;
    const { state: after, events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(resolvedAbility(events, "31032.electro-forced-response")).toBe(true);
    expect(locateCard(after, venom)).toMatchObject({ kind: "attachment", hostInstanceId: electroId });
    expect(characterProfile(after, electroId, WAVE5_DEPS)?.maxHp).toBe(4);
  });

  it("31032.electro-forced-response: with no energy-resource card in hand, attaches nothing and hit points stay 3", () => {
    const state = withSyndicate();
    const emptyHand = withExactHand(state, P1, []);
    const staged = withFiller(emptyHand, "31032");
    const electroId = instancesOf(staged, "31032")[0]!;
    const { state: after, events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(resolvedAbility(events, "31032.electro-forced-response")).toBe(true);
    expect(characterProfile(after, electroId, WAVE5_DEPS)?.maxHp).toBe(3);
  });
});

describe("Hobgoblin (31033)", () => {
  it("31033.hobgoblin-forced-interrupt: replaces Hobgoblin's attack with discarding cards equal to his ATK, dealing 1 indirect damage per boost icon discarded", () => {
    // Hero form: an engaged minion's own activation is an attack only when the engaged player is in hero form
    // (alter-ego engagements scheme instead, `villain/phase.ts` `activateEnemy`'s own `player.identity.form ===
    // "hero" ? "attack" : "scheme"`).
    const engaged = engagedWithP1(runWave5(withSyndicate(), toHero(P1)), "31033");
    const hobgoblinId = engaged.id;
    // Hobgoblin's own ATK is 2: stack a boost filler, then two known-boost-icon Core Standard cards as the top two
    // (01101 Hydra Mercenary = 1 icon, 01107 Breakin' & Takin' = 2 icons; `packages/content/src/data/core/cards.ts`).
    const staged = withFiller(engaged.state, "01101", "01107");
    const deck = staged.encounterDecks[Object.keys(staged.encounterDecks)[0] as never]!.deck;
    const [c1, c2] = deck.slice(1, 3); // index 0 is the boost filler, consumed by the activation's own boost draw.
    const identity = identityOf(staged, P1);
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(resolvedAbility(events, "31033.hobgoblin-forced-interrupt")).toBe(true);
    const discarded = events.filter(
      (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
        e.type === "cardMoved" && e.to.kind === "encounterDiscard" && [c1, c2].includes(e.instanceId),
    );
    expect(discarded).toHaveLength(2);
    // Read off `damageDealt`'s own `sourceInstanceId`, not the identity's total damage: Rhino's own villain
    // activation this same villain phase also damages the identity (Morlun/Verna's own tests,
    // `spiderham/inheritors.test.ts`, isolate the same way).
    const dealt = events.filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === hobgoblinId && e.targetInstanceId === identity,
    );
    expect(dealt).toHaveLength(1);
    expect(dealt[0]!.amount).toBe(3); // 1 (01101) + 2 (01107)
  });
});

describe("Iron Spider (31034)", () => {
  it("31034.iron-spider-constant: Iron Spider's own attacks gain overkill; the villain's do not", () => {
    const state = withSyndicate();
    const { state: withIronSpider, id } = encounterCardInVillainArea(state, "31034");
    expect(hasKeyword(withIronSpider, id, "overkill", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(withIronSpider, withIronSpider.villains[0]!.instanceId, "overkill", WAVE5_DEPS)).toBe(false);
  });
});

describe("Sandman (31035)", () => {
  it("31035.sandman-forced-response: after taking any amount of damage from an attack, discards the top 7 cards of the encounter deck", () => {
    const state = withSyndicate();
    const { state: withSandman, id: sandmanId } = encounterCardInVillainArea(state, "31035");
    const hero = runWave5(withSandman, toHero(P1));
    const identity = identityOf(hero, P1);
    const { events } = driveEvents(WAVE5_DEPS, hero, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: sandmanId,
    } as never);
    expect(resolvedAbility(events, "31035.sandman-forced-response")).toBe(true);
    const discarded = events.filter((e) => e.type === "cardMoved" && e.to.kind === "encounterDiscard");
    expect(discarded.length).toBeGreaterThanOrEqual(7);
  });

  it("31035.sandman-forced-response: without a damaging attack, never resolves", () => {
    const state = withSyndicate();
    const { state: withSandman } = encounterCardInVillainArea(state, "31035");
    const { events } = driveEvents(WAVE5_DEPS, withSandman, endTurn(P1));
    expect(resolvedAbility(events, "31035.sandman-forced-response")).toBe(false);
  });

  it("31035.boost: discards the top 7 cards of the encounter deck", () => {
    const state = withSyndicate();
    const staged = stackEncounterDeck(state, "31035"); // drawn as Rhino's own boost card during his attack
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(resolvedAbility(events, "31035.boost")).toBe(true);
    const discarded = events.filter((e) => e.type === "cardMoved" && e.to.kind === "encounterDiscard");
    expect(discarded.length).toBeGreaterThanOrEqual(7);
  });
});

describe("Spot (31036)", () => {
  it("31036.when-defeated: exact-lethal damage (no excess) shuffles Spot into the encounter deck", () => {
    // The engine's defeat sweep only checks characters in a player's own `playArea` — an unengaged card left in
    // `villainArea` by `encounterCardInVillainArea` alone is never checked, so a minion under test here needs the
    // same "in play, in a player's area" test surgery `engagedWithP1` gives Hobgoblin above.
    const engaged = engagedWithP1(withSyndicate(), "31036");
    const spotId = engaged.id;
    const hero = runWave5(engaged.state, toHero(P1));
    // Spot has 4 hit points; SP//dr's own hero-form ATK is 2 (31001a) — prime to exactly 2 remaining so the attack
    // lands exactly lethal with no excess damage.
    const primed = patchInstance(hero, spotId, { damage: 2 });
    const identity = identityOf(primed, P1);
    const { state: after, events } = driveEvents(WAVE5_DEPS, primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: spotId,
    } as never);
    expect(resolvedAbility(events, "31036.when-defeated")).toBe(true);
    expect(locateCard(after, spotId)?.kind).toBe("encounterDeck");
  });

  it("31036.when-defeated: defeated with excess damage, discards Spot normally", () => {
    const engaged = engagedWithP1(withSyndicate(), "31036");
    const spotId = engaged.id;
    const hero = runWave5(engaged.state, toHero(P1));
    const after = defeatWithAttack(hero, spotId);
    expect(locateCard(after, spotId)?.kind).toBe("encounterDiscard");
  });

  it("31036.boost: puts Spot into play engaged with you", () => {
    const state = withSyndicate();
    const staged = stackEncounterDeck(state, "31036"); // drawn as Rhino's own boost card during his attack
    const revealed = driveEvents(WAVE5_DEPS, staged, endTurn(P1)).state;
    const spot = instancesOf(revealed, "31036").find((id) => inst(revealed, id).engagedWith === P1);
    expect(spot).toBeDefined();
    expect(revealed.players[0]!.playArea).toContain(spot);
  });
});

describe("Surge in Crime (31037)", () => {
  it("31037.surge-in-crime-constant: each Criminal minion gains surge; the villain does not", () => {
    const state = withSyndicate();
    const { state: withEnv } = encounterCardInVillainArea(state, "31037");
    const { state: withSandman, id: sandmanId } = encounterCardInVillainArea(withEnv, "31035"); // CRIMINAL
    expect(hasKeyword(withSandman, sandmanId, "surge", WAVE5_DEPS)).toBe(true);
    expect(hasKeyword(withSandman, withSandman.villains[0]!.instanceId, "surge", WAVE5_DEPS)).toBe(false);
  });

  it("31037.surge-in-crime-action: with no Criminal minion in play, spends 2 resources of any type to discard this card", () => {
    const state = withSyndicate();
    const hero = runWave5(state, toHero(P1));
    const { state: withEnv, id: envId } = encounterCardInVillainArea(hero, "31037");
    const { state: withCards, ids } = moveToHand(withEnv, P1, "31004", "31005"); // 1 energy + 1 mental icon = 2.
    const before = playerOf(withCards, P1).hand.length;
    const resolved = settle(
      runWave5(
        withCards,
        use(
          P1,
          envId,
          "31037.surge-in-crime-action",
          ids.map((id) => ({ fromHand: id })),
        ),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(locateCard(resolved, envId)?.kind).toBe("encounterDiscard");
    expect(playerOf(resolved, P1).hand.length).toBe(before - 2);
  });

  it("31037.surge-in-crime-action: with a Criminal minion in play, the action is not offered", () => {
    const state = withSyndicate();
    const hero = runWave5(state, toHero(P1));
    const { state: withEnv, id: envId } = encounterCardInVillainArea(hero, "31037");
    const { state: withMinion } = encounterCardInVillainArea(withEnv, "31035"); // Sandman, CRIMINAL
    const { state: withCards, ids } = moveToHand(withMinion, P1, "31004", "31005");
    const refused = applyCommand(
      withCards,
      use(
        P1,
        envId,
        "31037.surge-in-crime-action",
        ids.map((id) => ({ fromHand: id })),
      ),
      WAVE5_DEPS,
    );
    expect(refused.ok).toBe(false);
  });
});
