/**
 * Rules QA for the Black Panther (Shuri) pack `bp` (51001 to 51042): the interactions the module tests do not
 * assert, each tied to an RRG 1.8 section (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading
 * (marvel-champions-rulings-post-rrg-1-7.md) or an owner answer (docs/phase7-wave9.md section 4.1, or wave 3 Q16 in
 * docs/phase7-wave3.md section 4). A `FINDING` comment marks a case where the game and its source disagree: the
 * expected behavior is an `it.fails`. Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
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
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { BLANK, FILLER_A, FILLER_B, ONE_ICON, attacksBy, onlyDeck, types } from "../testing.js";
import { DEPS, engaged, scripted, tchallaGame } from "./aspect-basic.testing.js";
import { attachUpgrade, bpGame, bpHeroGame, putInPlay } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const BEADS = "51010";
const CLAWS = "51011";
const BITES = "51012";
const SUIT = "51013";
const STRIKE = "51003";
const PROWL = "51004";
const FOREVER = "51005";
const HEART = "51025";
const RAMONDA = "51008";
const RAFT = "51018";
const SHADOW = "51031";
const SCREAM = "51035";
const EXTREME_RISK = "51042";
const JOYSTICK = "51039";
const SHOCKER = "01103";
const VULTURE = "01167"; // Core: Quickstrike. (After this minion engages your hero, it attacks.)
const T_CHALLA_ALLY = "51002";

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, schemeOf(s), { threat: n });

/** Hero form, the main scheme at 5 threat. */
const hero = (): GameState => withThreat(bpHeroGame(), 5);

/** The event `code` played from the hand, paying `cost` other hand cards. */
function cast(state: GameState, code: string, cost: number, opts: Parameters<typeof scripted>[2] = {}) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const out = scripted(given.state, [play(P1, id, payWith(given.state, P1, cost, [id]))], opts);
  return { ...out, id, before: given.state };
}

const basicAttack = (s: GameState, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: target }) as const;
const basicThwart = (s: GameState) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: schemeOf(s) }) as const;

/** T'Challa's Shadow (an obligation) in P1's play area with `counters` doubt counters, as revealing it leaves it. */
function withShadow(s: GameState, counters = 4): { readonly state: GameState; readonly id: InstanceId } {
  const id = instancesOf(s, SHADOW)[0]!;
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const placed: GameState = {
    ...s,
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
  };
  return { state: patchInstance(placed, id, { faceup: true, controllerId: P1, counters: { doubt: counters } }), id };
}

// ---------------------------------------------------------------------------------------------------------------------
// Stun and Confuse against labeled Specials and events (RRG "Labeled Ability", "Stun, Stunned", "Confuse, Confused")
// ---------------------------------------------------------------------------------------------------------------------

describe("labeled abilities and status cards (RRG 1.8 'Labeled Ability', 'Stun, Stunned', 'Confuse, Confused')", () => {
  it("Clawed Strike 51003 (Hero Action (attack)) played by a stunned hero: the whole ability is canceled, so no damage and no Special", () => {
    // Labeled Ability: "the entire ability (except for its costs) is canceled". Ruling Aug 13, 2026 (1): the event still counts as played.
    const claws = attachUpgrade(hero(), CLAWS);
    const stunned = withStatus(claws.state, identityOf(claws.state), "stunned");
    const r = cast(stunned, STRIKE, 2);
    expect(statuses(r.state, identityOf(r.state)).stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, claws.id).attachedTo).toBe(identityOf(r.state));
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });

  it("On the Prowl 51004 (Hero Action (thwart)) played by a confused hero: no threat removed and the Special does not resolve", () => {
    const claws = attachUpgrade(hero(), CLAWS);
    const confused = withStatus(claws.state, identityOf(claws.state), "confused");
    const r = cast(confused, PROWL, 2);
    expect(statuses(r.state, identityOf(r.state)).confused).toBe(0);
    expect(threat(r.state)).toBe(5);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
  });

  it("Wakanda Forever! 51005 with a stunned hero: Panther Claws' (attack) Special is canceled and uses up the stun, Kimoyo Beads' (thwart) Special still resolves", () => {
    // A Special with a parenthetical label is a labeled ability, so a stun card cancels it like any other attack.
    const beads = attachUpgrade(hero(), BEADS);
    const claws = attachUpgrade(beads.state, CLAWS);
    const stunned = withStatus(claws.state, identityOf(claws.state), "stunned");
    const r = cast(stunned, FOREVER, 1);
    expect(statuses(r.state, identityOf(r.state)).stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(threat(r.state)).toBe(4);
  });

  it("a stunned White Wolf (51037) that attacks is not considered to have attacked: no threat on the main scheme", () => {
    // 'Stun, Stunned': "that character is not considered to have attacked", so 'After White Wolf attacks' never fires.
    const wolf = putInPlay(withThreat(bpHeroGame({ swap: { "51006": "51037" } }), 5), "51037");
    const stunned = withStatus(wolf.state, wolf.id, "stunned");
    const r = scripted(stunned, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: wolf.id, targetInstanceId: villainOf(stunned) },
    ]);
    expect(statuses(r.state, wolf.id).stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(threat(r.state)).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// "Up to" and the owner's wave 3 Q16
// ---------------------------------------------------------------------------------------------------------------------

describe("Heart of the Panther 51025: 'up to 4 Black Panther upgrades'", () => {
  it("must choose at least 1 Special when one can resolve (owner decision wave 3 Q16, docs/phase7-wave9.md 3.36)", () => {
    // Q16: an effect's "up to N" chooses at least one when possible, unless a printed "may" makes it optional.
    const base = withForm(tchallaGame(), { heroForm: 0 });
    const beads = attachUpgrade(base, BEADS);
    const claws = attachUpgrade(beads.state, CLAWS);
    const r = cast(claws.state, HEART, 2, { target: [] });
    const specials = r.history.filter((h) => h.kind === "chooseCards").at(-1)!;
    expect(specials.ids).toEqual(expect.arrayContaining([beads.id, claws.id]));
    expect(r.mins["chooseCards"]).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T'Challa's Shadow 51031
// ---------------------------------------------------------------------------------------------------------------------

describe("T'Challa's Shadow 51031 (Uses 4 doubt, Victory 0)", () => {
  it("the last doubt counter removed discards the card to the victory display (RRG 'Uses (X Type)', 'Victory X'), and the cost increase ends", () => {
    // Uses: "When the last all-purpose counter is removed from a card with uses, discard that card"; Victory X: such a card
    // goes to the victory display instead of the discard pile. Nothing in the card's own text adds to this, so it is the keyword.
    const shadow = withShadow(hero(), 1);
    const r = scripted(shadow.state, [basicThwart(shadow.state)]);
    expect(playerOf(r.state, P1).playArea).not.toContain(shadow.id);
    expect(r.state.victoryDisplay).toContain(shadow.id);
    expect(Object.values(r.state.encounterDecks).flatMap((d) => d.discard)).not.toContain(shadow.id);
  });

  it("On the Prowl 51004 (a (thwart) event) counts as 'you thwart': one doubt counter comes off (RRG 'Labeled Ability')", () => {
    const shadow = withShadow(hero());
    // Cost 2 plus 1 from the Shadow.
    const r = cast(shadow.state, PROWL, 3);
    expect(threat(r.state)).toBe(2);
    expect(inst(r.state, shadow.id).counters["doubt"]).toBe(3);
  });

  it("a stunned hero's basic attack is replaced by clearing the stun and is not an attack: the counter stays (RRG 'Stun, Stunned')", () => {
    const shadow = withShadow(hero());
    const stunned = withStatus(shadow.state, identityOf(shadow.state), "stunned");
    const r = scripted(stunned, [basicAttack(stunned, villainOf(stunned))]);
    expect(statuses(r.state, identityOf(r.state)).stunned).toBe(0);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, shadow.id).counters["doubt"]).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The upgrades' discard options
// ---------------------------------------------------------------------------------------------------------------------

describe("upgrade Specials", () => {
  it("Spider Bites 51012 names another player: the villain and only that player's minions take 1 and are stunned", () => {
    const base = withForm(tchallaGame(), { heroForm: 0 });
    const p1Minion = engaged(base, SHOCKER, "m1", P1);
    const both = engaged(p1Minion, SHOCKER, "m2", P2);
    const bites = attachUpgrade(both, BITES);
    const r = cast(bites.state, FOREVER, 1, { target: [P2], option: ["Discard Spider Bites"] });
    const m1 = "m1" as InstanceId;
    const m2 = "m2" as InstanceId;
    expect([damage(r.state, villainOf(r.state)), damage(r.state, m1), damage(r.state, m2)]).toEqual([1, 0, 1]);
    expect([
      statuses(r.state, villainOf(r.state)).stunned,
      statuses(r.state, m1).stunned,
      statuses(r.state, m2).stunned,
    ]).toEqual([1, 0, 1]);
    expect(inst(r.state, bites.id).attachedTo).toBeNull();
  });

  it("Vibranium Suit 51013 on a hero that already has a tough status card: still one (RRG 'Status Cards': at most one of each type)", () => {
    // 'Status Cards': "A character cannot have more than one status card of each type at a time." (The 'Tough' entry's
    // sentence about "multiple tough status cards" is the only text that suggests otherwise; it is not a rule that grants a second.)
    const suit = attachUpgrade(hero(), SUIT);
    const toughHero = withStatus(suit.state, identityOf(suit.state), "tough");
    const r = cast(toughHero, FOREVER, 1, { option: ["Discard Vibranium Suit"] });
    expect(inst(r.state, suit.id).attachedTo).toBeNull();
    expect(statuses(r.state, identityOf(r.state)).tough).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Queen Ramonda 51008
// ---------------------------------------------------------------------------------------------------------------------

describe("Queen Ramonda 51008: 'an alter-ego with the Wakanda trait'", () => {
  it("another player's T'Challa in hero form is not an alter-ego, so only Shuri is offered (RRG 'Alter-Ego, Alter-Ego Form')", () => {
    const base = withForm(tchallaGame(), { heroForm: 0 }, P2);
    const hurt = patchInstance(patchInstance(base, identityOf(base, P2), { damage: 3 }), identityOf(base), {
      damage: 3,
    });
    const ramonda = putInPlay(hurt, RAMONDA);
    const r = scripted(ramonda.state, [use(P1, ramonda.id, "51008.queen-ramonda-action")]);
    const asked = r.history.find((h) => h.kind === "chooseTarget");
    // With one valid target the prompt may be skipped; either way P2's hero-form identity takes no healing.
    if (asked) expect(asked.ids).not.toContain(identityOf(ramonda.state, P2));
    expect(damage(r.state, identityOf(r.state, P2))).toBe(3);
    expect(damage(r.state, identityOf(r.state))).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Raft 51018
// ---------------------------------------------------------------------------------------------------------------------

describe("The Raft 51018: 'tuck it under here from the encounter discard pile' is a cost", () => {
  it("today's behavior, pinned: the response is offered for a Victory minion that is in the victory display, and tucks nothing", () => {
    const raft = putInPlay(hero(), RAFT);
    const dying = patchInstance(engaged(raft.state, JOYSTICK, "joy"), "joy" as InstanceId, { damage: 16 });
    const r = scripted(dying, [basicAttack(dying, "joy" as InstanceId)], { accept: ["51018.the-raft-response"] });
    expect(r.state.victoryDisplay).toContain("joy");
    expect(r.taken()).toBe(1);
    expect(threat(r.state)).toBe(5);
  });
  it.fails("a minion with Victory (Joystick 51039) that leaves play goes to the victory display, so the tuck cannot be paid and the response is not offered", () => {
    // FINDING (low, documented in the script): no tuck cost exists in the engine, so the response is offered whenever a
    // minion leaves play and then does nothing; RRG 'Cost' (cost arrow) says an ability whose cost cannot be paid cannot be initiated.
    const raft = putInPlay(hero(), RAFT);
    const joystick = engaged(raft.state, JOYSTICK, "joy");
    const dying = patchInstance(joystick, "joy" as InstanceId, { damage: 16 });
    const r = scripted(dying, [basicAttack(dying, "joy" as InstanceId)], { accept: ["51018.the-raft-response"] });
    expect(r.state.victoryDisplay).toContain("joy");
    expect(r.taken()).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Target Spotter 51038 against Quickstrike
// ---------------------------------------------------------------------------------------------------------------------

describe("Target Spotter 51038 and Quickstrike", () => {
  it("a Quickstrike minion Spotted onto its user cannot attack: 'cannot activate' covers every attack (RRG 'Activation', 'Quickstrike')", () => {
    // Activation: "Whenever an enemy attacks or schemes, it is considered to have activated"; Quickstrike resolves as
    // "it attacks that player". FAQ 'Target Spotter (#38)' (RRG p. 65) sends the minion to the Spotter's player.
    const spotter = putInPlay(bpGame({ swap: { "51006": "51038" }, twoPlayers: true }), "51038");
    const armed = patchInstance(spotter.state, spotter.id, { counters: { target: 2 } });
    const heroes = withForm(withForm(armed, { heroForm: 0 }), { heroForm: 0 }, P2);
    const stacked = onlyDeck(heroes, BLANK, BLANK, FILLER_B, SHOCKER);
    const shocker = instancesOf(stacked, SHOCKER)[0]!;
    const staged = relabel(stacked, shocker, VULTURE);
    const r = scripted(
      staged,
      staged.players.map((p) => endTurn(p.playerId)),
      { accept: ["51038.target-spotter-interrupt"], times: 1 },
    );
    expect(r.taken()).toBe(1);
    expect(inst(r.state, shocker).engagedWith).toBe(P1);
    expect(attacksBy(r.state, r.events, VULTURE)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Scream 51035 and Extreme Risk 51042 as boost cards
// ---------------------------------------------------------------------------------------------------------------------

describe("boost abilities", () => {
  it("The Scream's boost: 'You are stunned' is the player's identity, not the ally that defended", () => {
    const ally = putInPlay(withForm(bpGame(), { heroForm: 0 }), T_CHALLA_ALLY);
    const stacked = onlyDeck(ally.state, BLANK, FILLER_A, FILLER_B);
    const top = piles0(stacked)[0]!;
    const staged = relabel(stacked, top, SCREAM);
    const r = driveEventsPicking(
      DEPS,
      staged,
      (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id] : firstLegal(s)),
      ...staged.players.map((p) => endTurn(p.playerId)),
    );
    const hit = types(r.events, "attackResolved").find((e) => e.enemyInstanceId === villainOf(r.state))!;
    expect(hit.targetInstanceId).toBe(ally.id);
    expect(statuses(r.state, identityOf(r.state)).stunned).toBe(1);
    expect(statuses(r.state, ally.id).stunned).toBe(0);
  });

  it("Extreme Risk's boost on a scheme activation (Shuri in alter-ego form): the extra boost card is flipped and counts", () => {
    // 'Boost, Boost Icon': the villain's activation uses every boost card given for it; Extreme Risk says "the activating enemy", scheme or attack alike.
    const alterEgo = withForm(bpGame(), "alterEgo");
    const stacked = onlyDeck(alterEgo, BLANK, ONE_ICON, FILLER_A);
    const top = piles0(stacked)[0]!;
    const staged = relabel(stacked, top, EXTREME_RISK);
    const before = threat(staged);
    const r = scripted(
      staged,
      staged.players.map((p) => endTurn(p.playerId)),
      { option: ["Give the activating enemy"] },
    );
    const scheme = types(r.events, "schemeResolved").find((e) => e.enemyInstanceId === villainOf(r.state))!;
    // Rhino SCH 1 + Extreme Risk's 2 icons + the extra card's 1 icon.
    expect([scheme.baseSch, scheme.boostIcons]).toEqual([1, 3]);
    expect(threat(r.state)).toBeGreaterThanOrEqual(before + 4);
  });
});

function piles0(s: GameState): readonly InstanceId[] {
  return s.encounterDecks[activeEncounterDeckId(s)]!.deck;
}
