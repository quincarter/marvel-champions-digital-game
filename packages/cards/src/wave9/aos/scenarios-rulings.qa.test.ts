/**
 * Rules QA for the first three scenarios of the Agents of S.H.I.E.L.D. box and their sets (`aos`: Black Widow 50064 to
 * 50079, A.I.M. Abduction 50080 to 50082, A.I.M. Science 50083 to 50085, Batroc 50086 to 50097, Batroc's Brigade 50098
 * to 50102, M.O.D.O.K. 50103 to 50124, Scientist Supreme 50125 to 50128 and S.H.I.E.L.D. 50178 to 50180; Thunderbolts,
 * Baron Zemo, the Executive Board and the Thunderbolt minion sets are a later audit): the interactions the module tests
 * and the scenario games do not assert, each tied to an RRG 1.8 section (`mc_rulesreference_v18_compressed.pdf`), an FFG
 * ruling by its date heading (marvel-champions-rulings-post-rrg-1-7.md), the box rulebook (MC50) or an owner answer
 * (docs/phase7-wave9.md section 4.1). A `FINDING` comment marks a case where the game and its source disagree: the
 * expected behavior is an `it.fails`, with a passing companion that pins today's behavior. Findings are tabled in
 * docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  playCostOf,
  remainingHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9Scenario, wave9StarterDeckSetup } from "../setup.js";
import { codeOf, inPlayCard, piles, revealedCodes, stunWith, types } from "../testing.js";
import { AOS_ABILITIES } from "./index.js";

vi.setConfig({ testTimeout: 180_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, AOS_ABILITIES) };

// Core cards
const BLANK = "01186"; // treachery, boost 0, When Revealed: the villain schemes
const MERCENARY = "50080"; // A.I.M. Abductor: minion ATK 2, SCH 1, 4 hit points, 2 boost icons (in the Black Widow encounter deck)
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage to an enemy, cost 2
const CROWD_CONTROL = "01108"; // a side scheme with the crisis icon
// Wave 9 cards
const SPRAY_FIRE = "50039";
const GAUNTLET = "50068";
const HOOK = "50069";
const GOGGLES = "50070";
const NET = "50071";
const GRUNT = "50073";
const ATTACROBATICS = "50076";
const DESTROY_EVIDENCE = "50075";
const SCIENTIST = "50083";
const SOLDIER = "50084";
const CAPTIVE = "50091";
const PATROL = "50094";
const MACHETE = "50098";
const ZARAN = "50100";
const BRIGADE = "50101";
const SOLDIERS_OF_FORTUNE = "50102";
const FLYING_INHUMAN = "50105b";
const FLYING_UPGRADE = "50109";
const FORCE_FIELD = "50117";
const HOSTAGE_SITUATION = "50121";
const ITS_ALIVE = "50123";
const TROOPER = "50178";
const DISAVOWED = "50180";
const SUPPORT_STAFF = "50008"; // S.H.I.E.L.D. support, cost 1
const BLACK_CAT = "01002"; // a Core ally, not S.H.I.E.L.D.
const AUNT_MAY = "01006"; // a Core support, not S.H.I.E.L.D.

const FURY = { starterDeckId: "nick-fury-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
type Seat = { readonly starterDeckId: string };

// ---------------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------------

interface Plan {
  /** Ability-id fragments to take when an optional trigger is offered; everything else is declined. */
  readonly take?: readonly string[];
  readonly target?: InstanceId;
  /** An option label prefix to answer a chooseOption with. */
  readonly option?: string;
  /** A label fragment to answer a chooseCards (a search) with. */
  readonly card?: string;
  /** How many hand cards to pay with when a payment is asked (0: none). */
  readonly pay?: number;
  /** Records every trigger id offered and every target offered. */
  readonly seen?: string[];
}
const planned =
  (plan: Plan = {}): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    const ids = c.options.map((o) => o.optionId as string);
    switch (c.prompt.kind) {
      case "chooseTriggers": {
        plan.seen?.push(...ids);
        const hit = ids.find((id) => plan.take?.some((t) => id.includes(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return ["decline"];
      case "spendResources":
      case "payForAbility":
        return ids.filter((id) => id.startsWith("hand:")).slice(0, plan.pay ?? 0);
      case "chooseOption": {
        plan.seen?.push(...c.options.map((o) => `option:${o.label}`));
        const hit = plan.option ? c.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "chooseCards": {
        const hit = plan.card ? c.options.find((o) => o.label.includes(plan.card!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "chooseTarget":
        plan.seen?.push(...ids.map((id) => `target:${id}`));
        return plan.target !== undefined && ids.includes(plan.target) ? [plan.target] : firstLegal(s);
      default:
        return firstLegal(s);
    }
  };
const run = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planned(plan), ...commands);
const offered = (seen: readonly string[], part: string): boolean => seen.some((id) => id.includes(part));

interface Table {
  readonly state: GameState;
  readonly villain: InstanceId;
  readonly main: InstanceId;
}

/**
 * A scenario past setup with every seat in hero form. `cleared`: the minions setup engaged are moved to the encounter
 * discard pile so nothing stands between the heroes and the villain.
 */
function open(
  scenario: "black-widow" | "batroc" | "modok",
  seats: readonly Seat[],
  opts: { readonly mode?: "standard" | "expert"; readonly cleared?: boolean; readonly seed?: number } = {},
): Table {
  const config = wave9Scenario(scenario, {
    players: seats,
    seed: opts.seed ?? 1,
    difficulty: opts.mode ?? "standard",
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  if (opts.cleared) {
    const minions = cardsInPlay(state).filter((i) => state.instances[i]!.engagedWith !== undefined);
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    state = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...minions] } },
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !minions.includes(i)) })),
      instances: Object.fromEntries(
        Object.entries(state.instances).map(([id, i]) => [
          id,
          minions.includes(id as InstanceId) ? { ...i, engagedWith: undefined } : i,
        ]),
      ) as GameState["instances"],
    };
  }
  for (const p of state.players) state = withForm(state, { heroForm: 0 }, p.playerId);
  return { state, villain: state.villains[0]!.instanceId, main: state.mainScheme.instanceId };
}

const withState = (t: Table, state: GameState): Table => ({ ...t, state });
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) => types(events, type);
const discardCodes = (s: GameState): string[] => piles(s).discard.map((i) => codeOf(s, i));
const attachedCodes = (s: GameState, id: InstanceId): string[] => inst(s, id).attachments.map((i) => codeOf(s, i));

/** A copy of `code` from the encounter deck or discard pile put into play engaged with `player` (no reveal). */
function engage(t: Table, code: string, player: PlayerId = P1): { readonly t: Table; readonly id: InstanceId } {
  const state = t.state;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id = [...pile.deck, ...pile.discard].find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    t: withState(t, {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: player } },
    }),
  };
}

/** A copy of `code` from the encounter deck or discard pile attached to `host` (an attachment already in play). */
function attach(t: Table, code: string, host: InstanceId): { readonly t: Table; readonly id: InstanceId } {
  const state = t.state;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    t: withState(t, {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    }),
  };
}

/** The player plays `code` from their hand (moved there first), paying with other hand cards. */
function playCard(t: Table, code: string, cost: number, plan: Plan = {}, player: PlayerId = P1) {
  const given = moveToHand(t.state, player, code);
  const [id] = given.ids as [InstanceId];
  return { given: given.state, id, command: play(player, id, payWith(given.state, player, cost, [id])), plan };
}

const basicAttack = (s: GameState, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: identityOf(s, player),
  targetInstanceId: target,
});

// ---------------------------------------------------------------------------------------------------------------------
// Black Widow
// ---------------------------------------------------------------------------------------------------------------------

describe("Spray Fire (50039) on Black Widow: one attack with several targets (owner Q4 = A; MC50 p. 9; ruling January 17, 2026 - Ruling 2)", () => {
  // Spray Fire deals 3 damage "to the villain and each minion engaged with that player" as one attack. Q4 = A: "this
  // attack" in a Preparation is the whole attack.

  function sprayed(top: string, withGoggles = false) {
    let t = open("black-widow", [FURY], { cleared: true });
    const merc = engage(t, MERCENARY);
    t = merc.t;
    if (withGoggles) t = attach(t, GOGGLES, t.villain).t;
    t = withState(t, stackEncounterDeck(t.state, top));
    const spray = playCard(t, SPRAY_FIRE, 3);
    const r = run(spray.given, {}, spray.command);
    return { t, merc: merc.id, r };
  }

  it("control, a card with no Preparation on top: she and the engaged minion each take 3, and her interrupt fires once for the one attack", () => {
    const { t, merc, r } = sprayed(BLANK);
    expect(damageOf(r.state, t.villain)).toBe(3);
    expect(damageOf(r.state, merc)).toBe(3);
    expect(threatOf(r.state, t.main)).toBe(threatOf(t.state, t.main) - 1);
    expect(discardCodes(r.state)).toContain(BLANK);
  });

  // FINDING (docs/phase7-wave9-qa.md, Black Widow 1): `retargetPlayerAttack` moves only the share aimed at her. Owner Q4 = A
  // says "this attack" is the whole attack, so the Grunt should be its only target, for 3 once. Expected: the Grunt 3,
  // she 0, the other minion 0.
  it.fails("A.I.M. Grunt on top (Q4 = A): the whole attack resolves against the Grunt for 3 once; she and the other minion take nothing", () => {
    const { t, merc, r } = sprayed(GRUNT);
    const grunt = inPlayCard(r.state, GRUNT)!;
    expect(grunt).toBeDefined();
    expect(damageOf(r.state, grunt)).toBe(3);
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(damageOf(r.state, merc)).toBe(0);
  });

  it("today, A.I.M. Grunt on top: only her share moves to the Grunt; the other minion still takes 3, and the Grunt, a target twice over, takes 6 and is defeated (5 hit points)", () => {
    const { t, merc, r } = sprayed(GRUNT);
    expect(inPlayCard(r.state, GRUNT)).toBeUndefined();
    expect(discardCodes(r.state)).toContain(GRUNT);
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(damageOf(r.state, merc)).toBe(3);
  });

  it("Night Vision Goggles attached and a card with no Preparation on top: all the damage to every target is prevented, then the Goggles are discarded", () => {
    const { t, merc, r } = sprayed(BLANK, true);
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(damageOf(r.state, merc)).toBe(0);
    expect(attachedCodes(r.state, t.villain)).not.toContain(GOGGLES);
    expect(discardCodes(r.state)).toContain(GOGGLES);
  });
});

describe("Attacrobatics (50076), expert mode, against a Spray Fire (owner Q4 = A; card text 50076)", () => {
  // "Prevent all damage from this attack. In expert mode, deal that much damage to the attacking character." Under Q4 = A
  // the attack is the whole of Spray Fire, so all of its damage to every target is prevented and "that much" is all of
  // it: 3 for her and 3 for the engaged minion.
  function sprayedAtAttacrobatics() {
    let t = open("black-widow", [FURY], { mode: "expert", cleared: true });
    const merc = engage(t, MERCENARY);
    t = merc.t;
    t = withState(t, stage(t.state, ATTACROBATICS));
    const spray = playCard(t, SPRAY_FIRE, 3);
    const r = run(spray.given, {}, spray.command);
    return { t, merc: merc.id, r };
  }

  it("all the damage to both targets is prevented", () => {
    const { t, merc, r } = sprayedAtAttacrobatics();
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(damageOf(r.state, merc)).toBe(0);
  });

  // Was a finding (Black Widow 2): the script read the share aimed at her; it now reads the total over every target.
  it("the attacking Fury takes all that was prevented, 6", () => {
    const { r } = sprayedAtAttacrobatics();
    expect(damageOf(r.state, identityOf(r.state))).toBe(6);
  });
});

describe("Stun Net (50071) and Grappling Hook (50069) against attack events (RRG 1.8 'Labeled Ability' p. 26, 'Cancel' p. 11)", () => {
  // "If a triggered ability is labeled as an attack ... resolving that ability is considered to attack the specified
  // target"; a hero who "cannot attack" cannot make that attack. "If the effects of an event card are canceled, the card
  // is still considered played, and it is discarded." Abilities dependent on the canceled effect cannot trigger.

  it("a hero wearing the Net cannot play an attack-labeled event (Haymaker) either: the command is refused", () => {
    let t = open("black-widow", [SPIDER_MAN], { cleared: true });
    t = attach(t, NET, identityOf(t.state)).t;
    const haymaker = playCard(t, HAYMAKER, 2);
    const result = applyCommand(haymaker.given, haymaker.command, DEPS);
    expect(result.ok).toBe(false);
    // Control: the same play without the Net is legal.
    const free = open("black-widow", [SPIDER_MAN], { cleared: true });
    const control = playCard(free, HAYMAKER, 2);
    expect(applyCommand(control.given, control.command, DEPS).ok).toBe(true);
  });

  it("an attack event canceled by the Hook never attacks her: her Forced Interrupt does not fire, nothing is removed or discarded but the Hook", () => {
    let t = open("black-widow", [SPIDER_MAN], { cleared: true });
    const hook = attach(t, HOOK, t.villain);
    t = hook.t;
    const haymaker = playCard(t, HAYMAKER, 2);
    const before = threatOf(haymaker.given, t.main);
    const deckBefore = piles(haymaker.given).deck.length;
    const r = run(haymaker.given, {}, haymaker.command);
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(threatOf(r.state, t.main)).toBe(before);
    expect(piles(r.state).deck.length).toBe(deckBefore);
    expect(playerOf(r.state, P1).discard).toContain(haymaker.id);
    expect(discardCodes(r.state)).toContain(HOOK);
  });
});

describe("Stun Net (50071) after an ally's attack (card text 50071: 'attach this card to the attacking character')", () => {
  it("an ally who attacks her wears the Net afterwards and cannot attack again; the hero is not netted", () => {
    const t = open("black-widow", [SPIDER_MAN], { cleared: true });
    const cat = inPlayArea(t.state, BLACK_CAT);
    const staged = stage(cat.state, NET);
    const r = run(
      staged,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: cat.id,
        targetInstanceId: t.villain,
      },
    );
    expect(attachedCodes(r.state, cat.id)).toEqual([NET]);
    expect(attachedCodes(r.state, identityOf(r.state))).toEqual([]);
    const ready = patchInstance(r.state, cat.id, { exhausted: false });
    const again: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat.id,
      targetInstanceId: t.villain,
    };
    expect(applyCommand(ready, again, DEPS).ok).toBe(false);
  });
});

describe("Black Widow's Gauntlet (50068) with Night Vision Goggles (50070): a granted Preparation is a Preparation resolved (MC50 p. 9)", () => {
  function gauntletAttack(withGoggles: boolean) {
    let t = open("black-widow", [SPIDER_MAN], { cleared: true });
    t = attach(t, GAUNTLET, t.villain).t;
    if (withGoggles) t = attach(t, GOGGLES, t.villain).t;
    t = withState(t, stackEncounterDeck(t.state, BLANK));
    const seen: string[] = [];
    const r = run(
      t.state,
      { take: ["gauntlets-response", "gauntlet-response"], seen },
      basicAttack(t.state, t.villain),
    );
    return { t, seen, r };
  }

  it("control, no Goggles and a card with no Preparation on top: the Gauntlet's response is offered and it may be discarded", () => {
    const { t, seen, r } = gauntletAttack(false);
    expect(offered(seen, "gauntlet")).toBe(true);
    expect(attachedCodes(r.state, t.villain)).not.toContain(GAUNTLET);
  });

  it("with the Goggles attached the card with no printed Preparation resolves the granted one, so the response (if taken) does not discard the Gauntlet", () => {
    const { t, r } = gauntletAttack(true);
    expect(attachedCodes(r.state, t.villain)).not.toContain(GOGGLES);
    expect(attachedCodes(r.state, t.villain)).toContain(GAUNTLET);
  });
});

describe("Black Widow's Gauntlet (50068) in a two-player game: 'a character you control' (card text 50068)", () => {
  it("the second player attacks her: the response is offered to the second player only, and the Gauntlet is discarded when taken", () => {
    let t = open("black-widow", [SPIDER_MAN, IRON_MAN], { cleared: true });
    t = attach(t, GAUNTLET, t.villain).t;
    t = withState(t, stage(t.state, BLANK));
    const to: string[] = [];
    const picker: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const hit = c.options.find((o) => (o.optionId as string).includes("gauntlet-response"));
        if (hit) to.push(c.playerId as string);
        return hit ? [hit.optionId as string] : [];
      }
      return planned()(s);
    };
    const turned = driveEventsPicking(DEPS, t.state, picker, endTurn(P1)).state;
    // The villain phase passed and a new round began; the second player attacks.
    const second = patchInstance(turned, identityOf(turned, P2), { exhausted: false });
    const r = driveEventsPicking(DEPS, stage(second, BLANK), picker, basicAttack(second, t.villain, P2));
    expect(to).toEqual([P2]);
    expect(attachedCodes(r.state, t.villain)).not.toContain(GAUNTLET);
  });
});

describe("Destroy Evidence (50075): incite answers a reveal, not a card put into play (RRG 1.8 'Incite X' p. 24, 'Reveal')", () => {
  it("A.I.M. Soldier revealed gains incite 1 (+1 threat); the Scientist it puts into play was not revealed: no incite, no surge", () => {
    const base = open("black-widow", [SPIDER_MAN], { cleared: true });
    const phase = (evidence: boolean) => {
      const t = evidence ? withState(base, encounterCardInVillainArea(base.state, DESTROY_EVIDENCE, 3).state) : base;
      const staged = stackEncounterDeck(t.state, BLANK, SOLDIER);
      return run(staged, {}, endTurn(P1));
    };
    const control = phase(false);
    const withEvidence = phase(true);
    expect(inPlayCard(withEvidence.state, "50083")).toBeDefined();
    expect(revealedCodes(withEvidence.state, withEvidence.events)).toEqual([SOLDIER]);
    expect(threatOf(withEvidence.state, base.main)).toBe(threatOf(control.state, base.main) + 1);
  });
});

describe("Black Widow's villain stages: what carries over (RRG 1.8 'Villain Defeat' p. 47)", () => {
  // "Attachments, upgrades, status cards, counters, and non-damage tokens on a villain carry over to the new stage." and
  // "The new stage of the villain is considered the same character as the defeated stage for purposes of card
  // abilities (such as the retaliate X keyword)."

  it("the stroke that defeats stage I: the Gauntlet's retaliate 1 still answers it, and the Gauntlet and her stunned card are on stage II", () => {
    let t = open("black-widow", [SPIDER_MAN], { cleared: true });
    t = attach(t, GAUNTLET, t.villain).t;
    t = withState(
      t,
      patchInstance(t.state, t.villain, { damage: 12, statuses: { stunned: 1, confused: 0, tough: 0 } }),
    );
    t = withState(t, stage(t.state, BLANK));
    const r = run(t.state, {}, basicAttack(t.state, t.villain));
    const second = r.state.villains[0]!.instanceId;
    expect(r.state.villains[0]!.stageIndex).toBe(1);
    expect(damageOf(r.state, second)).toBe(0);
    expect(attachedCodes(r.state, second)).toContain(GAUNTLET);
    expect(inst(r.state, second).statuses.stunned).toBe(1);
    expect(damageOf(r.state, identityOf(r.state))).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Batroc
// ---------------------------------------------------------------------------------------------------------------------

/** Relabels the top encounter cards to `codes` (the first is the villain's boost card), the rest left as they are. */
function stage(s: GameState, ...codes: readonly string[]): GameState {
  const pile = s.encounterDecks[activeEncounterDeckId(s)]!;
  return pile.deck
    .slice(0, codes.length)
    .reduce((acc, id, i) => patchInstance(acc, id, { cardId: cardId(codes[i]!) }), s);
}
const villainPhase = (s: GameState, plan: Plan, ...codes: readonly string[]) =>
  run(codes.length > 0 ? stage(s, ...codes) : s, plan, ...s.players.map((p) => endTurn(p.playerId)));

/** The scenario's thwart of the main scheme's last threat by P1's identity (readied first). */
function thwartLast(t: Table, plan: Plan = {}): Table {
  const staged = patchInstance(patchInstance(t.state, t.main, { threat: 1 }), identityOf(t.state), {
    exhausted: false,
  });
  return withState(
    t,
    run(staged, plan, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(staged),
      schemeInstanceId: t.main,
    }).state,
  );
}
/** Batroc's stage 3B by the real path (1B thwarted away, 2B advanced), one player: High side showing, one captive. */
function reach3B(mode: "standard" | "expert" = "standard"): Table {
  let t = open("batroc", [SPIDER_MAN], { mode });
  t = thwartLast(t);
  t = thwartLast(t, { option: "Advance to" });
  return t;
}
const captives = (s: GameState): InstanceId[] =>
  s.players.flatMap((p) => p.playArea).filter((i) => codeOf(s, i) === CAPTIVE);
const alertOf = (s: GameState): InstanceId => inPlayCard(s, "50090a")!;
const inPlay = (s: GameState, id: InstanceId): boolean =>
  s.players.some((p) => p.playArea.includes(id)) || s.villainArea.includes(id);

/** A crisis side scheme (Crowd Control, Core) made of the top encounter card and put into the villain area. */
function withCrisis(t: Table, threat = 4): { readonly t: Table; readonly id: InstanceId } {
  const top = piles(t.state).deck[0]!;
  const relabeled = patchInstance(t.state, top, { cardId: cardId(CROWD_CONTROL) });
  const placed = encounterCardInVillainArea(relabeled, CROWD_CONTROL, threat);
  return { t: withState(t, placed.state), id: placed.id };
}

describe("Batroc and a stunned Batroc (RRG 1.8 'Stun, Stunned' p. 41; MC50 p. 22)", () => {
  // "As the attack activation was replaced by the removal of the stunned status card, that character is not considered to
  // have attacked." Batroc's [star] Forced Response is "After Batroc attacks".

  it("a stunned Batroc's attack is replaced: the stun is spent, nobody is hurt and no threat goes on Alert Level", () => {
    const t = open("batroc", [SPIDER_MAN]);
    const stunned = patchInstance(t.state, t.villain, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const r = villainPhase(stunned, {}, BLANK, BLANK, BLANK);
    expect(inst(r.state, t.villain).statuses.stunned).toBe(0);
    expect(ofType(r.events, "attackResolved").filter((a) => a.enemyInstanceId === t.villain)).toEqual([]);
    expect(damageOf(r.state, identityOf(r.state))).toBe(0);
    expect(threatOf(r.state, alertOf(r.state))).toBe(0);
  });
});

describe("Alert Level 50090a/b: 'After a character is defeated' (RRG 1.8 'Character' p. 12, 'Defeat' p. 15)", () => {
  // "Identities (heroes and alter-egos), allies, villains, and minions are all characters." A hero whose hit points reach
  // zero is defeated, so in a two-player game the other player's game goes on and Alert Level hears it.

  function heroDefeated() {
    const t = open("batroc", [SPIDER_MAN, IRON_MAN]);
    const second = identityOf(t.state, P2);
    const left = remainingHitPoints(t.state, second, DEPS)!;
    const doomed = patchInstance(t.state, second, { damage: inst(t.state, second).damage + left - 1 });
    return { t, r: villainPhase(doomed, {}, BLANK, BLANK, BLANK, BLANK) };
  }

  it("control: Batroc's second attack defeats the second hero, who is eliminated and the game goes on", () => {
    const { r } = heroDefeated();
    expect(ofType(r.events, "playerEliminated").map((e) => e.playerId)).toEqual([P2]);
  });

  // Was a finding (Batroc 1): the script listened for allies and minions only.
  it("the defeated hero is a character defeated: Alert Level has 3 threat, not 2", () => {
    const { r } = heroDefeated();
    expect(threatOf(r.state, alertOf(r.state))).toBe(3);
  });
});

describe("The crisis icon and the box's encounter-side abilities (RRG 1.8 'Crisis Icon' p. 14, 'Card Types' p. 12)", () => {
  // "While at least one crisis icon is in play, threat cannot be removed from the main scheme by player cards." Ally is a
  // player card type, so a Rescued Captive or an Inhuman ally is a player card; the villains' own abilities are on
  // encounter cards and are not stopped.

  it("Batroc's Forced Interrupt removes its 6 threat from the main scheme with a crisis side scheme in play (an encounter card's ability)", () => {
    let t = open("batroc", [SPIDER_MAN]);
    t = withState(t, patchInstance(t.state, t.main, { threat: 9 }));
    t = withCrisis(t).t;
    const wounded = patchInstance(t.state, t.villain, { damage: 7 });
    const r = run(wounded, {}, basicAttack(wounded, t.villain));
    expect(threatOf(r.state, t.main)).toBe(3);
    expect(damageOf(r.state, t.villain)).toBe(0);
  });

  it("a Rescued Captive's Hero Action cannot remove threat from the main scheme with a crisis icon in play; it can without one", () => {
    const base = reach3B();
    const captive = captives(base.state)[0]!;
    const ready = (t: Table) => withState(t, patchInstance(t.state, captive, { exhausted: false }));
    const before = threatOf(base.state, base.main);
    const control = run(ready(base).state, {}, use(P1, captive, "50091.rescued-captive-action"));
    expect(threatOf(control.state, base.main)).toBe(before - 1);
    const crisis = withCrisis(ready(base)).t;
    // With the main scheme the ability's only target, the action cannot be initiated at all.
    const blocked = applyCommand(crisis.state, use(P1, captive, "50091.rescued-captive-action"), DEPS);
    expect(blocked.ok).toBe(false);
    expect(threatOf(crisis.state, base.main)).toBe(before);
  });
});

describe("Extract Captives 3B, expert mode: quickstrike and the redirected attack (MC50 p. 11; RRG 1.8 'Quickstrike' p. 36; owner Q25 = A)", () => {
  it("an Embassy Patrol revealed engages the hero and its quickstrike attack goes to the Rescued Captive, not the hero", () => {
    const t = reach3B("expert");
    expect(captives(t.state)).toHaveLength(1);
    const captive = captives(t.state)[0]!;
    const heroBefore = damageOf(t.state, identityOf(t.state));
    const r = villainPhase(t.state, {}, BLANK, PATROL, BLANK, BLANK);
    const patrol = inPlayCard(r.state, PATROL)!;
    expect(patrol).toBeDefined();
    const patrolAttacks = ofType(r.events, "attackResolved").filter((a) => a.enemyInstanceId === patrol);
    expect(patrolAttacks.map((a) => a.targetInstanceId)).toEqual([captive]);
    expect(damageOf(r.state, identityOf(r.state))).toBe(heroBefore);
  });
});

describe("Batroc's Brigade 50101 and Soldiers of Fortune 50102 (RRG 1.8 'Cancel' p. 11; owner Q33 = A)", () => {
  it("a Mercenary found by Soldiers of Fortune and canceled by the Brigade's interrupt is discarded without entering play, so the treachery gains surge", () => {
    let t = open("batroc", [SPIDER_MAN]);
    t = withState(t, encounterCardInVillainArea(t.state, BRIGADE, 6).state);
    const seen: string[] = [];
    const r = villainPhase(
      t.state,
      { option: "Find a Mercenary", card: "Machete", take: ["batrocs-brigade-interrupt"], pay: 3, seen },
      BLANK,
      SOLDIERS_OF_FORTUNE,
      BLANK,
      BLANK,
    );
    expect(offered(seen, "batrocs-brigade-interrupt")).toBe(true);
    expect(inPlayCard(r.state, MACHETE)).toBeUndefined();
    expect(discardCodes(r.state)).toContain(MACHETE);
    // Soldiers of Fortune's surge reveals one more card (found cards shuffle the deck, so it is not a stacked one); the
    // canceled Machete's own surge does not reveal a second.
    const revealed = revealedCodes(r.state, r.events);
    expect(revealed.slice(0, 2)).toEqual([SOLDIERS_OF_FORTUNE, MACHETE]);
    expect(revealed).toHaveLength(3);
  });

  it("the Brigade's interrupt is not offered to a player who cannot spend 3 resources: the Mercenary is revealed and stays", () => {
    let t = open("batroc", [SPIDER_MAN]);
    t = withState(t, encounterCardInVillainArea(t.state, BRIGADE, 6).state);
    const empty: GameState = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })),
    };
    const seen: string[] = [];
    const r = villainPhase(empty, { take: ["batrocs-brigade-interrupt"], seen }, BLANK, "50099", BLANK);
    expect(offered(seen, "batrocs-brigade-interrupt")).toBe(false);
    expect(inPlayCard(r.state, "50099")).toBeDefined();
  });

  it("the boost's 'spend 1 resource' is not offered to a player with nothing to spend: the card gains its 3 icons without a choice", () => {
    const t = open("batroc", [SPIDER_MAN]);
    const empty: GameState = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })),
    };
    const seen: string[] = [];
    const r = villainPhase(empty, { seen }, SOLDIERS_OF_FORTUNE, BLANK, BLANK);
    expect(seen.filter((x) => x.startsWith("option:"))).toEqual([]);
    const attack = ofType(r.events, "attackResolved").find((a) => a.enemyInstanceId === t.villain)!;
    expect(attack.baseAtk + 3).toBe(attack.damageDealt);
  });
});

describe("Zaran 50100: a tucked card leaves with him (RRG 1.8 'Tuck' p. 45)", () => {
  it("defeated, the card tucked under him goes to its owner's discard pile, not the encounter discard pile or the victory display", () => {
    const t = open("batroc", [SPIDER_MAN]);
    const topOfDeck = playerOf(t.state, P1).deck[0]!;
    const revealed = villainPhase(t.state, {}, BLANK, ZARAN, BLANK);
    const zaran = inPlayCard(revealed.state, ZARAN)!;
    expect(inst(revealed.state, zaran).tucked).toEqual([topOfDeck]);
    const staged = patchInstance(
      patchInstance(revealed.state, zaran, { damage: inst(revealed.state, zaran).damage + 4 }),
      identityOf(revealed.state),
      { exhausted: false },
    );
    const r = run(staged, {}, basicAttack(staged, zaran));
    expect(inPlay(r.state, zaran)).toBe(false);
    expect(playerOf(r.state, P1).discard).toContain(topOfDeck);
    expect(piles(r.state).discard).not.toContain(topOfDeck);
    expect(r.state.victoryDisplay).not.toContain(topOfDeck);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// M.O.D.O.K.
// ---------------------------------------------------------------------------------------------------------------------

/** Puts exactly `codes` of the four Adaptoid upgrade environments into play; the others back in the set-aside area. */
function withUpgrades(state: GameState, ...codes: readonly string[]): GameState {
  const all = ["50109", "50110", "50111", "50112"];
  const idsOf = (code: string) =>
    Object.keys(state.instances).filter((i) => codeOf(state, i as InstanceId) === code) as InstanceId[];
  const wanted = new Set(codes.flatMap(idsOf));
  const every = new Set(all.flatMap(idsOf));
  return {
    ...state,
    villainArea: [...state.villainArea.filter((i) => !every.has(i)), ...wanted],
    encounterSetAside: [
      ...state.encounterSetAside.filter((i) => !every.has(i)),
      ...[...every].filter((i) => !wanted.has(i)),
    ],
  };
}

describe("M.O.D.O.K., retaliate and a damage-proof M.O.D.O.K. (RRG 1.8 'Retaliate X' p. 38)", () => {
  // "After a character with the retaliate X keyword is attacked, deal X damage to the attacker." The keyword does not ask
  // that the attack dealt damage.

  it("with Hostage Situation in play (M.O.D.O.K. cannot take damage) an attack on him still draws retaliate 1", () => {
    let t = open("modok", [SPIDER_MAN], { cleared: true });
    t = withState(t, encounterCardInVillainArea(t.state, HOSTAGE_SITUATION, 3).state);
    const r = run(t.state, {}, basicAttack(t.state, t.villain));
    expect(damageOf(r.state, t.villain)).toBe(0);
    expect(damageOf(r.state, identityOf(r.state))).toBe(1);
  });
});

describe("Psionic Force Field 50117 gives stalwart (RRG 1.8 'Stalwart' p. 40)", () => {
  it("a stun from a player card cannot be placed on M.O.D.O.K. wearing it; without it the same stun lands", () => {
    const base = open("modok", [SPIDER_MAN], { cleared: true });
    const control = stunWith(DEPS, base.state, base.villain);
    expect(inst(control.state, base.villain).statuses.stunned).toBe(1);
    const field = attach(base, FORCE_FIELD, base.villain);
    const r = stunWith(DEPS, field.t.state, base.villain);
    expect(inst(r.state, base.villain).statuses.stunned).toBe(0);
  });
});

describe("M.O.D.O.K. (B), steady (RRG 1.8 'Steady' p. 41, 'Stun, Stunned' p. 41)", () => {
  // Fewer than 2 stunned cards: not stunned, the card does not resolve. Two: stunned, "remove each stunned status card".

  const attacks = (t: Table, stunned: number) => {
    const s = patchInstance(t.state, t.villain, { statuses: { stunned, confused: 0, tough: 0 } });
    const r = villainPhase(s, {}, BLANK, BLANK);
    return {
      attacked: ofType(r.events, "attackResolved").filter((a) => a.enemyInstanceId === t.villain).length,
      stunned: inst(r.state, t.villain).statuses.stunned,
    };
  };

  it("one stunned card does not stop his attack and stays on him; two stop it and are both removed", () => {
    const t = open("modok", [SPIDER_MAN], { mode: "expert", cleared: true });
    expect(attacks(t, 1)).toEqual({ attacked: 1, stunned: 1 });
    expect(attacks(t, 2)).toEqual({ attacked: 0, stunned: 0 });
  });
});

describe("Flying Inhuman 50105b under a crisis icon (RRG 1.8 'Crisis Icon' p. 14, 'Card Types' p. 12)", () => {
  it("'remove 1 threat from another scheme' cannot take the main scheme while a crisis side scheme is in play", () => {
    let t = open("modok", [SPIDER_MAN], { cleared: true });
    const crisis = withCrisis(t, 4);
    t = crisis.t;
    // A card of the deck relabeled as the Flying Inhuman, ready in P1's play area.
    const id = playerOf(t.state, P1).deck[0]!;
    const relabeled = patchInstance(t.state, id, { cardId: cardId(FLYING_INHUMAN), faceup: true, controllerId: P1 });
    const staged: GameState = {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    };
    const withMain = patchInstance(staged, t.main, { threat: 5 });
    const seen: string[] = [];
    const r = run(
      withMain,
      { take: ["flying-inhuman-response"], seen },
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: id,
        schemeInstanceId: crisis.id,
      },
    );
    expect(threatOf(r.state, crisis.id)).toBe(2);
    expect(threatOf(r.state, t.main)).toBe(5);
    expect(seen).not.toContain(`target:${t.main}`);
  });
});

describe("Sarah Garza 50107b and a tough Adaptoid (ruling January 26, 2026 - Ruling 3: overkill counts damage taken; RRG 1.8 'Tough' p. 44)", () => {
  function overkillAt(tough: boolean) {
    let t = open("modok", [SPIDER_MAN], { cleared: true });
    const sarah = inPlayArea(t.state, "50107b");
    t = withState(t, sarah.state);
    const adaptoid = engage(t, "50113");
    t = adaptoid.t;
    const hurt = patchInstance(t.state, adaptoid.id, {
      damage: 4,
      statuses: { stunned: 0, confused: 0, tough: tough ? 1 : 0 },
    });
    const r = run(
      hurt,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: sarah.id,
        targetInstanceId: adaptoid.id,
      },
    );
    return { t, adaptoid: adaptoid.id, r };
  }

  it("control, no tough card: her 2 damage on an Adaptoid with 1 hit point left spills 1 onto M.O.D.O.K.", () => {
    const { t, r } = overkillAt(false);
    expect(damageOf(r.state, t.villain)).toBe(1);
  });

  it("with a tough card the Adaptoid takes nothing, so there is no overkill: M.O.D.O.K. takes 0, the tough card is spent, the Adaptoid lives", () => {
    const { t, adaptoid, r } = overkillAt(true);
    expect(inst(r.state, adaptoid).statuses.tough).toBe(0);
    expect(damageOf(r.state, adaptoid)).toBe(4);
    expect(damageOf(r.state, t.villain)).toBe(0);
  });
});

describe("\"It's Alive!\" 50123 with Flying Upgrade 50109 (RRG 1.8 'Incite X' p. 24: a revealed card)", () => {
  it("each Adaptoid a player finds and reveals gains incite 1: two players, two more threat on the main scheme than without the upgrade", () => {
    const base = open("modok", [SPIDER_MAN, IRON_MAN], { cleared: true });
    const phase = (upgrades: readonly string[]) => {
      const s = withUpgrades(base.state, ...upgrades);
      return villainPhase(s, {}, BLANK, BLANK, ITS_ALIVE, BLANK);
    };
    const control = phase([]);
    const upgraded = phase([FLYING_UPGRADE]);
    expect(
      upgraded.state.players.map((p) => p.playArea.filter((i) => codeOf(upgraded.state, i) === "50113").length),
    ).toEqual([1, 1]);
    expect(threatOf(upgraded.state, base.main)).toBe(threatOf(control.state, base.main) + 2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A.I.M. Science and S.H.I.E.L.D.
// ---------------------------------------------------------------------------------------------------------------------

describe("A.I.M. Scientist 50083 and an attack with several targets (card text; RRG 1.8 'Target')", () => {
  // "While the engaged player is engaged with another minion, A.I.M. Scientist cannot be attacked."

  function sprayed(extra: boolean) {
    let t = open("black-widow", [FURY], { cleared: true });
    const scientist = engage(t, SCIENTIST);
    t = scientist.t;
    let other: InstanceId | undefined;
    if (extra) {
      const e = engage(t, MERCENARY);
      t = e.t;
      other = e.id;
    }
    t = withState(t, stage(t.state, BLANK));
    const spray = playCard(t, SPRAY_FIRE, 3);
    const r = run(spray.given, {}, spray.command);
    return { t, scientist: scientist.id, other, r };
  }

  it("Spray Fire with another minion engaged: the Scientist is left out (no damage), the other minion and the villain take 3", () => {
    const { t, scientist, other, r } = sprayed(true);
    expect(damageOf(r.state, scientist)).toBe(0);
    expect(damageOf(r.state, other!)).toBe(3);
    expect(damageOf(r.state, t.villain)).toBe(3);
  });

  it("control, engaged with the Scientist alone: Spray Fire reaches it (2 hit points, so it is defeated) and the villain", () => {
    const { t, scientist, r } = sprayed(false);
    expect(inPlay(r.state, scientist)).toBe(false);
    expect(damageOf(r.state, t.villain)).toBe(3);
  });
});

/** Maria Hill (P1, hero form) against Rhino from Core, past setup; encounter cards are relabeled where needed. */
function hillGame(opts: { readonly second?: Seat } = {}): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const seats = [wave9StarterDeckSetup("maria-hill-leadership")];
  if (opts.second) seats.push(wave9StarterDeckSetup(opts.second.starterDeckId));
  const created = createGame({ ...base, requireLegalDecks: false, players: seats }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  for (const p of state.players) state = withForm(state, { heroForm: 0 }, p.playerId);
  return state;
}
/** A deck card of `player` relabeled as `code` and put into their play area, faceup and ready. */
function inPlayArea(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  which = 0,
): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).deck[which]!;
  const relabeled = patchInstance(state, id, {
    cardId: cardId(code),
    faceup: true,
    controllerId: player,
    exhausted: false,
  });
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** A copy of `code` taken from the encounter deck or discard pile and put into play engaged with `player`. */
function engageIn(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const top = piles(state).deck[0]!;
  const relabeled = patchInstance(state, top, { cardId: cardId(code) });
  const e = engage(
    { state: relabeled, villain: relabeled.villains[0]!.instanceId, main: relabeled.mainScheme.instanceId },
    code,
    player,
  );
  return { state: e.t.state, id: e.id };
}

describe("Maria Hill's trait grant with the S.H.I.E.L.D. set (card text 50001a; RRG 1.8 'Ownership and Control' p. 31)", () => {
  it("Disavowed counts every S.H.I.E.L.D. card in play: Hill's identity and a Core ally she controls (the grant): 2 starting + 2", () => {
    const withAlly = inPlayArea(hillGame(), BLACK_CAT).state;
    const r = villainPhase(withAlly, {}, BLANK, DISAVOWED, BLANK);
    const disavowed = inPlayCard(r.state, DISAVOWED)!;
    expect(threatOf(r.state, disavowed)).toBe(2 + 2);
  });

  it("a S.H.I.E.L.D. Trooper defeated while its player controls only a Core ally: Hill's grant makes the ally a S.H.I.E.L.D. ally, so it is discarded and no threat is placed", () => {
    const withAlly = inPlayArea(hillGame(), BLACK_CAT);
    const trooper = engageIn(withAlly.state, TROOPER);
    const staged = patchInstance(patchInstance(trooper.state, trooper.id, { damage: 3 }), identityOf(trooper.state), {
      exhausted: false,
    });
    const before = threatOf(staged, staged.mainScheme.instanceId);
    const r = run(staged, {}, basicAttack(staged, trooper.id));
    expect(playerOf(r.state, P1).discard).toContain(withAlly.id);
    expect(threatOf(r.state, r.state.mainScheme.instanceId)).toBe(before);
  });
});

describe("S.H.I.E.L.D. Trooper 50178 in a two-player game: 'the engaged player' (card text)", () => {
  it("player 2 defeats the Trooper engaged with player 1: player 1 discards their S.H.I.E.L.D. support, player 2 keeps theirs", () => {
    let state = hillGame({ second: SPIDER_MAN });
    const first = inPlayArea(state, SUPPORT_STAFF, P1);
    const second = inPlayArea(first.state, SUPPORT_STAFF, P2);
    state = second.state;
    const trooper = engageIn(state, TROOPER, P1);
    const turned = run(patchInstance(trooper.state, trooper.id, { damage: 3 }), {}, endTurn(P1)).state;
    // The villain phase ran with P1 done; the next round starts with both players ready.
    const staged = patchInstance(turned, identityOf(turned, P2), { exhausted: false });
    const before = threatOf(staged, staged.mainScheme.instanceId);
    const r = run(staged, {}, basicAttack(staged, trooper.id, P2));
    expect(playerOf(r.state, P1).discard).toContain(first.id);
    expect(playerOf(r.state, P2).playArea).toContain(second.id);
    expect(threatOf(r.state, r.state.mainScheme.instanceId)).toBe(before);
  });
});

describe("Disavowed 50180 and the Core ally in Maria Hill's hand (RRG 1.8 'Ownership and Control' p. 31)", () => {
  // "A player controls the cards in their own out-of-play areas (such as the hand, the deck, and the discard pile)", and
  // Hill's text is "Each ally you control gains the S.H.I.E.L.D. trait", so an ally in her hand has the trait and costs 1
  // more under Disavowed. That is also how owner question 20 = B reads "a card you control". No ruling covers Hill's
  // trait or Disavowed together; the reading is recorded in docs/phase7-wave9-qa.md as an open point.
  function costInHand(withDisavowed: boolean, code: string): number {
    let state = hillGame();
    if (withDisavowed) {
      const top = piles(state).deck[0]!;
      state = encounterCardInVillainArea(patchInstance(state, top, { cardId: cardId(DISAVOWED) }), DISAVOWED, 2).state;
    }
    const id = playerOf(state, P1).hand[0]!;
    const relabeled = patchInstance(state, id, { cardId: cardId(code) });
    return playCostOf(relabeled, P1, id, DEPS)!.current;
  }

  it("a Core ally in her hand (Black Cat, 2 to 3) and a S.H.I.E.L.D. support (Support Staff, 1 to 2) cost 1 more; a Core support (Aunt May, 1) does not", () => {
    expect([costInHand(false, BLACK_CAT), costInHand(true, BLACK_CAT)]).toEqual([2, 3]);
    expect([costInHand(false, SUPPORT_STAFF), costInHand(true, SUPPORT_STAFF)]).toEqual([1, 2]);
    expect([costInHand(false, AUNT_MAY), costInHand(true, AUNT_MAY)]).toEqual([1, 1]);
  });
});
