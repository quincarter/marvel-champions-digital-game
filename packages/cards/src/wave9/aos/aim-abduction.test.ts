import { cardId } from "@mc/content";
import { applyCommand, cardsInPlay, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import {
  AUNT_MAY,
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  SPIDER_MAN,
  codeOf,
  attacksBy,
  dataOf,
  flippedBoosts,
  heroForm,
  inDiscard,
  inDiscardPile,
  inPlayCard,
  onlyDeck,
  picking,
  piles,
  revealedCodes,
  setKit,
  types,
} from "../testing.js";
import { BATROC } from "./batroc.js";
import { AIM_ABDUCTION, AIM_ABDUCTION_SKIPPED } from "./aim-abduction.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The A.I.M. Abduction set (50080 A.I.M. Abductor, 50081 Abduct Superhumans, 50082 Nabbed!), docs/phase7-wave9.md section
 * 3.20. Rhino (Core, standard) against a Spider-Man starter deck, the set's cards added to the encounter deck by hand.
 * Allies are relabeled deck cards put in a play area (surgery); an enemy attack on an ally is Batroc's Leaping Kick
 * (50096), a card of another set whose Hero text attacks the ally with the most remaining hit points, here as Rhino's
 * attack (its registry is merged in for that and for nothing else).
 */
const ABDUCTOR = "50080";
const SCHEME = "50081";
const NABBED = "50082";
const KICK = "50096";
const REFS = [
  "50080.when-revealed",
  "50081.abduct-superhumans-forced-interrupt",
  "50081.when-defeated",
  "50082.when-revealed",
];
/** Core allies with no ability that answers play, leaving play or damage: cost / hit points. */
const LUKE_CAGE = "01076"; // 4 / 5, Toughness
const VISION = "01068"; // 4 / 3
const BLACK_CAT = "01002"; // 2 / 2, answers only "after you play"
const MARIA_HILL = "01067"; // 2 / 2, answers only "after you play"
const ENERGY_DAGGERS = "01046"; // upgrade
const HULK = "01050"; // 2 / 5, "After Hulk attacks, discard the top card of your deck": a mental-only card discards Hulk
const CAPTIVE = "50091"; // Rescued Captive: cost dash (0), Victory -1
/** Core cards whose only printed resource is mental: discarded by Hulk's Forced Response they discard Hulk. */
const MENTAL_ONLY = CORE_CARDS.filter((c) => {
  const r = ("resourceIcons" in c ? c.resourceIcons : undefined) as Record<string, number> | undefined;
  return r !== undefined && (r.mental ?? 0) > 0 && !r.wild && !r.physical && !r.energy;
}).map((c) => c.id as string);

const { deps: DEPS, setupGame, villainPhase } = setKit("a.i.m._abduction", mergeRegistries(AIM_ABDUCTION, BATROC));
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const tokens = (s: GameState, id: InstanceId) => inst(s, id).counters.acceleration ?? 0;
const tuckedUnder = (s: GameState, id: InstanceId) => inst(s, id).tucked;
const relabel = (s: GameState, id: InstanceId, code: string) => patchInstance(s, id, { cardId: cardId(code) });
const inPlayArea = (s: GameState, id: InstanceId, p: PlayerId = P1) => playerOf(s, p).playArea.includes(id);

/** A deck card of `player` relabeled as `code`, in their play area under their control. */
function control(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  which = 0,
  change: { damage?: number; exhausted?: boolean } = {},
): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).deck[which]!;
  const relabeled = relabel(state, id, code);
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...relabeled.instances,
        [id]: { ...relabeled.instances[id]!, faceup: true, controllerId: player, ...change },
      },
    },
  };
}

/** Abduct Superhumans in the villain area as the engine puts it into play: 2 threat per player. */
function withScheme(state: GameState, threatOn = 2): { state: GameState; id: InstanceId } {
  return encounterCardInVillainArea(state, SCHEME, threatOn);
}

/** An encounter card relabeled as `code` (a Rhino attachment, `from`, in the deck becomes Leaping Kick). */
function relabeledEncounter(state: GameState, code: string, from = FILLER_B): GameState {
  const id = [...piles(state).deck, ...piles(state).discard].find((i) => codeOf(state, i) === from)!;
  return relabel(state, id, code);
}

/** Two players: Rhino's two attacks draw a boost card each, then the first player is dealt `first`, the second `second`. */
const bothDealt = (first: string, second: string): string[] => [FILLER_A, BLANK, first, second];

const patchPlayer = (s: GameState, player: PlayerId, change: Partial<ReturnType<typeof playerOf>>): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, ...change } : p)),
});
/** `top` on top of the player's deck. */
const onTop = (s: GameState, top: InstanceId, player: PlayerId = P1): GameState =>
  patchPlayer(s, player, { deck: [top, ...playerOf(s, player).deck.filter((i) => i !== top)] });
/** Hulk (in play, ready) makes an attack on the villain. */
const hulkAttacks = (s: GameState, hulk: InstanceId) =>
  ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: hulk,
    targetInstanceId: s.villains[0]!.instanceId,
  }) as const;
/** A mental-only card from the player's deck on top, and Hulk (already in play) attacks: Hulk discards himself. */
function hulkDiscardsHimself(state: GameState, hulk: InstanceId) {
  const top = playerOf(state, P1).deck.find((i) => MENTAL_ONLY.includes(codeOf(state, i)))!;
  const topped = onTop(state, top);
  return { top, ...driveEventsPicking(DEPS, topped, firstLegal, hulkAttacks(topped, hulk)) };
}

describe("registry", () => {
  it("registers the four refs of the three cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(AIM_ABDUCTION).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(AIM_ABDUCTION)) expect(validateDefinition(def), id).toEqual([]);
    expect(AIM_ABDUCTION_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs for the three cards", () => {
    const refs = [ABDUCTOR, SCHEME, NABBED].flatMap((code) =>
      abilityRefIds(AOS_CARDS.find((c) => (c.id as string) === code)!),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: 2 Abductors, 1 Abduct Superhumans and 2 Nabbed! are in the encounter deck", () => {
    const s = setupGame();
    const counts = [ABDUCTOR, SCHEME, NABBED].map((c) => piles(s).deck.filter((id) => codeOf(s, id) === c).length);
    expect(counts).toEqual([2, 1, 2]);
  });
});

describe("data", () => {
  it("A.I.M. Abductor: an A.I.M. minion, ATK 2, SCH 1, 4 hit points, 2 boost icons, no keywords and no icons", () => {
    const card = dataOf(ABDUCTOR);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.quantityInSet]).toEqual([
      "minion",
      2,
      1,
      4,
      2,
      2,
    ]);
    expect(card.traits).toEqual(["A.I.M."]);
    expect(card.keywords).toEqual([]);
    expect(card.schemeIcons).toBeUndefined();
  });

  it("Abduct Superhumans: a side scheme with 2 threat per player (none flat), no icons, 1 boost icon, Surge", () => {
    const card = dataOf(SCHEME);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.quantityInSet]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 2 },
      [],
      1,
      1,
    ]);
    expect(card.keywords).toEqual([{ name: "surge" }]);
    expect(card.traits).toEqual([]);
  });

  it("Nabbed!: a treachery with 1 boost icon, no stats, no keywords and no Boost ability", () => {
    const card = dataOf(NABBED);
    expect([card.type, card.boostIcons, card.keywords, card.quantityInSet]).toEqual(["treachery", 1, [], 2]);
    expect(abilityRefIds(AOS_CARDS.find((c) => (c.id as string) === NABBED)!)).toEqual(["50082.when-revealed"]);
  });
});

describe("Abduct Superhumans (50081)", () => {
  /** Rhino's activation, then Leaping Kick revealed: Rhino attacks the ally with the most remaining hit points. */
  function kicked(state: GameState) {
    const staged = relabeledEncounter(state, KICK);
    return villainPhase(staged, stackFor(state, KICK));
  }
  /** Rhino attacks every hero (one boost card each), then the first player is dealt `code`, whose attack draws `ONE_ICON`. */
  const stackFor = (state: GameState, code: string): string[] =>
    state.players.length === 1 ? [BLANK, code, ONE_ICON] : [FILLER_A, BLANK, code, ONE_ICON];
  /** A second round (Rhino attachments already used): the boost cards are the two copies of Charge, and Blank. */
  const stackAgain = (state: GameState): string[] =>
    state.players.length === 1 ? [CHARGE, KICK, BLANK] : [CHARGE, BLANK, KICK, CHARGE];

  it("surge: put into play by the reveal of nothing else, entering with 2 threat for one player", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, SCHEME, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([SCHEME, FILLER_A]);
    expect(threat(run.state, inPlayCard(run.state, SCHEME)!)).toBe(2);
  });

  it("an ally (cost 2, 2 hit points) defeated by an enemy attack ends tucked under it: threat 2 + 2, 1 acceleration token", () => {
    const base = withScheme(control(heroForm(setupGame()), BLACK_CAT).state);
    const cat = playerOf(base.state, P1).playArea.find((i) => codeOf(base.state, i) === BLACK_CAT)!;
    const { state, events } = kicked(base.state);
    expect(tuckedUnder(state, base.id)).toEqual([cat]);
    expect(inPlayArea(state, cat)).toBe(false);
    expect(inDiscard(state, BLACK_CAT)).toEqual([]);
    expect(playerOf(state, P1).discard).not.toContain(cat);
    expect(threat(state, base.id)).toBe(4);
    expect(tokens(state, base.id)).toBe(1);
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([cat]);
  });

  it("an ally discarded by the player's own card (Hulk's Forced Response, a mental card discarded) is tucked, not discarded", () => {
    const { state: a, id: hulk } = control(heroForm(setupGame()), HULK);
    const base = withScheme(a);
    const { top, ...run } = hulkDiscardsHimself(base.state, hulk);
    expect(tuckedUnder(run.state, base.id)).toEqual([hulk]);
    expect(playerOf(run.state, P1).discard).not.toContain(hulk);
    expect(playerOf(run.state, P1).discard).toContain(top);
    // Hulk costs 2.
    expect(threat(run.state, base.id)).toBe(4);
    expect(tokens(run.state, base.id)).toBe(1);
  });

  it("two allies, two enemy attacks (Vision, cost 4; then Black Cat, cost 2): both tucked, threat 2 + 4 + 2, 2 tokens", () => {
    const withVision = control(heroForm(setupGame()), VISION);
    const withCat = control(withVision.state, BLACK_CAT);
    const base = withScheme(withCat.state);
    // Vision (3 hit points) is the most remaining: Rhino's 2 + 1 boost defeats it. Black Cat is next.
    const first = kicked(base.state);
    expect(tuckedUnder(first.state, base.id)).toEqual([withVision.id]);
    expect(threat(first.state, base.id)).toBe(6);
    const second = villainPhase(relabeledEncounter(first.state, KICK, FILLER_A), stackAgain(first.state));
    expect([...tuckedUnder(second.state, base.id)].sort()).toEqual([withVision.id, withCat.id].sort());
    expect(threat(second.state, base.id)).toBe(8);
    expect(tokens(second.state, base.id)).toBe(2);
  });

  it("another player's ally in a two-player game: tucked from its controller's area, the threat is its cost (2)", () => {
    const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const theirs = control(two, BLACK_CAT, P2);
    const base = withScheme(theirs.state, 4);
    const { state } = kicked(base.state);
    expect(tuckedUnder(state, base.id)).toEqual([theirs.id]);
    expect(inPlayArea(state, theirs.id, P2)).toBe(false);
    expect(playerOf(state, P2).discard).not.toContain(theirs.id);
    expect(threat(state, base.id)).toBe(6);
    expect(tokens(state, base.id)).toBe(1);
  });

  it("an ally with an upgrade attached: the upgrade is discarded to its owner's discard pile as the ally leaves, the ally is tucked", () => {
    const withCat = control(heroForm(setupGame()), BLACK_CAT);
    const withDaggers = control(withCat.state, ENERGY_DAGGERS);
    const attached = patchInstance(
      patchInstance(withDaggers.state, withDaggers.id, { attachedTo: withCat.id }),
      withCat.id,
      { attachments: [withDaggers.id] },
    );
    const noArea = patchPlayer(attached, P1, {
      playArea: playerOf(attached, P1).playArea.filter((i) => i !== withDaggers.id),
    });
    const base = withScheme(noArea);
    const { state } = kicked(base.state);
    expect(tuckedUnder(state, base.id)).toEqual([withCat.id]);
    expect(playerOf(state, P1).discard).toContain(withDaggers.id);
    expect(inst(state, withDaggers.id).attachedTo).toBeNull();
    expect(inst(state, withCat.id).attachments).toEqual([]);
  });

  it("an ally that is not tucked (Rescued Captive, Victory -1) goes to the victory display: no tuck and no token, its cost (0) adds no threat", () => {
    const withCaptive = control(heroForm(setupGame()), CAPTIVE, P1, 0, { damage: 4 });
    const base = withScheme(withCaptive.state);
    const { state } = kicked(base.state);
    expect(state.victoryDisplay).toContain(withCaptive.id);
    expect(tuckedUnder(state, base.id)).toEqual([]);
    expect(threat(state, base.id)).toBe(2);
    expect(tokens(state, base.id)).toBe(0);
  });

  describe("When Defeated", () => {
    /** The first player's hero thwarts `scheme` (1 threat left) and takes the last threat off. */
    function defeat(state: GameState, scheme: InstanceId, player: PlayerId = P1) {
      const near = patchInstance(state, scheme, { threat: 1 });
      return driveEventsPicking(DEPS, near, firstLegal, {
        type: "basicThwart",
        playerId: player,
        thwarterInstanceId: identityOf(near, player),
        schemeInstanceId: scheme,
      });
    }

    it("each tucked ally enters play ready and undamaged under its owner's control; the scheme is discarded", () => {
      const { state: a, id: hulk } = control(heroForm(setupGame()), HULK, P1, 0, { damage: 1 });
      const base = withScheme(a);
      const tucked = hulkDiscardsHimself(base.state, hulk);
      expect(tuckedUnder(tucked.state, base.id)).toEqual([hulk]);
      const run = defeat(tucked.state, base.id);
      expect(tuckedUnder(run.state, base.id)).toEqual([]);
      expect(inPlayArea(run.state, hulk)).toBe(true);
      expect(inst(run.state, hulk)).toMatchObject({ damage: 0, exhausted: false, controllerId: P1, faceup: true });
      expect(cardsInPlay(run.state)).not.toContain(base.id);
      expect(inDiscard(run.state, SCHEME)).toEqual([base.id]);
    });

    it("two tucked allies of two owners (player 1's Hulk discarded by his own card, player 2's Black Cat defeated by an attack) each return to their own play area", () => {
      const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
      const mine = control(two, HULK, P1);
      const theirs = control(mine.state, BLACK_CAT, P2);
      const base = withScheme(theirs.state, 4);
      const first = hulkDiscardsHimself(base.state, mine.id);
      const second = kicked(first.state);
      expect([...tuckedUnder(second.state, base.id)].sort()).toEqual([mine.id, theirs.id].sort());
      const run = defeat(second.state, base.id, P2);
      expect(inPlayArea(run.state, mine.id, P1)).toBe(true);
      expect(inPlayArea(run.state, theirs.id, P2)).toBe(true);
      expect(inst(run.state, theirs.id)).toMatchObject({ controllerId: P2, exhausted: false, damage: 0 });
      expect(inst(run.state, mine.id)).toMatchObject({ controllerId: P1, exhausted: false, damage: 0 });
    });

    it("the ally limit applies: a fourth ally returning to a player with three in play asks that player to discard one", () => {
      const { state: a, id: hulk } = control(heroForm(setupGame()), HULK);
      const base = withScheme(a);
      let s = hulkDiscardsHimself(base.state, hulk).state;
      const others: InstanceId[] = [];
      for (const code of [VISION, BLACK_CAT, MARIA_HILL]) {
        const c = control(s, code);
        s = c.state;
        others.push(c.id);
      }
      const near = patchInstance(s, base.id, { threat: 1 });
      const thwart = applyCommand(
        near,
        {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: identityOf(near, P1),
          schemeInstanceId: base.id,
        },
        DEPS,
      );
      if (!thwart.ok) throw new Error(thwart.error.message);
      const choice = thwart.state.pendingChoice!;
      expect(choice).toMatchObject({ playerId: P1, prompt: { kind: "discardOverAllyLimit", limit: 3 } });
      expect(choice.options.map((o) => o.optionId).sort()).toEqual([hulk, ...others].sort());
      expect(inPlayArea(thwart.state, hulk)).toBe(true);
      expect(tuckedUnder(thwart.state, base.id)).toEqual([]);
    });

    // Answering that prompt does not finish: the discarded ally leaves play while Abduct Superhumans (defeated, still in
    // play until its When Defeated has resolved) answers with its Forced Interrupt, and the ally limit is asked again
    // with the card still counted. See the report; the follow-up belongs to the engine.
    it.todo(
      "discarding down to the ally limit with Abduct Superhumans in play resolves (engine: the limit prompt repeats)",
    );
  });
});

describe("A.I.M. Abductor (50080)", () => {
  const abductor = (s: GameState) => inPlayCard(s, ABDUCTOR)!;

  it("tucks the ally with the most remaining hit points (Vision 3 beats a Luke Cage with 3 damage on 5, 2 left): threat 2 + 4, 1 token, and no 2 threat", () => {
    const luke = control(heroForm(setupGame()), LUKE_CAGE, P1, 0, { damage: 3 });
    const vision = control(luke.state, VISION);
    const base = withScheme(vision.state);
    const run = villainPhase(base.state, [BLANK, ABDUCTOR, FILLER_A]);
    expect(tuckedUnder(run.state, base.id)).toEqual([vision.id]);
    expect(inPlayArea(run.state, luke.id)).toBe(true);
    expect(threat(run.state, base.id)).toBe(6);
    expect(tokens(run.state, base.id)).toBe(1);
    // The Abductor stays in play, engaged with the player who revealed it.
    expect(inst(run.state, abductor(run.state)).engagedWith).toBe(P1);
    // Tucked by the interrupt of the scheme, not discarded: it never reached the discard pile.
    expect(playerOf(run.state, P1).discard).not.toContain(vision.id);
  });

  it("a tie for the most remaining hit points: the player picks which ally is tucked, the prompt offers exactly the tied allies", () => {
    const cat = control(heroForm(setupGame()), BLACK_CAT);
    const maria = control(cat.state, MARIA_HILL);
    const vision = control(maria.state, VISION, P1, 0, { damage: 1 });
    const base = withScheme(vision.state);
    const offered: InstanceId[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseTarget" || choice.prompt.slot !== "victim") return firstLegal(s);
      offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : [])));
      return picking(maria.id)(s);
    };
    const run = villainPhase(base.state, [BLANK, ABDUCTOR, FILLER_A], pick);
    expect(offered).toHaveLength(1);
    expect([...offered[0]!].sort()).toEqual([cat.id, maria.id, vision.id].sort());
    expect(tuckedUnder(run.state, base.id)).toEqual([maria.id]);
    expect(inPlayArea(run.state, cat.id)).toBe(true);
    expect(threat(run.state, base.id)).toBe(4);
  });

  it("with no ally under your control: 2 threat on Abduct Superhumans, no token", () => {
    const base = withScheme(heroForm(setupGame()));
    const run = villainPhase(base.state, [BLANK, ABDUCTOR, FILLER_A]);
    expect(threat(run.state, base.id)).toBe(4);
    expect(tokens(run.state, base.id)).toBe(0);
    expect(tuckedUnder(run.state, base.id)).toEqual([]);
  });

  it("another player's ally does not count as one you control: the revealing player has none, so 2 threat; the ally stays", () => {
    const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const theirs = control(two, VISION, P2);
    const base = withScheme(theirs.state, 4);
    const run = villainPhase(base.state, bothDealt(ABDUCTOR, CHARGE));
    expect(tuckedUnder(run.state, base.id)).toEqual([]);
    expect(threat(run.state, base.id)).toBe(6);
    expect(inPlayArea(run.state, theirs.id, P2)).toBe(true);
  });

  it("revealed to the player who controls the ally (player 2): their ally is tucked from their area, and only theirs", () => {
    const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const mine = control(two, LUKE_CAGE, P1);
    const theirs = control(mine.state, BLACK_CAT, P2);
    const base = withScheme(theirs.state, 4);
    const run = villainPhase(base.state, bothDealt(CHARGE, ABDUCTOR));
    expect(inst(run.state, abductor(run.state)).engagedWith).toBe(P2);
    expect(tuckedUnder(run.state, base.id)).toEqual([theirs.id]);
    expect(inPlayArea(run.state, mine.id, P1)).toBe(true);
    expect(threat(run.state, base.id)).toBe(6);
  });

  it("Abduct Superhumans not in play, an ally in play: it is found in the deck and put into play (2 threat for one player, no surge), then the ally is tucked under it", () => {
    const cat = control(heroForm(setupGame()), BLACK_CAT);
    const run = villainPhase(onlyDeck(cat.state, BLANK, ABDUCTOR, SCHEME), []);
    const scheme = inPlayCard(run.state, SCHEME)!;
    expect(tuckedUnder(run.state, scheme)).toEqual([cat.id]);
    expect(threat(run.state, scheme)).toBe(4);
    expect(tokens(run.state, scheme)).toBe(1);
    expect(piles(run.state).deck.map((id) => codeOf(run.state, id))).not.toContain(SCHEME);
    // Found, not revealed: only the Abductor was revealed.
    expect(revealedCodes(run.state, run.events)).toEqual([ABDUCTOR]);
  });

  it("Abduct Superhumans not in play and no ally: found in the encounter discard pile, 2 + 2 threat, no token", () => {
    const state = inDiscardPile(heroForm(setupGame()), SCHEME);
    const run = villainPhase(state, [BLANK, ABDUCTOR, FILLER_A]);
    const scheme = inPlayCard(run.state, SCHEME)!;
    expect(threat(run.state, scheme)).toBe(4);
    expect(tokens(run.state, scheme)).toBe(0);
    expect(inDiscard(run.state, SCHEME)).toEqual([]);
  });

  it("found in a two-player game it enters with 4 threat (2 per player)", () => {
    const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const run = villainPhase(onlyDeck(two, FILLER_A, BLANK, ABDUCTOR, CHARGE, SCHEME), []);
    expect(threat(run.state, inPlayCard(run.state, SCHEME)!)).toBe(6);
  });

  it("is data-driven by the scheme's own interrupt: the Abductor places no threat of its own for the tuck", () => {
    const cat = control(heroForm(setupGame()), BLACK_CAT);
    const base = withScheme(cat.state);
    const run = villainPhase(base.state, [BLANK, ABDUCTOR, FILLER_A]);
    expect(types(run.events, "threatPlaced").filter((e) => e.schemeInstanceId === base.id)).toHaveLength(1);
  });
});

describe("Nabbed! (50082)", () => {
  const MOCKINGBIRD = "01083"; // cost 3

  it("with the scheme in play: discards from the top until an ally (Aunt May, then Mockingbird), tucks it: threat +3, 1 token", () => {
    const base = withScheme(heroForm(setupGame()));
    const { state, ids } = putOnTopOfDeck(base.state, P1, AUNT_MAY, MOCKINGBIRD);
    const run = villainPhase(state, [BLANK, NABBED, FILLER_A]);
    const [may, bird] = ids as [InstanceId, InstanceId];
    expect(playerOf(run.state, P1).discard).toContain(may);
    expect(playerOf(run.state, P1).discard).not.toContain(bird);
    expect(tuckedUnder(run.state, base.id)).toEqual([bird]);
    expect(threat(run.state, base.id)).toBe(5);
    expect(tokens(run.state, base.id)).toBe(1);
    // A single placement: the ally never was in play, so the scheme's Forced Interrupt did not answer.
    expect(types(run.events, "threatPlaced").filter((e) => e.schemeInstanceId === base.id)).toHaveLength(1);
  });

  it("an ally already on top of the deck: only it is discarded", () => {
    const base = withScheme(heroForm(setupGame()));
    const { state, ids } = putOnTopOfDeck(base.state, P1, BLACK_CAT);
    // The same phase without Nabbed! leaves what the round itself puts in the discard pile (an end-of-turn discard).
    const control_ = villainPhase(state, [BLANK, FILLER_A, FILLER_B]);
    const before = playerOf(control_.state, P1).discard;
    const run = villainPhase(state, [BLANK, NABBED, FILLER_A]);
    expect(tuckedUnder(run.state, base.id)).toEqual(ids);
    expect(playerOf(run.state, P1).discard).toEqual(before);
    expect(threat(run.state, base.id)).toBe(4);
  });

  it("with the scheme not in play: found and put into play first (2 threat), then the ally is tucked and the threat added", () => {
    const { state } = putOnTopOfDeck(heroForm(setupGame()), P1, AUNT_MAY, MOCKINGBIRD);
    const run = villainPhase(onlyDeck(state, BLANK, NABBED, SCHEME), []);
    const scheme = inPlayCard(run.state, SCHEME)!;
    expect(tuckedUnder(run.state, scheme)).toHaveLength(1);
    expect(threat(run.state, scheme)).toBe(5);
    expect(tokens(run.state, scheme)).toBe(1);
  });

  it("revealed to player 2 it uses player 2's deck, and the tucked ally keeps its owner", () => {
    const two = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const base = withScheme(two, 4);
    const ally = playerOf(base.state, P2).deck[0]!;
    const staged = relabel(base.state, ally, MARIA_HILL);
    const run = villainPhase(staged, bothDealt(CHARGE, NABBED));
    expect(playerOf(run.state, P2).discard).not.toContain(ally);
    expect(tuckedUnder(run.state, base.id)).toEqual([ally]);
    expect(threat(run.state, base.id)).toBe(6);
  });

  it("no ally in the deck (and none left to find): nothing is tucked, no threat from it, the acceleration token is still placed", () => {
    const base = withScheme(heroForm(setupGame()));
    const noAllies = playerOf(base.state, P1).deck.reduce(
      (s, id) =>
        CORE_CARDS.some((c) => (c.id as string) === codeOf(s, id) && c.type === "ally") ? relabel(s, id, AUNT_MAY) : s,
      base.state,
    );
    const run = villainPhase(noAllies, [BLANK, NABBED, FILLER_A]);
    // The whole deck was discarded (the player deck then resets, RRG 1.8 "Player Deck"), no ally among it.
    expect(tuckedUnder(run.state, base.id)).toEqual([]);
    expect(threat(run.state, base.id)).toBe(2);
    expect(tokens(run.state, base.id)).toBe(1);
  });

  it("boost: 1 icon and nothing else (Rhino's attack gains 1 damage)", () => {
    const base = heroForm(setupGame());
    const control_ = villainPhase(base, [BLANK, FILLER_A]);
    const boosted = villainPhase(base, [NABBED, FILLER_A]);
    expect(flippedBoosts(boosted.events)).toHaveLength(1);
    const rhino = codeOf(base, base.villains[0]!.instanceId);
    const damage = (r: typeof boosted) => attacksBy(r.state, r.events, rhino)[0]!.damageDealt;
    expect(damage(boosted) - damage(control_)).toBe(1);
  });
});

describe("boost icons", () => {
  it.each([
    [ABDUCTOR, 2],
    [SCHEME, 1],
  ])("%s as a boost card adds %i to the attack and nothing else", (code, icons) => {
    const base = heroForm(setupGame());
    const control_ = villainPhase(base, [BLANK, FILLER_A]);
    const run = villainPhase(base, [code, FILLER_A]);
    const rhino = codeOf(base, base.villains[0]!.instanceId);
    const damage = (r: typeof run) => attacksBy(r.state, r.events, rhino)[0]!.damageDealt;
    expect(damage(run) - damage(control_)).toBe(icons);
    expect(inPlayCard(run.state, SCHEME)).toBeUndefined();
  });
});
