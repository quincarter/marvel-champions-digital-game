/**
 * Rules QA for the Silk pack `silk` (52001 to 52038): the interactions the module tests do not assert, each tied to
 * an RRG 1.8 section (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading
 * (marvel-champions-rulings-post-rrg-1-7.md) or an owner answer (docs/phase7-wave9.md section 4.1). A `FINDING` comment
 * marks a case where the game and its source disagree: the expected behavior is an `it.fails`, with a passing
 * companion that pins today's behavior. Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { activeEncounterDeckId, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../testing/staging.js";
import { BLANK, ONE_ICON, onlyDeck } from "../testing.js";
import { engaged } from "./aspect-basic.testing.js";
import { SILK_DEPS, engageMinion, silkGame, silkHeroGame, tuckEncounterCard } from "./testing.js";

vi.setConfig({ testTimeout: 180_000 });

const KICK = "52003";
const CRAWL = "52004";
const MEMORY = "52008";
const WEBBING = "52009";
const OUTWIT = "52010";
const CLAWS = "52011";
const REFLEXES = "52012";
const OVERLOAD = "52028";
const BRIDE = "52031";
const SENSE = "52001a.silk-sense";
const MEMORY_INTERRUPT = "52008.eidetic-memory-interrupt";
const CLAWS_INTERRUPT = "52011.spider-claws-interrupt";
const OUTWIT_INTERRUPT = "52010.outwit-interrupt";
const REFLEXES_INTERRUPT = "52012.spider-reflexes-interrupt";
const WEBBING_ACTION = "52009.organic-webbing-action";
const SANDMAN = "01102"; // Rhino set minion, 4 hit points
const SHOCKER = "01103"; // Rhino set minion
const CROWD_CONTROL = "01108"; // Rhino set side scheme with a crisis icon
const SIDE = "01107"; // Rhino set side scheme (Breakin' & Takin')
const ADVANCE = "01186"; // Standard set treachery, not in Rhino's set

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const tuckedUnder = (s: GameState, host: InstanceId): readonly InstanceId[] => inst(s, host).tucked;
const tuckedOf = (s: GameState, player = P1): readonly InstanceId[] => tuckedUnder(s, identityOf(s, player));
const encounterDiscard = (s: GameState): readonly InstanceId[] => s.encounterDecks[activeEncounterDeckId(s)]!.discard;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused"): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });
const basicAttack = (s: GameState, target: InstanceId, player = P1) =>
  ({
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identityOf(s, player),
    targetInstanceId: target,
  }) as const;
const basicThwart = (s: GameState, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: scheme }) as const;

/**
 * A picker that answers each prompt from `opts` (accept a trigger by its ability id, name a target, name cards), and
 * records every trigger option ever offered in `offered`. Anything else is as `firstLegal`; Silk defends when asked.
 */
function chooser(
  opts: {
    readonly accept?: readonly string[];
    readonly targets?: readonly InstanceId[];
    readonly cards?: readonly InstanceId[];
    readonly defend?: boolean;
  } = {},
) {
  const offered: string[] = [];
  const queue = [...(opts.targets ?? [])];
  const picker: Picker = (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      offered.push(...ids);
      const hit = ids.find((id) => (opts.accept ?? []).some((a) => id.endsWith(a)));
      return hit ? [hit] : [];
    }
    if (choice.prompt.kind === "declareDefender") return opts.defend ? [identityOf(s)] : ["decline"];
    const target = choice.prompt.kind === "chooseTarget" ? queue.find((t) => ids.includes(t)) : undefined;
    if (target) {
      queue.splice(queue.indexOf(target), 1);
      return [target];
    }
    const wanted = (opts.cards ?? []).filter((c) => ids.includes(c));
    if (wanted.length > 0) return wanted;
    return firstLegal(s);
  };
  return { picker, offered, wasOffered: (ref: string) => offered.some((o) => o.endsWith(ref)) };
}

/** Plays the event `code` from the hand for `cost`, with the prompts answered by `pick`. */
function cast(state: GameState, code: string, cost: number, pick: Picker) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  return {
    id,
    ...driveEventsPicking(SILK_DEPS, given.state, pick, play(P1, id, payWith(given.state, P1, cost, [id]))),
  };
}

const upgraded = (state: GameState, code: string, cost: number): { state: GameState; id: InstanceId } =>
  playFromHand(SILK_DEPS, state, code, cost);

// ---------------------------------------------------------------------------------------------------------------------
// Stun and Confuse against Silk's labeled events and basic-power upgrades
// ---------------------------------------------------------------------------------------------------------------------

describe("status cards against Silk's events and upgrades (RRG 1.8 'Labeled Ability', 'Stun, Stunned', 'Confuse, Confused')", () => {
  it("Swinging Silk Kick 52003 (Hero Action (attack)) by a stunned hero: the whole ability is canceled, so no damage and the tucked card is not discarded", () => {
    // Labeled Ability: "the entire ability (except for its costs) is canceled"; Stun: the attack is replaced by removing the
    // stun card. The optional discard is part of the effect, not a cost. Ruling Aug 13, 2026 (1): the event is still played.
    const tucked = tuckEncounterCard(silkHeroGame(), SANDMAN);
    const stunned = withStatus(tucked.state, identityOf(tucked.state), "stunned");
    const chosen = chooser({ targets: [villainOf(stunned)], cards: [tucked.id] });
    const r = cast(stunned, KICK, 3, chosen.picker);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(tuckedOf(r.state)).toEqual([tucked.id]);
  });

  it("Wallcrawl 52004 (Hero Action (thwart)) by a confused hero: no threat is removed, neither the 2 nor the 3, and the tucked card stays", () => {
    // Confuse: a confused identity that attempts to thwart or use a thwart ability discards the card instead.
    const tucked = tuckEncounterCard(silkHeroGame(), SANDMAN);
    const base = patchInstance(tucked.state, schemeOf(tucked.state), { threat: 8 });
    const confused = withStatus(base, identityOf(base), "confused");
    const chosen = chooser({ targets: [schemeOf(confused)], cards: [tucked.id] });
    const r = cast(confused, CRAWL, 1, chosen.picker);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
    expect(inst(r.state, schemeOf(r.state)).threat).toBe(8);
    expect(tuckedOf(r.state)).toEqual([tucked.id]);
  });

  it("a stunned hero's basic attack is replaced by clearing the stun: Spider Claws 52011 is not offered and stays ready", () => {
    // Stun: "that character is not considered to have attacked"; the interrupt is for "when Silk makes a basic attack".
    const claws = upgraded(tuckEncounterCard(silkHeroGame(), SANDMAN).state, CLAWS, 2);
    const stunned = withStatus(claws.state, identityOf(claws.state), "stunned");
    const chosen = chooser({ accept: [CLAWS_INTERRUPT] });
    const r = driveEventsPicking(SILK_DEPS, stunned, chosen.picker, basicAttack(stunned, villainOf(stunned)));
    expect(chosen.wasOffered(CLAWS_INTERRUPT)).toBe(false);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, claws.id).exhausted).toBe(false);
  });

  it("a confused hero's basic thwart is replaced by clearing the confusion: Outwit 52010 is not offered and stays ready", () => {
    const outwit = upgraded(tuckEncounterCard(silkHeroGame(), SANDMAN).state, OUTWIT, 2);
    const base = patchInstance(outwit.state, schemeOf(outwit.state), { threat: 8 });
    const confused = withStatus(base, identityOf(base), "confused");
    const chosen = chooser({ accept: [OUTWIT_INTERRUPT] });
    const r = driveEventsPicking(SILK_DEPS, confused, chosen.picker, basicThwart(confused, schemeOf(confused)));
    expect(chosen.wasOffered(OUTWIT_INTERRUPT)).toBe(false);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
    expect(inst(r.state, schemeOf(r.state)).threat).toBe(8);
    expect(inst(r.state, outwit.id).exhausted).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Silk Sense (52001a): "you defeat", through events and with Overkill, and other players
// ---------------------------------------------------------------------------------------------------------------------

describe("Silk Sense 52001a: 'After you defeat a minion or side scheme'", () => {
  it("Swinging Silk Kick with overkill defeats Sandman (4 hit points): the 5 excess damage hits Rhino and Silk Sense tucks Sandman (RRG 'Overkill')", () => {
    // Overkill: when an attack defeats a minion, the excess damage is dealt to the villain. 9 - 4 = 5. An event's attack is
    // still an attack "you" make, so the defeat is Silk's.
    const placed = engageMinion(silkHeroGame(), SANDMAN);
    const tucked = tuckEncounterCard(placed.state, SHOCKER);
    const chosen = chooser({ accept: [SENSE], targets: [placed.id], cards: [tucked.id] });
    const r = cast(tucked.state, KICK, 3, chosen.picker);
    expect(chosen.wasOffered(SENSE)).toBe(true);
    expect(tuckedOf(r.state)).toEqual([placed.id]);
    expect(damage(r.state, villainOf(r.state))).toBe(5);
    expect(encounterDiscard(r.state)).toContain(tucked.id);
  });

  it("Wallcrawl 52004 defeating a side scheme with its first sentence: Silk Sense tucks it at once, and it can pay the second sentence's discard", () => {
    // RRG 'Initiating Abilities' step 7 and FAQ 'Tigra (#51)': a response may be initiated immediately after its condition
    // becomes true, before the rest of the ability resolves. So the Rhino-set side scheme is tucked between the two
    // sentences, matches the main scheme chosen next (Rhino's set), and is discarded for the 3 additional threat.
    const side = encounterCardInVillainArea(silkHeroGame(), SIDE, 2);
    const loaded = patchInstance(side.state, schemeOf(side.state), { threat: 8 });
    const chosen = chooser({ accept: [SENSE], targets: [side.id, schemeOf(loaded)], cards: [side.id] });
    const r = cast(loaded, CRAWL, 1, chosen.picker);
    expect(chosen.wasOffered(SENSE)).toBe(true);
    expect(inst(r.state, schemeOf(r.state)).threat).toBe(5);
    expect(tuckedOf(r.state)).toEqual([]);
    expect(encounterDiscard(r.state)).toContain(side.id);
  });

  it("another player's defeat is not 'you defeat': P2's attack on a minion does not offer Silk Sense to P1", () => {
    // 'You' is the player. The response is the Silk player's, and the other player's hero has no such response.
    const base = withForm(withForm(silkGame({ twoPlayers: true }), { heroForm: 0 }), { heroForm: 0 }, P2);
    const staged = engaged(base, SHOCKER, "p2-minion", P2);
    const wounded = patchInstance(staged, "p2-minion" as InstanceId, { damage: 99 });
    const chosen = chooser({ accept: [SENSE] });
    const r = driveEventsPicking(
      SILK_DEPS,
      wounded,
      chosen.picker,
      endTurn(P1),
      basicAttack(wounded, "p2-minion" as InstanceId, P2),
    );
    expect(chosen.wasOffered(SENSE)).toBe(false);
    expect(tuckedOf(r.state, P1)).toEqual([]);
    expect(tuckedOf(r.state, P2)).toEqual([]);
    expect(encounterDiscard(r.state)).toContain("p2-minion");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Eidetic Memory (52008, erratum RRG 1.8 p. 70): "When you reveal"
// ---------------------------------------------------------------------------------------------------------------------

describe("Eidetic Memory 52008: 'When you reveal a card from the same encounter set as a card tucked under your identity'", () => {
  /** Eidetic Memory in play with Sandman tucked; the deck is the given cards in order (boost first). */
  function staged(...deck: readonly string[]) {
    const memory = upgraded(silkHeroGame(), MEMORY, 1);
    const tucked = tuckEncounterCard(memory.state, SANDMAN);
    return { state: stackEncounterDeck(tucked.state, ...deck), memory: memory.id, tucked: tucked.id };
  }
  const offers = (s: GameState) => {
    const chosen = chooser({ accept: [MEMORY_INTERRUPT] });
    const r = driveEventsPicking(SILK_DEPS, s, chosen.picker, endTurn(P1));
    return { ...r, chosen };
  };

  it("a boost card of the tucked card's set is flipped, not revealed: not offered; the same card dealt to Silk is (control)", () => {
    // RRG 'Boost Icon', 'Enemy Activation' (p. 3 steps): boost cards are flipped faceup and resolve only their boost text.
    const boost = staged(SHOCKER, ADVANCE);
    const asBoost = offers(boost.state);
    expect(asBoost.chosen.wasOffered(MEMORY_INTERRUPT)).toBe(false);
    expect(tuckedOf(asBoost.state)).toEqual([boost.tucked]);
    expect(encounterDiscard(asBoost.state)).toContain(instancesOf(boost.state, SHOCKER)[0]!);
    const dealt = staged(ADVANCE, SHOCKER);
    expect(offers(dealt.state).chosen.wasOffered(MEMORY_INTERRUPT)).toBe(true);
  });

  it("a card another player reveals is not 'you reveal': P2's Shocker does not open Silk's interrupt", () => {
    const memory = upgraded(
      withForm(withForm(silkGame({ twoPlayers: true }), { heroForm: 0 }), { heroForm: 0 }, P2),
      MEMORY,
      1,
    );
    const tucked = tuckEncounterCard(memory.state, SANDMAN);
    // Boost for each of Rhino's two activations, then P1's card (not Rhino's set), then P2's (Shocker, Rhino's set).
    const deck = onlyDeck(tucked.state, BLANK, BLANK, ONE_ICON, SHOCKER);
    const chosen = chooser({ accept: [MEMORY_INTERRUPT] });
    const r = driveEventsPicking(SILK_DEPS, deck, chosen.picker, endTurn(P1), endTurn(P2));
    expect(codeOf(r.state, instancesOf(r.state, SHOCKER)[0]!)).toBe(SHOCKER);
    expect(inst(r.state, instancesOf(r.state, SHOCKER)[0]!).engagedWith).toBe(P2);
    expect(chosen.wasOffered(MEMORY_INTERRUPT)).toBe(false);
    expect(tuckedOf(r.state)).toEqual([tucked.id]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Silk Sense Overload 52028 and Hunting the Spider-Bride 52031 against cards the module tests do not use
// ---------------------------------------------------------------------------------------------------------------------

/** The obligation 52028 in P1's play area, as revealing it leaves it (Silk in hero form), and the state at the next player phase. */
function withOverload(): { readonly state: GameState; readonly id: InstanceId } {
  const start = stackEncounterDeck(silkGame(), ADVANCE, OVERLOAD);
  const r = driveEventsPicking(
    SILK_DEPS,
    start,
    (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s)),
    endTurn(P1),
  );
  return { state: withForm(r.state, { heroForm: 0 }), id: instancesOf(r.state, OVERLOAD)[0]! };
}

/** A set-aside copy of `code` tucked faceup under P1's identity, as an earlier tuck would have left it. */
function tuckSetAside(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state);
  const moved: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
  };
  const faceup = patchInstance(moved, id, { faceup: true });
  return {
    id,
    state: {
      ...patchInstance(faceup, host, { tucked: [...inst(faceup, host).tucked, id] }),
      stateChecks: { ...faceup.stateChecks, [`${host}:52001a.silk-constant`]: false },
    },
  };
}

describe("Wallcrawl 52004 and the crisis icon (RRG 'Crisis Icon')", () => {
  it("the 3 threat aimed at the main scheme is not removed while Crowd Control (crisis) is in play, but the 2 from Crowd Control itself comes off", () => {
    // Crisis Icon: while at least one crisis icon is in play, threat cannot be removed from the main scheme by player cards.
    const crowd = encounterCardInVillainArea(silkHeroGame(), CROWD_CONTROL, 4);
    const tucked = tuckEncounterCard(crowd.state, SANDMAN);
    const loaded = patchInstance(tucked.state, schemeOf(tucked.state), { threat: 8 });
    // First sentence on Crowd Control (4 to 2); the second sentence on the main scheme, discarding Sandman for the 3.
    const chosen = chooser({ targets: [crowd.id, schemeOf(loaded)], cards: [tucked.id] });
    const r = cast(loaded, CRAWL, 1, chosen.picker);
    expect(inst(r.state, crowd.id).threat).toBe(2);
    expect(inst(r.state, schemeOf(r.state)).threat).toBe(8);
  });
});

describe("Silk Sense 52001a against a treachery that tucks itself (Hunting the Spider-Bride 52031)", () => {
  it("the Bride is not in the encounter discard pile when the response resolves, so it is tucked once, by its own text, and not again", () => {
    // Silk Sense: "tuck that card under here from the encounter discard pile". The Bride's When Revealed already tucked it,
    // so nothing is in the discard pile to take (RRG 'Tuck': a card is tucked from where it is, once).
    const base = silkHeroGame();
    const id = playerOf(base, P1).setAside.find((i) => codeOf(base, i) === BRIDE)!;
    const unset: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    };
    const stackedState = stackEncounterDeck(unset, ADVANCE, ONE_ICON);
    const deckId = activeEncounterDeckId(stackedState);
    const pile = stackedState.encounterDecks[deckId]!;
    const staged: GameState = {
      ...stackedState,
      encounterDecks: {
        ...stackedState.encounterDecks,
        [deckId]: { ...pile, deck: [pile.deck[0]!, id, ...pile.deck.slice(1)] },
      },
    };
    const chosen = chooser({ accept: [SENSE] });
    const r = driveEventsPicking(SILK_DEPS, staged, chosen.picker, endTurn(P1));
    expect(tuckedOf(r.state).filter((t) => t === id)).toEqual([id]);
    expect(encounterDiscard(r.state)).not.toContain(id);
    expect(new Set(tuckedOf(r.state)).size).toBe(tuckedOf(r.state).length);
  });
});

describe("tucks and discards by upgrades (owner decision Q7 = A, docs/phase7-wave9.md section 4.1)", () => {
  it("Spider Reflexes 52012's tuck 'after this attack' is a player card's tuck: with Silk Sense Overload in play the boost card goes under it", () => {
    // Overload 52028: "When a card would be tucked under your identity by a player card effect, tuck it under here instead."
    // Reflexes is a player card (an upgrade). The module tests cover Albert Moon, Smooth as Silk and Get the Scoop.
    const overload = withOverload();
    const reflexes = upgraded(overload.state, REFLEXES, 2);
    const stackedState = stackEncounterDeck(reflexes.state, SANDMAN, ADVANCE);
    const sandman = instancesOf(stackedState, SANDMAN)[0]!;
    const chosen = chooser({ accept: [REFLEXES_INTERRUPT], defend: true });
    const r = driveEventsPicking(SILK_DEPS, stackedState, chosen.picker, endTurn(P1));
    expect(chosen.wasOffered(REFLEXES_INTERRUPT)).toBe(true);
    expect(tuckedUnder(r.state, overload.id)).toEqual([sandman]);
    expect(tuckedOf(r.state)).toEqual([]);
  });

  it("Organic Webbing 52009's cost discard of a Hunting the Spider-Bride deals 2 damage to Silk (a player card's discard, a cost)", () => {
    // Q7 = A: any discard a player card causes, cost included, counts as "a player card effect". Cindy Moon's action is
    // covered by the module tests; Webbing is the other cost that discards a tucked card.
    const base = silkHeroGame();
    const tucked = tuckSetAside(base, BRIDE);
    const webbing = upgraded(tucked.state, WEBBING, 2);
    const chosen = chooser({ cards: [tucked.id] });
    const r = driveEventsPicking(
      SILK_DEPS,
      webbing.state,
      chosen.picker,
      use(P1, webbing.id, WEBBING_ACTION, [], { discarded: [tucked.id] }),
    );
    expect(tuckedOf(r.state)).toEqual([]);
    expect(encounterDiscard(r.state)).toContain(tucked.id);
    expect(damage(r.state, identityOf(r.state))).toBe(2);
    expect(inst(r.state, webbing.id).exhausted).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// "Stop Hitting Yourself" 52016 and a tough status card
// ---------------------------------------------------------------------------------------------------------------------

describe('"Stop Hitting Yourself" 52016: "After you defend against an enemy attack and take no damage"', () => {
  const SHY = "52016.stop-hitting-yourself-response";
  /** Silk defends Rhino's attack (ATK 2 + 2 boost icons = 4 against DEF 3: 1 damage) with SHY in hand. */
  function defend(tough: boolean) {
    const given = moveToHand(silkHeroGame(), P1, "52016");
    const base = tough ? withToughStatus(given.state, identityOf(given.state)) : given.state;
    const stacked = stackEncounterDeck(base, SANDMAN, ADVANCE);
    const chosen = chooser({ defend: true });
    const r = driveEventsPicking(SILK_DEPS, stacked, chosen.picker, endTurn(P1));
    return { ...r, chosen };
  }
  const withToughStatus = (s: GameState, id: InstanceId): GameState =>
    patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });

  it("control: Silk takes 1 damage from the defended attack, so the response is not offered", () => {
    const r = defend(false);
    expect(damage(r.state, identityOf(r.state))).toBe(1);
    expect(r.chosen.wasOffered(SHY)).toBe(false);
  });
  it("a tough status card prevents all of the damage and the hero 'is not considered to have taken damage': the response is offered (RRG 'Tough')", () => {
    // Tough: "As a tough status card prevents damage fully, the character who had the tough status card is not considered
    // to have taken damage." DEF applies first (4 - 3 = 1 would be dealt), then the tough card absorbs it.
    const r = defend(true);
    expect(damage(r.state, identityOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.tough).toBe(0);
    expect(r.chosen.wasOffered(SHY)).toBe(true);
  });
});
