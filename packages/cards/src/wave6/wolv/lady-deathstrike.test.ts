import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { LADY_DEATHSTRIKE_ABILITIES } from "./lady-deathstrike.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { handForMixedCost, inPlay } from "../mut_gen/sabretooth-testing.js";

const LADY = "35034";
const SEEKING = "35035";
const UPGRADES = "35036";
const HACK = "35037";
/** Zero-boost-icon fillers: the villain's boost card, then whatever the encounter step reveals. */
/** Medical Emergency: a side scheme that does nothing when revealed, a safe card for the encounter step to reveal. */
const INERT = "32071";
const FILLER = "01186";
const NO_BOOST = "01187";
/** Zero-boost-icon cards, each code twice over, to stand where the test cares about nothing but the position. */
const FILLERS = [FILLER, NO_BOOST, FILLER, NO_BOOST, FILLER, NO_BOOST] as const;

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const villainId = (state: GameState): InstanceId => activeVillain(state).instanceId;
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;

/** A Sabretooth game with the Lady Deathstrike set as its modular, Core hero, past setup. */
function deathstrikeGame(options: { seed?: number } = {}): GameState {
  const config = wave6Scenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: options.seed ?? 1,
    modularSetIds: ["deathstrike"],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
const heroGame = () => run(deathstrikeGame(), toHero(P1));
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });
const toughHero = (state: GameState) => {
  const me = identityOf(state, P1);
  return patchInstance(state, me, { statuses: { ...inst(state, me).statuses, tough: 1 } });
};
/**
 * Ends P1's turn. The encounter cards come off the top in order: the villain's boost card (a minion's activation draws
 * none here), the card Sabretooth's own Forced Response discards, then `reveal`, the card dealt to P1.
 */
const villainPhase = (state: GameState, reveal: string) =>
  driveEvents(WAVE6_DEPS, stackEncounterDeck(state, ...FILLERS.slice(0, 2), reveal), { type: "endTurn", playerId: P1 });
/** Cards that left P1's hand for their discard pile in these events, however they were discarded. */
const handDiscards = (events: readonly GameEvent[]): InstanceId[] =>
  of(events, "cardMoved")
    .filter((e) => e.from.kind === "hand" && e.to.kind === "discard")
    .map((e) => e.instanceId);
/** P1 holds 4 cards, so the end-of-turn refill to 5 never needs the hand-size discard. */
const lightHand = (state: GameState): GameState => withHand(state, handOf(state).slice(0, 4));
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "attackResolved").filter((e) => e.enemyInstanceId === id);
const handOf = (state: GameState) => playerOf(state, P1).hand;
/** The printed resource icons on a card, read from the card data. */
const printedResources = (state: GameState, id: InstanceId): number => {
  const card = state.cardPool[state.instances[id]!.cardId]!;
  // A resource card prints its icons as `producesIcons`; every other player card as `resourceIcons`.
  const icons = "resourceIcons" in card ? card.resourceIcons : "producesIcons" in card ? card.producesIcons : undefined;
  return Object.values(icons ?? {}).reduce((sum: number, n) => sum + (n ?? 0), 0);
};
/** Replaces P1's hand with exactly these instances. */
const withHand = (state: GameState, hand: readonly InstanceId[]): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1
      ? {
          ...p,
          hand: [...hand],
          deck: [...p.deck.filter((i) => !hand.includes(i)), ...p.hand.filter((i) => !hand.includes(i))],
        }
      : p,
  ),
});
describe("registry", () => {
  it("registers every ability ref the card data names for the set", () => {
    expect(Object.keys(LADY_DEATHSTRIKE_ABILITIES).sort()).toEqual(
      [
        "35034.lady-deathstrike-forced-response",
        "35035.when-revealed",
        "35036.adamantium-upgrades-constant",
        "35036.adamantium-upgrades-constant-2",
        "35036.adamantium-upgrades-action",
        "35037.when-revealed",
        "35037.boost",
      ].sort(),
    );
  });

  it("every script validates", () => {
    for (const definition of Object.values(LADY_DEATHSTRIKE_ABILITIES))
      expect(validateDefinition(definition)).toEqual([]);
  });

  it("the set's four cards are in the Sabretooth game from data", () => {
    const state = deathstrikeGame();
    const pile = Object.values(state.encounterDecks).flatMap((d) => [...d.deck, ...d.discard]);
    const codes = pile.map((i) => codeOf(state, i));
    for (const code of [LADY, SEEKING, UPGRADES, HACK]) expect(codes, code).toContain(code);
    expect(codes.filter((c) => c === UPGRADES)).toHaveLength(2);
    expect(codes.filter((c) => c === HACK)).toHaveLength(2);
  });
});

describe("Lady Deathstrike (35034)", () => {
  const stage = () => {
    const { state, id: lady } = engageMinion(lightHand(heroGame()), LADY, P1);
    return { state: bare(state, villainId(state)), lady };
  };

  it("Forced Response: after she attacks and damages your hero, you discard 1 random card from your hand", () => {
    const { state: base, lady } = stage();
    const { state, events } = villainPhase(base, INERT);
    expect(attacksBy(events, lady)).toHaveLength(1);
    expect(attacksBy(events, lady)[0]!.damageDealt).toBeGreaterThan(0);
    expect(resolved(events).filter((a) => a === "35034.lady-deathstrike-forced-response")).toHaveLength(1);
    // Sabretooth attacked and damaged too, but only Lady Deathstrike's attack makes you discard.
    expect(attacksBy(events, villainId(base)).length).toBeGreaterThan(0);
    const discarded = handDiscards(events);
    expect(discarded).toHaveLength(1);
    expect(playerOf(state, P1).discard).toContain(discarded[0]);
    expect(handOf(state)).not.toContain(discarded[0]);
  });

  it("the discard is random: another seed discards another card", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { state: staged } = engageMinion(lightHand(run(deathstrikeGame({ seed }), toHero(P1))), LADY, P1);
      const { events } = villainPhase(bare(staged, villainId(staged)), INERT);
      const [id] = handDiscards(events);
      expect(id).toBeDefined();
      seen.add(codeOf(staged, id!));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("without her in play, the villain's own damaging attack makes nobody discard", () => {
    const base = bare(lightHand(heroGame()), villainId(heroGame()));
    const { events } = villainPhase(base, INERT);
    expect(attacksBy(events, villainId(base)).length).toBeGreaterThan(0);
    expect(handDiscards(events)).toHaveLength(0);
    expect(resolved(events)).not.toContain("35034.lady-deathstrike-forced-response");
  });

  it("no discard when her attack deals no damage (a tough status absorbs it)", () => {
    const { state: staged, lady } = stage();
    // The villain is stunned so it does not use up the tough status first.
    const stunned = patchInstance(staged, villainId(staged), {
      statuses: { ...inst(staged, villainId(staged)).statuses, stunned: 1 },
    });
    const base = toughHero(stunned);
    const me = identityOf(base, P1);
    const { state, events } = villainPhase(base, INERT);
    expect(attacksBy(events, lady)).toHaveLength(1);
    expect(inst(state, me).damage).toBe(inst(base, me).damage);
    expect(inst(state, me).statuses.tough).toBe(0);
    expect(handDiscards(events)).toHaveLength(0);
    expect(resolved(events)).not.toContain("35034.lady-deathstrike-forced-response");
  });

  it("only the owner of the character she damaged discards (she is engaged with the second player)", () => {
    const config = wave6Scenario("sabretooth", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 1,
      modularSetIds: ["deathstrike"],
    });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    let state = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE6_DEPS);
    state = run(state, toHero(P1), { type: "endTurn", playerId: P1 }, toHero(P2));
    const { state: staged, id: lady } = engageMinion(state, LADY, P2);
    const lit = {
      ...staged,
      players: staged.players.map((p) => ({ ...p, hand: p.hand.slice(0, 4) })),
    };
    const { events } = driveEvents(WAVE6_DEPS, stackEncounterDeck(bare(lit, villainId(lit)), ...FILLERS.slice(0, 4)), {
      type: "endTurn",
      playerId: P2,
    });
    expect(attacksBy(events, lady)).toHaveLength(1);
    const moved = of(events, "cardMoved").filter((e) => e.from.kind === "hand" && e.to.kind === "discard");
    expect(moved.map((e) => (e.from.kind === "hand" ? e.from.playerId : null))).toEqual([P2]);
  });
});

describe("Seeking Vengeance (35035)", () => {
  const hero = () => bare(lightHand(heroGame()), villainId(heroGame()));
  const ladyInPlay = (state: GameState) => inPlay(state, LADY)[0];

  it("When Revealed, with Lady Deathstrike in the encounter deck: puts her into play engaged with you and shuffles", () => {
    const base = hero();
    expect(ladyInPlay(base)).toBeUndefined();
    const { state, events } = villainPhase(base, SEEKING);
    const lady = ladyInPlay(state)!;
    expect(lady).toBeDefined();
    expect(inst(state, lady).engagedWith).toBe(P1);
    expect(inPlay(state, SEEKING)).toHaveLength(1);
    expect(resolved(events)).toContain("35035.when-revealed");
    // She engages you as she enters play, so Quickstrike (data) has her attack at once and her Forced Response follows.
    expect(attacksBy(events, lady)).toHaveLength(1);
    expect(resolved(events)).toContain("35034.lady-deathstrike-forced-response");
    expect(of(events, "deckShuffled").length).toBeGreaterThan(0);
  });

  it("When Revealed, with Lady Deathstrike in the encounter discard pile: finds her there", () => {
    const base = hero();
    const [lady] = Object.values(base.encounterDecks)
      .flatMap((d) => d.deck)
      .filter((i) => codeOf(base, i) === LADY);
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const pile = base.encounterDecks[deckId]!;
    const staged = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== lady), discard: [...pile.discard, lady!] },
      },
    };
    const { state } = villainPhase(staged, SEEKING);
    expect(ladyInPlay(state)).toBe(lady);
    expect(inst(state, lady!).engagedWith).toBe(P1);
  });

  it("When Revealed, with her already in play: she activates against you (an attack in hero form), and she is not fetched again", () => {
    const { state: staged, id: lady } = engageMinion(hero(), LADY, P1);
    const { state, events } = villainPhase(staged, SEEKING);
    // Her own activation, then the one Seeking Vengeance gives her.
    expect(attacksBy(events, lady)).toHaveLength(2);
    expect(inPlay(state, LADY)).toEqual([lady]);
    expect(inPlay(state, SEEKING)).toHaveLength(1);
  });

  it("against a player in alter-ego form she schemes instead", () => {
    const { state: staged, id: lady } = engageMinion(lightHand(deathstrikeGame()), LADY, P1);
    const { events } = villainPhase(staged, SEEKING);
    expect(of(events, "schemeResolved").filter((e) => e.enemyInstanceId === lady)).toHaveLength(2);
    expect(attacksBy(events, lady)).toHaveLength(0);
  });

  it("is a side scheme with 5 threat (no per-hero scaling), which is card data", () => {
    const { state } = villainPhase(hero(), SEEKING);
    expect(inst(state, inPlay(state, SEEKING)[0]!).threat).toBe(5);
  });
});

describe("Adamantium Upgrades (35036)", () => {
  const hero = () => bare(lightHand(heroGame()), villainId(heroGame()));

  it("When Revealed: attaches to an enemy without a copy, +2 ATK to it", () => {
    const base = hero();
    const v = villainId(base);
    const atk = profile(base, v).atk;
    const { state } = villainPhase(base, UPGRADES);
    const [card] = inPlay(state, UPGRADES);
    expect(card).toBeDefined();
    expect(inst(state, card!).attachedTo).toBe(v);
    expect(profile(state, v).atk).toBe(atk + 2);
  });

  it("the second copy attaches to a different enemy while one lacks a copy", () => {
    const { state: staged, id: lady } = engageMinion(hero(), LADY, P1);
    const { id: first, state: armed } = attachToHost(staged, UPGRADES, villainId(staged));
    const { state } = villainPhase(armed, UPGRADES);
    const second = inPlay(state, UPGRADES).find((i) => i !== first)!;
    expect(inst(state, second).attachedTo).toBe(lady);
  });

  it("with every enemy already carrying a copy, this card gains surge", () => {
    const base = hero();
    const { state: armed } = attachToHost(base, UPGRADES, villainId(base));
    const { events } = villainPhase(armed, UPGRADES);
    expect(of(events, "surgeTriggered").length).toBeGreaterThan(0);
    expect(inPlay(armed, UPGRADES)).toHaveLength(1);
  });

  it("negative: the first copy onto a lone enemy does not gain surge", () => {
    const { events } = villainPhase(hero(), UPGRADES);
    expect(of(events, "surgeTriggered")).toHaveLength(0);
  });

  it("[star]: attached enemy's attacks gain piercing (the damage lands through a tough status); other enemies' do not", () => {
    const { state: staged, id: lady } = engageMinion(hero(), LADY, P1);
    const stun = (s: GameState, id: InstanceId) =>
      patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
    const me = identityOf(staged, P1);
    const v = villainId(staged);
    // Without the card, Lady's attack is absorbed by the tough status, which is discarded.
    const plain = villainPhase(toughHero(stun(staged, v)), INERT);
    expect(attacksBy(plain.events, lady)).toHaveLength(1);
    expect(inst(plain.state, me).statuses.tough).toBe(0);
    expect(inst(plain.state, me).damage).toBe(inst(staged, me).damage);
    // With the card attached to her: piercing, so the tough status is discarded and the damage lands.
    const { state: armed } = attachToHost(toughHero(stun(staged, v)), UPGRADES, lady);
    const pierced = villainPhase(armed, INERT);
    expect(attacksBy(pierced.events, lady)).toHaveLength(1);
    expect(inst(pierced.state, me).statuses.tough).toBe(0);
    expect(inst(pierced.state, me).damage).toBe(inst(staged, me).damage + 4);
    // Attached to Lady, the card gives the villain nothing: his attack is absorbed by the tough status.
    const { state: onLady } = attachToHost(toughHero(stun(staged, lady)), UPGRADES, lady);
    const villainAttack = villainPhase(onLady, INERT);
    expect(attacksBy(villainAttack.events, v)).toHaveLength(1);
    expect(inst(villainAttack.state, me).damage).toBe(inst(staged, me).damage);
    expect(inst(villainAttack.state, me).statuses.tough).toBe(0);
  });

  it("Hero Action: spend [energy][mental][physical] resources -> discard this card", () => {
    const base = heroGame();
    const { state: armed, id } = attachToHost(base, UPGRADES, villainId(base));
    const { state: stocked, ids } = handForMixedCost(armed, P1, ["energy", "mental", "physical"]);
    const after = settle(
      run(
        stocked,
        use(
          P1,
          id,
          "35036.adamantium-upgrades-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
      firstLegal,
      undefined,
      WAVE6_DEPS,
    );
    expect(inst(after, villainId(after)).attachments).not.toContain(id);
    for (const spent of ids) expect(playerOf(after, P1).discard).toContain(spent);
  });

  it("Hero Action: three resources of one type do not pay it", () => {
    const base = heroGame();
    const { state: armed, id } = attachToHost(base, UPGRADES, villainId(base));
    const { state: stocked, ids } = handForMixedCost(armed, P1, ["energy", "energy", "energy"]);
    const result = applyCommand(
      stocked,
      use(
        P1,
        id,
        "35036.adamantium-upgrades-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
      WAVE6_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});

describe("Hack 'n' Slash (35037)", () => {
  const seeded = (seed: number) => {
    const state = run(deathstrikeGame({ seed }), toHero(P1));
    return bare(lightHand(state), villainId(state));
  };
  const me = (state: GameState) => identityOf(state, P1);
  const damageOf = (state: GameState) => inst(state, me(state)).damage;
  /** Sabretooth's own attack, which lands in the same phase. */
  const SABRETOOTH_ATK = 2;
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

  it("When Revealed: discards 1 random card from your hand and you take damage equal to its printed resources", () => {
    const icons = new Set<number>();
    for (const seed of SEEDS) {
      const base = seeded(seed);
      const { state, events } = villainPhase(base, HACK);
      expect(resolved(events)).toContain("35037.when-revealed");
      const discarded = handDiscards(events);
      expect(discarded, `seed ${seed}`).toHaveLength(1);
      expect(playerOf(state, P1).discard).toContain(discarded[0]);
      const n = printedResources(state, discarded[0]!);
      icons.add(n);
      expect(damageOf(state) - damageOf(base), `seed ${seed}`).toBe(SABRETOOTH_ATK + n);
    }
    // The pick is random: across seeds, cards with different printed resources were discarded (and charged for).
    expect(icons.size).toBeGreaterThan(1);
  });

  it("an empty hand and nothing to draw: nothing is discarded and no damage is taken (just Sabretooth's own attack)", () => {
    const base = seeded(1);
    const bareHand = { ...base, players: base.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })) };
    const { state, events } = villainPhase(bareHand, HACK);
    expect(resolved(events)).toContain("35037.when-revealed");
    expect(handDiscards(events)).toHaveLength(0);
    expect(damageOf(state) - damageOf(bareHand)).toBe(SABRETOOTH_ATK);
  });

  it("Boost: discards 1 random card from your hand and you take damage equal to its printed resources", () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const base = seeded(seed);
      // The villain's boost card is Hack 'n' Slash itself; Sabretooth's Forced Response then discards the next card.
      const { state, events } = driveEvents(WAVE6_DEPS, stackEncounterDeck(base, HACK, NO_BOOST, INERT), {
        type: "endTurn",
        playerId: P1,
      });
      expect(resolved(events)).toContain("35037.boost");
      expect(resolved(events)).not.toContain("35037.when-revealed");
      const discarded = handDiscards(events);
      expect(discarded, `seed ${seed}`).toHaveLength(1);
      expect(damageOf(state) - damageOf(base), `seed ${seed}`).toBe(
        SABRETOOTH_ATK + printedResources(state, discarded[0]!),
      );
    }
  });
});
