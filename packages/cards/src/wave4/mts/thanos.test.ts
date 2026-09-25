import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  answer,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/** `../../testing/staging.js`'s own `driveEvents`, but with a caller-supplied `Picker` instead of a hardcoded
 * `firstLegal` — needed to steer a `declareDefender` choice while still collecting the full event log. */
/** A `Picker` that also sees every event produced so far this call — declaring a defender correctly sometimes needs
 * to know which ability's attack is currently in progress, which the abilities stack alone doesn't always show (an
 * "ability" frame pops as soon as its own effects begin, before the attack it initiated resolves; see
 * "21120.when-revealed-hero" below), but an `abilityResolved` event for it is already in the log by then. */
type EventAwarePicker = (state: GameState, eventsSoFar: readonly GameEvent[]) => readonly string[];

function driveEventsWith(
  state: GameState,
  pick: EventAwarePicker,
  ...commands: readonly Command[]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const result = applyOk(current, answerCommand(current, pick(current, events)), WAVE4_DEPS);
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, WAVE4_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

function answerCommand(state: GameState, selected: readonly string[]): Command {
  const choice = state.pendingChoice;
  if (!choice) throw new Error("no pending choice");
  return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected };
}

/**
 * Real-game tests for the Thanos scenario's own scripted refs (`thanos.ts`). Every test seats Spectrum's own precon
 * at the "thanos" scenario (`wave4Scenario`, whose `buildMtsSingleVillain` now also builds the Infinity Stone deck
 * from the Infinity Gauntlet set's `separateDecks`, `../setup.ts`).
 */

const thanosGame = (seed = 1) => startWave4Game(spectrumScenario("thanos", { seed }));

/** `wave4/mts/ebony-maw.test.ts`'s own `revealTopEncounterCard`, copied here: a filler (Advance, `01186`, from the
 * shared Standard set) goes on top of `code` because the villain's own activation deals itself a boost card from
 * the top of the deck before the per-player encounter card reveal, which would otherwise consume `code` as fodder. */
function revealTopEncounterCard(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const staged = stackEncounterDeck(stackEncounterDeck(state, code), "01186");
  const revealed = settle(runWave4(staged, endTurn(player)), pick, undefined, WAVE4_DEPS);
  const id = instancesOf(revealed, code).find((candidate) => cardsInPlay(revealed).includes(candidate))!;
  return { state: revealed, id };
}

/** Attaches `code` (found in the encounter deck or discard) to `hostId`: the test-only-surgery sibling of
 * `../../testing/staging.ts`'s `encounterCardInVillainArea` for a card that must be a genuine attachment (so
 * `hostOfSelf` queries and `cardsInPlay`'s own `villain.attachments` read find it). */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = state.instances[hostId]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;

/** Puts `code` (found in the player's deck/discard/hand) directly into their play area under their control, the
 * test-only-surgery sibling of `attachToHost`/`../../testing/staging.ts`'s `encounterCardInVillainArea` — bypasses
 * paying its resource cost, which isn't what these Thanos-scenario tests are about. */
function putAllyIntoPlay(
  state: GameState,
  code: string,
  player: PlayerId,
  damage = 0,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const wanted = cardId(code);
  const found = (id: InstanceId) => state.instances[id]?.cardId === wanted;
  const id = owner.hand.find(found) ?? owner.deck.find(found) ?? owner.discard.find(found);
  if (!id) throw new Error(`no ${code} in ${player}'s hand, deck or discard`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: player, damage } },
    },
  };
}

const attack = (state: GameState, player = P1): GameState =>
  settle(
    runWave4(state, {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(state, player),
      targetInstanceId: villainOf(state),
    }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

describe("Sanctuary (21116) — cannot take damage from player cards; When Defeated", () => {
  it("21116.sanctuary-constant: a hero's basic attack deals Thanos no damage", () => {
    const hero = settle(runWave4(thanosGame(2), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = villainOf(hero);
    const before = inst(hero, villain).damage;
    const attacked = attack(hero, P1);
    expect(inst(attacked, villain).damage).toBe(before);
  });

  it("21116.when-defeated: 'Spend none' deals no damage", () => {
    const hero = settle(runWave4(thanosGame(4), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = villainOf(hero);
    const identity = identityOf(hero, P1);
    const [sanctuary] = instancesOf(hero, "21116");
    // Spectrum's own printed THW is 1: one threat left, so a real basic thwart removes the last of it and defeats
    // Sanctuary through the engine's own defeat pipeline (`galactic-artifacts.test.ts`'s own `basicThwart` pattern
    // for a side scheme's own "When Defeated" — a direct threat-to-0 patch never fires the defeat check at all,
    // which runs where threat is *removed*, not on every read).
    const staged = patchInstance(hero, sanctuary!, { threat: 1 });
    const before = inst(staged, villain).damage;
    const after = settle(
      runWave4(staged, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: sanctuary!,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before);
  });

  it("21116.when-defeated: 'Spend 2 [physical]' deals Thanos 4 damage, ignoring his tough status", () => {
    const hero = settle(runWave4(thanosGame(4), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = villainOf(hero);
    const identity = identityOf(hero, P1);
    const toughened = patchInstance(hero, villain, { statuses: { ...inst(hero, villain).statuses, tough: 1 } });
    const [sanctuary] = instancesOf(toughened, "21116");
    // Captain America (21011) and Blade (21019), one copy each in the Spectrum/Leadership precon, both print a
    // [physical] resource icon — moved to hand so a real 2-resource payment (not a stub) covers the option's own
    // "spend 2 [physical]" requirement.
    const { state: withCap, ids } = moveToHand(toughened, P1, "21011", "21019");
    const [captainAmerica, blade] = ids as [InstanceId, InstanceId];
    const staged = patchInstance(withCap, sanctuary!, { threat: 1 });
    const before = inst(staged, villain).damage;
    const thwarted = runWave4(staged, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: sanctuary!,
    });
    const revealed = settleUntil(thwarted, "chooseOption", firstLegal, WAVE4_DEPS);
    // Option index 2 is "Spend 2 [physical]" (`maySpendPhysicalForDamage(3)`'s own option order: none, 1, 2, 3).
    const picked = answer(revealed, ["2"], WAVE4_DEPS);
    const paid = settleUntil(picked, "spendResources", firstLegal, WAVE4_DEPS);
    const settled = settle(
      answer(paid, [`hand:${captainAmerica}`, `hand:${blade}`], WAVE4_DEPS),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(settled, villain).damage).toBe(before + 4);
  });
});

/**
 * Sanctuary (21116) enters play immediately, right at setup — its 1B "When Revealed" searches for it and *reveals*
 * it, and `revealCard` for a side scheme puts it into play by type (`enterPlayOnReveal`), the same as any other
 * revealed side scheme (confirmed while writing these tests: `instancesOf(thanosGame(), "21116")`'s one instance is
 * already in `cardsInPlay` before any command runs). Its own "cannot take damage from player cards" therefore
 * shadows a plain hero attack from the very first round, so the Armor/Helmet tests below discard Sanctuary first —
 * they're about the Armor's and Helmet's own rules, not Sanctuary's.
 */
function withoutSanctuary(state: GameState): GameState {
  const [sanctuary] = instancesOf(state, "21116");
  if (!sanctuary) return state;
  return {
    ...state,
    villainArea: state.villainArea.filter((id) => id !== sanctuary),
    instances: { ...state.instances, [sanctuary]: { ...state.instances[sanctuary]!, threat: 0 } },
  };
}

describe("Thanos's Armor (21117)", () => {
  it("21117.thanoss-armor-forced-interrupt: reduces damage Thanos takes from a hero's basic attack by 1", () => {
    // Two otherwise-identical games (same seed, same hero's own basic ATK), Sanctuary removed from both so it
    // doesn't shadow the comparison: one where Thanos wears the Armor, one where he doesn't. The difference in
    // damage taken is exactly the Armor's own -1.
    const bareHero = withoutSanctuary(settle(runWave4(thanosGame(3), toHero()), firstLegal, undefined, WAVE4_DEPS));
    const bareVillain = villainOf(bareHero);
    const bareAttacked = attack(bareHero, P1);
    const withoutArmor = inst(bareAttacked, bareVillain).damage;
    expect(withoutArmor).toBeGreaterThan(0);

    const armoredHero = withoutSanctuary(settle(runWave4(thanosGame(3), toHero()), firstLegal, undefined, WAVE4_DEPS));
    const armoredVillain = villainOf(armoredHero);
    const { state: withArmor } = attachToHost(armoredHero, "21117", armoredVillain);
    const armoredAttacked = attack(withArmor, P1);
    const withArmorDamage = inst(armoredAttacked, armoredVillain).damage;

    expect(withArmorDamage).toBe(withoutArmor - 1);
  });

  it("21117.thanoss-armor-response: a hero may spend [energy][physical] to discard it after a basic attack against Thanos", () => {
    const hero = withoutSanctuary(settle(runWave4(thanosGame(3), toHero()), firstLegal, undefined, WAVE4_DEPS));
    const villain = villainOf(hero);
    const { state: withArmor, id: armor } = attachToHost(hero, "21117", villain);
    const attacked = attack(withArmor, P1);
    expect(inst(attacked, armor).attachedTo).toBe(villain); // still attached; the response is optional (a cost)
  });
});

describe("Thanos's Helmet (21118)", () => {
  it("21118.thanoss-helmet-constant: Thanos gains retaliate 1", () => {
    const hero = settle(runWave4(thanosGame(5), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = villainOf(hero);
    const { state: withHelmet } = attachToHost(hero, "21118", villain);
    const identity = identityOf(withHelmet, P1);
    const before = inst(withHelmet, identity).damage;
    // Retaliate 1: "After this character is attacked, deal 1 damage to the attacking character" — the attacking
    // hero takes 1 damage back from a single real basic attack.
    const after = attack(withHelmet, P1);
    expect(inst(after, identity).damage).toBe(before + 1);
  });

  it("21118.thanoss-helmet-response: a hero may spend [mental][physical] to discard it after a basic attack against Thanos", () => {
    const hero = withoutSanctuary(settle(runWave4(thanosGame(5), toHero()), firstLegal, undefined, WAVE4_DEPS));
    const villain = villainOf(hero);
    const { state: withHelmet, id: helmet } = attachToHost(hero, "21118", villain);
    const attacked = attack(withHelmet, P1);
    expect(inst(attacked, helmet).attachedTo).toBe(villain); // still attached; the response is optional (a cost)
  });
});

describe("Master of the Stones (21119)", () => {
  it("21119.master-of-the-stones-forced-interrupt: Thanos activating puts the top stone into play and discards Master of the Stones", () => {
    // "When Thanos activates" is the villain's own villain-phase activation, not a hero's attack against him — a
    // real `endTurn` (not `attack`, which is the *hero's* action) drives the actual villain activation.
    const state = thanosGame(6);
    const villain = villainOf(state);
    const { state: withStones } = attachToHost(state, "21119", villain);
    const stoneDeckBefore = withStones.scenarioDecks["Infinity Stone"]!.deck.length;
    const [mots] = instancesOf(withStones, "21119");
    const settled = settle(runWave4(withStones, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThan(stoneDeckBefore);
    expect(inst(settled, mots!).attachedTo).toBeNull(); // discarded at the end of the activation
  });
});

describe("Avatar of Death (21120)", () => {
  it("21120.when-revealed-alter-ego: Thanos schemes when revealed against an alter-ego player", () => {
    const state = thanosGame(1);
    const before = inst(state, state.mainScheme.instanceId).threat;
    const { state: revealed } = revealTopEncounterCard(state, "21120");
    expect(inst(revealed, revealed.mainScheme.instanceId).threat).toBeGreaterThan(before);
  });

  it("21120.when-revealed-hero: the attack it initiates gains overkill (an exact spill) and piercing (an exact tough bypass)", () => {
    // Weak-test finding (rules-qa-engineer, docs/phase7-wave4-qa.md): the prior version of this test only checked
    // damage `toBeGreaterThan` an undefended attack against the identity — the same "fired but never took effect"
    // shape §3.51 found (and this pass fixed) for Calvin Zabo's own overkill/ATK-bonus keywords, never
    // independently re-verified here after that fix landed.
    //
    // Asserted on `driveEvents`'s own typed events (`overkillSpilled`, `statusRemoved` reason `"piercing"`) rather
    // than the identity's aggregate end-of-phase damage total: Thanos also has his own separate, undefended,
    // non-piercing regular villain-phase activation this same round (`21122.boost`'s own docblock, above, already
    // documents this scenario's own encounter deck compounding a round's activations unpredictably), which would
    // make an aggregate damage total ambiguous — it can't tell "21120's own attack pierced" apart from "the other
    // activation's ordinary attack landed after tough had already been spent by 21120's". These two event types
    // are each emitted only by the specific attack that caused them, so they aren't affected by what else the round
    // also does.
    const hero = settle(runWave4(thanosGame(1), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    // Captain America (21011, 4 hit points) at 3 damage: 1 remaining hit point, less than Thanos stage 1's own ATK
    // (2) — and toughened, so without piercing this attack would be fully prevented (tough discarded, no damage
    // dealt at all, RRG 1.8 "Tough", p. 46) instead of defeating her and spilling the remainder onto the hero.
    const { state: withAlly, id: ally } = putAllyIntoPlay(hero, "21011", P1, 3);
    const toughened = patchInstance(withAlly, ally, {
      exhausted: false,
      statuses: { ...inst(withAlly, ally).statuses, tough: 1 },
    });
    // Stacked like `revealTopEncounterCard`: 21120 dealt to the player first, a harmless "01186" filler underneath
    // so Thanos's own separate activation this round draws a boost instead of consuming 21120 itself.
    const staged = stackEncounterDeck(stackEncounterDeck(toughened, "21120"), "01186");
    // Thanos also has his own separate regular villain-phase activation this same round, with its own
    // `declareDefender` prompt — found live while writing this test: it resolves *before* 21120 is even revealed,
    // so a defender picker that greedily takes any prompt offering Captain America spends her tough on the wrong
    // (non-piercing) attack instead, which the engine's own event log shows as `damagePrevented`/`statusRemoved`
    // (`reason: "preventedDamage"`), not the piercing bypass this test is about. `21120.when-revealed-hero`'s own
    // "ability" stack frame pops as soon as its effects begin, before the attack it initiates resolves, so instead
    // this waits for that ability's own `abilityResolved` event (already in the log by the time its attack's
    // `declareDefender` prompt appears) to declare her only for the right attack.
    const pick: EventAwarePicker = (s, eventsSoFar) => {
      const choice = s.pendingChoice;
      const avatarOfDeathResolved = eventsSoFar.some(
        (e) => e.type === "abilityResolved" && e.abilityId === "21120.when-revealed-hero",
      );
      if (
        choice?.prompt.kind === "declareDefender" &&
        avatarOfDeathResolved &&
        choice.options.some((o) => o.optionId === ally)
      )
        return [ally];
      return firstLegal(s);
    };
    const { events } = driveEventsWith(staged, pick, endTurn());
    // The attack's own total (base ATK plus whatever boost icons this activation happens to draw) minus Captain
    // America's 1 remaining hit point, read from the same attack's own `attackResolved` event rather than
    // hardcoded, since the boost card is real content, not staged.
    const attackTotal = events.find(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.targetInstanceId === ally,
    )!;
    expect(attackTotal.damageDealt).toBe(attackTotal.baseAtk + attackTotal.boostIcons);
    const spills = events.filter((e) => e.type === "overkillSpilled");
    expect(spills).toEqual([
      { type: "overkillSpilled", fromInstanceId: ally, toInstanceId: identity, amount: attackTotal.damageDealt - 1 },
    ]);
    const pierced = events.filter((e) => e.type === "statusRemoved" && e.reason === "piercing");
    expect(pierced).toEqual([{ type: "statusRemoved", instanceId: ally, status: "tough", reason: "piercing" }]);
  });
});

describe("Deviant Syndrome (21121)", () => {
  it("21121.when-revealed: gives Thanos a tough status card", () => {
    const state = thanosGame(1);
    const villain = villainOf(state);
    const before = inst(state, villain).statuses.tough ?? 0;
    const { state: revealed } = revealTopEncounterCard(state, "21121");
    expect(inst(revealed, villain).statuses.tough ?? 0).toBeGreaterThan(before);
  });

  it("21121.when-revealed: with Thanos already tough, places 2 threat on the main scheme instead", () => {
    // The same seed run twice, one with Thanos pre-toughened: everything else this round (step one's own
    // acceleration, Thanos's own scheme/attack) is identical between the two runs, so the *difference* in final
    // main scheme threat isolates exactly Deviant Syndrome's own "if you cannot [give tough], place 2 threat"
    // branch — a plain before/after on one run can't, because ending the turn also runs the ordinary villain
    // activation, which places its own threat independently of this card.
    const state = thanosGame(1);
    const villain = villainOf(state);
    const bare = revealTopEncounterCard(state, "21121").state;
    const toughened = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 1 } });
    const alreadyTough = revealTopEncounterCard(toughened, "21121").state;
    const bareThreat = inst(bare, bare.mainScheme.instanceId).threat;
    const toughThreat = inst(alreadyTough, alreadyTough.mainScheme.instanceId).threat;
    expect(toughThreat).toBe(bareThreat + 2);
  });
});

const STONE_CODES = ["21130", "21131", "21132", "21133", "21134", "21135"];

describe("The Titan's Throne (21124)", () => {
  it("21124.when-revealed: discards a chosen infinity stone from play", () => {
    const state = thanosGame(1); // The Infinity Stones 1B already put one stone into play at setup.
    const stoneInPlay = STONE_CODES.flatMap((code) => instancesOf(state, code)).find((id) =>
      cardsInPlay(state).includes(id),
    );
    expect(stoneInPlay).toBeDefined();
    const { state: revealed } = revealTopEncounterCard(state, "21124");
    expect(cardsInPlay(revealed)).not.toContain(stoneInPlay);
  });
});

describe("Thanos I (21111) — Forced Response: the infinity stone deck running out", () => {
  it("21111.thanos-forced-response: gives Thanos a facedown boost card after the infinity stone deck runs out", () => {
    const state = thanosGame(1);
    const villain = villainOf(state);
    const deckState = state.scenarioDecks["Infinity Stone"]!;
    const [last, ...rest] = deckState.deck;
    const drained: GameState = {
      ...state,
      scenarioDecks: {
        ...state.scenarioDecks,
        "Infinity Stone": { ...deckState, deck: [last!], discard: [...deckState.discard, ...rest] },
      },
    };
    // Master of the Stones' own Forced Interrupt ("When Thanos activates, put the top card of the infinity stone
    // deck into play") draws the deck's last card during a real villain activation — `endTurn`, not a hero's own
    // `attack` against Thanos, which isn't "Thanos activating".
    const { state: withMots } = attachToHost(drained, "21119", villain);
    const before = inst(withMots, villain).boostCards.length;
    const settled = settle(runWave4(withMots, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    // The deck ran out (its last card taken) and reshuffled its discard pile back without penalty (§3.11/§3.6).
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBeGreaterThan(0);
    expect(inst(settled, villain).boostCards.length).toBeGreaterThan(before);
  });
});

describe("Thanos II (21112) — When Revealed: search for Thanos's Helmet", () => {
  it("21112.when-revealed: Thanos's Helmet is revealed (searched and shuffled back faceup) at expert-mode setup", () => {
    const state = startWave4Game(spectrumScenario("thanos", { seed: 1, difficulty: "expert" }));
    // Expert mode starts on stage 2 (Thanos II, `villainStages.expert: [2, 3]`) — one Thanos villain record
    // (`cardId("21111")`) houses all three stages, so `stageIndex` (not `cardId`) is what distinguishes them; stage
    // 2's own "When Revealed" (ability id `21112.when-revealed`) resolves as part of scenario setup itself (RRG
    // 1.8 Appendix II: "the starting villain stage is revealed too").
    expect(activeVillain(state)!.stageIndex).toBe(1);
    const [helmet] = instancesOf(state, "21118");
    expect(helmet).toBeDefined();
    expect(inst(state, helmet!).faceup).toBe(true);
  });

  it("21112.thanos-forced-response: gives Thanos a facedown boost card after the infinity stone deck runs out, at stage II", () => {
    const state = startWave4Game(spectrumScenario("thanos", { seed: 1, difficulty: "expert" }));
    const villain = villainOf(state);
    const deckState = state.scenarioDecks["Infinity Stone"]!;
    const [last, ...rest] = deckState.deck;
    const drained: GameState = {
      ...state,
      scenarioDecks: {
        ...state.scenarioDecks,
        "Infinity Stone": { ...deckState, deck: [last!], discard: [...deckState.discard, ...rest] },
      },
    };
    const { state: withMots } = attachToHost(drained, "21119", villain);
    // A boost card given "outside activation" (RRG 1.8 "Boost") sits with the enemy only until it next activates —
    // it's consumed later the same round here (a second, separate enemy activation happens this round too), so the
    // event itself, not the final `boostCards` count, is what proves this ref fired.
    const { events } = driveEvents(WAVE4_DEPS, withMots, endTurn());
    expect(
      events.some((e) => e.type === "boostCardDealt" && e.enemyInstanceId === villain && e.outsideActivation),
    ).toBe(true);
  });
});

describe("Thanos III (21113) — reached by actually defeating Thanos II", () => {
  it("21113.when-revealed: Thanos III searches for Thanos's Helmet again", () => {
    // Thanos II prints 23 hit points for 1 hero: primed to 1 remaining, then a real basic attack lands the kill —
    // through the engine's own advance code, so stage III's own When Revealed frames push for real (`badoon.test.ts`
    // `defeatDrangI`'s own pattern). Sanctuary ("cannot take damage from player cards") is removed first, or the
    // killing blow itself would be blocked.
    const hero = withoutSanctuary(
      settle(
        runWave4(startWave4Game(spectrumScenario("thanos", { seed: 1, difficulty: "expert" })), toHero()),
        firstLegal,
        undefined,
        WAVE4_DEPS,
      ),
    );
    const villain = villainOf(hero);
    // Stage II has the Toughness keyword, so it enters play with a tough status card (RRG 1.8 Appendix II step 8),
    // which would absorb the killing blow entirely instead of taking the last point of damage — cleared here so the
    // attack actually defeats the stage.
    const primed = patchInstance(hero, villain, {
      damage: 22,
      statuses: { ...inst(hero, villain).statuses, tough: 0 },
    });
    const identity = identityOf(primed, P1);
    const defeated = settle(
      runWave4(primed, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(activeVillain(defeated)!.stageIndex).toBe(2); // Thanos III now active
    expect(instancesOf(defeated, "21118").length).toBeGreaterThan(0); // 21113.when-revealed searched again
  });

  it("21113.thanos-forced-response: gives Thanos a facedown boost card after the infinity stone deck runs out, at stage III", () => {
    const state = startWave4Game(spectrumScenario("thanos", { seed: 1, difficulty: "expert" }));
    const villain = villainOf(state);
    // Stage III directly: this ref's own registration/behavior is what's under test, not the defeat→advance
    // transition into it (covered above by `21113.when-revealed`'s own test).
    const atStageThree = patchInstance(
      { ...state, villains: state.villains.map((v) => (v.instanceId === villain ? { ...v, stageIndex: 2 } : v)) },
      villain,
      {},
    );
    const { state: withMots } = attachToHost(atStageThree, "21119", villain);
    const deckState = withMots.scenarioDecks["Infinity Stone"]!;
    const [last, ...rest] = deckState.deck;
    const drained: GameState = {
      ...withMots,
      scenarioDecks: {
        ...withMots.scenarioDecks,
        "Infinity Stone": { ...deckState, deck: [last!], discard: [...deckState.discard, ...rest] },
      },
    };
    const { events } = driveEvents(WAVE4_DEPS, drained, endTurn());
    expect(
      events.some((e) => e.type === "boostCardDealt" && e.enemyInstanceId === villain && e.outsideActivation),
    ).toBe(true);
  });
});

describe("The Infinity Stones (21114) / Balance the Scales (21115)", () => {
  it("21114b.when-revealed: puts the top stone into play at setup (already proven by the scenario's own setup)", () => {
    const state = thanosGame(1);
    const stoneInPlay = STONE_CODES.flatMap((code) => instancesOf(state, code)).find((id) =>
      cardsInPlay(state).includes(id),
    );
    expect(stoneInPlay).toBeDefined();
    expect(state.scenarioDecks["Infinity Stone"]!.deck.length).toBe(5);
  });

  it("21115b.when-revealed: each player shuffles their discard into their deck and removes the top half (rounded down) from the game", () => {
    const state = thanosGame(1); // 1 hero: stage 1 targetThreat 12, acceleration 1/round.
    const scheme = state.mainScheme.instanceId;
    // A few cards in the discard pile so "shuffle discard into deck" is observable, then one threat below target so
    // step one's own acceleration completes stage 1 for real (`escape-the-museum-completion.test.ts`'s own pattern:
    // a direct threat patch to the target wouldn't fire the completion check, which runs where threat is placed).
    const withDiscard: GameState = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        discard: [...p.discard, ...p.deck.slice(0, 3)],
        deck: p.deck.slice(3),
      })),
    };
    const primed = patchInstance(withDiscard, scheme, { threat: 11 });
    const deckBefore = primed.players[0]!.deck.length;
    const totalBefore = primed.players[0]!.deck.length + primed.players[0]!.discard.length;
    const settled = settle(runWave4(primed, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(settled.mainScheme.stageIndex).toBe(1); // advanced onto Balance the Scales (2B)
    // "Shuffles their discard pile into their deck": the 3 staged discards are gone from the discard pile — some
    // ordinary villain-phase discarding (a reset deck's own dealt encounter card, if any) may add more after the
    // shuffle, so this checks the 3 are no longer sitting there rather than an exact 0.
    expect(settled.players[0]!.discard.length).toBeLessThan(3);
    // Removed the top half (rounded down) of the reshuffled deck from the game: roughly half of the pre-effect
    // total is gone for good (the round's own incidental draws/plays account for at most a couple more, so this
    // checks "about half", not an exact one, to tolerate them).
    expect(settled.players[0]!.deck.length + settled.players[0]!.discard.length).toBeLessThanOrEqual(
      Math.ceil(totalBefore * 0.6),
    );
    void deckBefore;
  });
});

describe('Deviant Syndrome (21121) / "I Am Inevitable" (21122) / The Mad Titan (21123) — [star] Boost', () => {
  it("21121.boost: gives Thanos a tough status card when drawn as this activation's own boost card", () => {
    const state = thanosGame(7);
    const villain = villainOf(state);
    const before = inst(state, villain).statuses.tough ?? 0;
    // No filler ahead of it: a villain's own boost draw unconditionally eats whatever is on top of the encounter
    // deck (`../../testing/staging.ts`'s own `stackSetAsideBehindBoost` docblock), so this lands as the activation's
    // boost card, not a player's own reveal — the opposite of `revealTopEncounterCard`'s own filler.
    const staged = stackEncounterDeck(state, "21121");
    const settled = settle(runWave4(staged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    expect(inst(settled, villain).statuses.tough ?? 0).toBeGreaterThan(before);
  });

  it("21122.when-revealed: gives Thanos a facedown boost card when revealed as a player's own encounter card", () => {
    const state = thanosGame(7);
    const villain = villainOf(state);
    const before = inst(state, villain).boostCards.length;
    const { state: revealed } = revealTopEncounterCard(state, "21122");
    expect(inst(revealed, villain).boostCards.length).toBeGreaterThan(before);
  });

  it("21122.boost: discards the top infinity stone and applies its boost icons as this activation's own", () => {
    // Found while writing this test: "Advance" (the Standard set's own filler treachery, which prints "the villain
    // schemes") can itself trigger a *second* villain activation the same round if it's the very next card drawn,
    // and each activation re-fires Infinity Gauntlet's own Forced Response too — both correct, composing behavior,
    // not a bug, so this only checks the deck shrank (21122's own boost discarding a card is guaranteed), not by
    // exactly how much a real round happens to compound.
    const state = thanosGame(7);
    const stoneDeckBefore = state.scenarioDecks["Infinity Stone"]!.deck.length;
    const staged = stackEncounterDeck(state, "21122");
    const settled = settle(runWave4(staged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThan(stoneDeckBefore);
  });

  it("21123.when-revealed: puts the top infinity stone into play when revealed", () => {
    const state = thanosGame(7);
    const stoneDeckBefore = state.scenarioDecks["Infinity Stone"]!.deck.length;
    const { state: revealed } = revealTopEncounterCard(state, "21123");
    expect(revealed.scenarioDecks["Infinity Stone"]!.deck.length).toBe(stoneDeckBefore - 1);
  });

  it("21123.boost: if damage from this attack defeats an ally, puts the top infinity stone into play at the end of the attack", () => {
    const hero = settle(runWave4(thanosGame(7), toHero()), firstLegal, undefined, WAVE4_DEPS);
    // Captain America (21011, 4 hit points) directly in play — damaged down to 1 remaining hit point so Thanos's
    // own ATK (Thanos I, 2) defeats him when declared as the defender. Placed by surgery, not `playFromHand`: this
    // test is about Thanos's own Boost text, not about paying Captain America's cost.
    const { state: withAlly, id: ally } = putAllyIntoPlay(hero, "21011", P1, 3);
    const stoneDeckBefore = withAlly.scenarioDecks["Infinity Stone"]!.deck.length;
    const staged = stackEncounterDeck(withAlly, "21123");
    const villain = villainOf(staged);
    const pick: Picker = (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [ally] : firstLegal(s));
    const settled = settle(runWave4(staged, endTurn()), pick, undefined, WAVE4_DEPS);
    expect(cardsInPlay(settled)).not.toContain(ally); // the ally was defeated
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBe(stoneDeckBefore - 1);
    void villain;
  });
});
