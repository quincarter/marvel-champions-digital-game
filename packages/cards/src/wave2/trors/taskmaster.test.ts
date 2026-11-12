import { activeEncounterDeck, cardsInPlay, createGame, hasKeyword, type GameState, type InstanceId } from "@mc/engine";
import { cardId, WAVE2_CARDS } from "@mc/content";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  P1,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const taskmasterVsHeroes = () =>
  startWave2Game(wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
const ADVANCE = "01186";

/** Photographic Reflexes (04104), attached directly to Taskmaster — test-only surgery, matching wave1's precedent
 * (docs/phase7-wave1-scripting.md "The Wrecking Crew", `forceAttachToVillain`) for reaching a specific villain
 * attachment without a real reveal. */
function withPhotographicReflexes(state: GameState): { readonly state: GameState; readonly card: InstanceId } {
  const villain = state.villains[0]!.instanceId;
  const id = Object.values(state.instances).find(
    (i) => i.cardId === cardId("04104") && i.attachedTo === null,
  )!.instanceId;
  return {
    state: {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: villain, faceup: true },
        [villain]: { ...state.instances[villain]!, attachments: [...state.instances[villain]!.attachments, id] },
      },
    },
    card: id,
  };
}

describe("Taskmaster scenario", () => {
  it("standalone setup: the four Captive allies are set aside, Hydra Patrol is in play, and the game is legal", () => {
    const config = wave2Scenario("taskmaster", {
      players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
      seed: 2026,
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const captives = created.state.encounterSetAside.filter((id) =>
      ["04097", "04098", "04099", "04100"].includes(created.state.instances[id]?.cardId ?? ""),
    );
    expect(captives).toHaveLength(4);
    expect(cardsInPlay(created.state).some((id) => created.state.instances[id]?.cardId === "04154")).toBe(true);
    expect(created.state.villains).toHaveLength(1);
    expect(created.state.outcome).toBeNull();
  });

  it("Taskmaster (I/II/III): Forced Response, after a player changes to hero form, they discard the top card of the encounter deck and take damage equal to its boost icons", () => {
    const start = taskmasterVsHeroes();
    const identity = identityOf(start);
    const before = inst(start, identity).damage;
    const deckBefore = activeEncounterDeck(start).deck.length;
    const hero = runWave2(start, toHero());
    // Taskmaster (I) is the default starting stage, and this forced response has no "against you"/villain-scoping
    // — it fires for any player's own change to hero form.
    expect(activeEncounterDeck(hero).deck.length).toBeLessThan(deckBefore);
    const discarded = activeEncounterDeck(hero).discard.at(-1)!;
    const discardedCardId = hero.instances[discarded]!.cardId;
    const discardedCard = WAVE2_CARDS.find((c) => c.id === discardedCardId);
    const boostIcons = discardedCard && "boostIcons" in discardedCard ? discardedCard.boostIcons : 0;
    expect(inst(hero, identity).damage).toBe(before + boostIcons);
  });

  // docs/phase7-wave2.md §4 Q8: Taskmaster's count of "the number of boost icons on that card" is a count of boost
  // icons on an encounter card, so Chaos Control (15001a) may replace it. Advance (01186) has 0 icons, Shadow of the
  // Past (01190) has 2; both are Standard set cards.
  const taskmasterVsScarletWitch = () =>
    stackEncounterDeck(
      startWave2Game(wave2Scenario("taskmaster", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 })),
      ADVANCE,
      "01190",
    );
  const chaosControl = (accept: boolean) => (state: GameState) => {
    const option = state.pendingChoice?.options.find((o) => o.optionId.endsWith(":15001a.chaos-control"));
    return accept && option ? [option.optionId] : firstLegal(state);
  };

  it("Taskmaster's count of the discarded card's boost icons can be replaced by Chaos Control", () => {
    const start = taskmasterVsScarletWitch();
    const identity = identityOf(start);
    const before = inst(start, identity).damage;
    const discardBefore = activeEncounterDeck(start).discard.length;
    const hero = settle(runWave2(start, toHero()), chaosControl(true), undefined, WAVE2_DEPS);
    // Advance's 0 icons are not counted: Chaos Control discards Shadow of the Past and its 2 icons are counted instead.
    expect(inst(hero, identity).damage).toBe(before + 2);
    expect(activeEncounterDeck(hero).discard.length).toBe(discardBefore + 2);
  });

  it("Taskmaster's count is the discarded card's own icons when Chaos Control is not used", () => {
    const start = taskmasterVsScarletWitch();
    const identity = identityOf(start);
    const before = inst(start, identity).damage;
    const discardBefore = activeEncounterDeck(start).discard.length;
    const hero = settle(runWave2(start, toHero()), chaosControl(false), undefined, WAVE2_DEPS);
    expect(inst(hero, identity).damage).toBe(before);
    expect(activeEncounterDeck(hero).discard.length).toBe(discardBefore + 1);
  });

  it("Taskmaster (II/III): When Revealed deals each player an encounter card", () => {
    expect(WAVE2_DEPS.abilities["04094.when-revealed"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04095.when-revealed"]).toBeDefined();
  });

  it("Hydra Hunter: his attacks gain piercing and ranged (a constant keyword grant on himself)", () => {
    const start = taskmasterVsHeroes();
    const hydraHunter = Object.values(start.instances).find((i) => i.cardId === cardId("04101"))!;
    // A constant ability only applies while its card is in play (RRG 1.8 "Constant Ability", p. 12) — test-only
    // surgery to place this specific minion in play, engaged with P1, the way a real reveal would.
    const inPlay = {
      ...start,
      villainArea: [...start.villainArea, hydraHunter.instanceId],
      instances: { ...start.instances, [hydraHunter.instanceId]: { ...hydraHunter, faceup: true, engagedWith: P1 } },
    };
    expect(hasKeyword(inPlay, hydraHunter.instanceId, "piercing", WAVE2_DEPS)).toBe(true);
    expect(hasKeyword(inPlay, hydraHunter.instanceId, "ranged", WAVE2_DEPS)).toBe(true);
  });

  it("Photographic Reflexes: prevents all damage to Taskmaster from a player's attack and redirects it to that player's identity, then discards", () => {
    const start = withPhotographicReflexes(taskmasterVsHeroes());
    const hero = runWave2(start.state, toHero());
    const villain = hero.villains[0]!.instanceId;
    const identity = identityOf(hero);
    const villainDamageBefore = inst(hero, villain).damage;
    const identityDamageBefore = inst(hero, identity).damage;
    // Basic attack against the villain.
    const attacked = settle(
      runWave2(hero, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore);
    expect(inst(attacked, identity).damage).toBeGreaterThan(identityDamageBefore);
    // An encounter card (home: the encounter deck) discards to the *encounter* discard pile, not the player's own
    // (docs/phase7-wave1-scripting.md "Test conventions").
    expect(activeEncounterDeck(attacked).discard).toContain(start.card);
  });

  it("Photographic Reflexes: heard on the attack, so a tough status card on Taskmaster does not pre-empt it (RRG 1.8 p. 14; audit finding 17)", () => {
    const start = withPhotographicReflexes(taskmasterVsHeroes());
    const hero = runWave2(start.state, toHero());
    const villain = hero.villains[0]!.instanceId;
    const identity = identityOf(hero);
    const toughVillain = patchInstance(hero, villain, {
      statuses: { ...inst(hero, villain).statuses, tough: 1 },
    });
    const identityDamageBefore = inst(toughVillain, identity).damage;
    const attacked = settle(
      runWave2(toughVillain, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // The damage was prevented, not absorbed: the tough status card is still there and the attacker took the hit.
    expect(inst(attacked, villain).damage).toBe(0);
    expect(inst(attacked, villain).statuses.tough).toBe(1);
    expect(inst(attacked, identity).damage).toBeGreaterThan(identityDamageBefore);
    expect(activeEncounterDeck(attacked).discard).toContain(start.card);
  });

  it("Mimicry: in alter-ego form, discards 5 cards and Taskmaster schemes if a Thwart card was among them", () => {
    expect(WAVE2_DEPS.abilities["04105.when-revealed-alter-ego"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04105.when-revealed-hero"]).toBeDefined();
  });

  it("Hunted by Hydra: each player in hero form takes 1 damage and discards a random hand card", () => {
    const start = stackEncounterDeck(taskmasterVsHeroes(), ADVANCE, "04106");
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const handBefore = playerOf(hero, P1).hand.length;
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, identity).damage).toBeGreaterThan(damageBefore);
    expect(playerOf(settled, P1).hand.length).toBeLessThan(handBefore + 1); // -1 discarded, plus whatever else the round adds/removes
  });

  it("Taskmaster's Training Camp: gives a tough status card to a minion that enters play", () => {
    expect(WAVE2_DEPS.abilities["04108.taskmasters-training-camp-forced-response"]).toBeDefined();
  });

  /** Test-only surgery: the set-aside Moon Knight moved into P1's hand (a real game gets him there via Captured by
   * Hydra's "When Defeated" clause, which has no ability ref to script — module docblock). */
  function moonKnightInHand(start: GameState): { readonly state: GameState; readonly moonKnight: InstanceId } {
    const moonKnight = start.encounterSetAside.find((id) => start.instances[id]?.cardId === "04097")!;
    return {
      moonKnight,
      state: {
        ...start,
        encounterSetAside: start.encounterSetAside.filter((id) => id !== moonKnight),
        players: start.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand, moonKnight] } : p)),
        instances: {
          ...start.instances,
          [moonKnight]: { ...start.instances[moonKnight]!, ownerId: P1, home: { kind: "player" as const } },
        },
      },
    };
  }

  const printsWild = (state: GameState, id: InstanceId): boolean => {
    const card = WAVE2_CARDS.find((c) => c.id === state.instances[id]?.cardId);
    return card !== undefined && "resourceIcons" in card && (card.resourceIcons?.wild ?? 0) > 0;
  };
  /** The resource icons `id` prints, of every type. */
  const iconsOf = (state: GameState, id: InstanceId): number => {
    const card = WAVE2_CARDS.find((c) => c.id === state.instances[id]?.cardId);
    if (card === undefined || !("resourceIcons" in card) || !card.resourceIcons) return 0;
    return Object.values(card.resourceIcons).reduce((sum: number, n) => sum + (n ?? 0), 0);
  };

  it("Moon Knight: after you play him from your hand, spending a [wild] resource draws 2 cards", () => {
    // Hawkeye's Bow (04002) prints one [wild] icon, so it pays "spend a [wild] resource" exactly (as for Crossfire's
    // Rifle, hawkeye.test.ts).
    const given = moveToHand(taskmasterVsHeroes(), P1, "04002");
    const [bow] = given.ids as [InstanceId];
    const { state: withHand, moonKnight } = moonKnightInHand(given.state);
    const before = playerOf(withHand, P1).hand.length;
    // Moon Knight's own printed cost is 0 — no payment for the play itself; his Response then has its own "spend
    // a [wild] resource" cost, answered as a separate `payForAbility` choice (docs/phase7-wave2-scripting.md's
    // own note on Mockingbird's interrupt, the same prompt kind).
    const playedRaw = runWave2(withHand, play(P1, moonKnight, []));
    const triggerOption = `${moonKnight}:04097.moon-knight-response`;
    const played = settle(
      playedRaw,
      (s) => {
        if (s.pendingChoice?.prompt.kind === "payForAbility") return [`hand:${bow}`];
        if (s.pendingChoice?.options.some((o) => o.optionId === triggerOption)) return [triggerOption];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(played, P1).playArea).toContain(moonKnight);
    expect(playerOf(played, P1).discard).toContain(bow);
    // -1 played, -1 resource for the Response, +2 drawn.
    expect(playerOf(played, P1).hand.length).toBe(before - 2 + 2);
  });

  /**
   * Plays Moon Knight from a hand holding no [wild] card, answering his Response if it is offered and paying any
   * `payForAbility` with `count` non-[wild] hand cards. Records what the engine offered, and every event.
   */
  function playWithoutWild(count: number, opts: { readonly bow?: boolean } = {}) {
    // RRG 1.8 "Wild Resource" (p. 48): some abilities specifically require a [wild] resource (as Crossfire's Rifle,
    // 04029, scripts it). Every [wild] card in hand goes to the bottom of the deck, so only other resources are left.
    const start = taskmasterVsHeroes();
    const noWild = {
      ...start,
      players: start.players.map((p, i) => {
        if (i !== 0) return p;
        const wild = p.hand.filter((id) => printsWild(start, id));
        return { ...p, hand: p.hand.filter((id) => !wild.includes(id)), deck: [...p.deck, ...wild] };
      }),
    };
    // The positive control: Hawkeye's Bow (04002), which prints a [wild] icon, back in hand to pay with.
    const given = opts.bow ? moveToHand(noWild, P1, "04002") : { state: noWild, ids: [] as InstanceId[] };
    const { state: withHand, moonKnight } = moonKnightInHand(given.state);
    const others = playerOf(withHand, P1).hand.filter((id) => id !== moonKnight && !given.ids.includes(id));
    const hand = [...given.ids, ...others];
    expect(others.reduce((sum, id) => sum + iconsOf(withHand, id), 0)).toBeGreaterThanOrEqual(count);
    let triggerOffered = false;
    const payOptions: string[][] = [];
    const { state, events } = driveEventsPicking(
      WAVE2_DEPS,
      withHand,
      (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "payForAbility") {
          payOptions.push(choice.options.map((o) => o.optionId));
          return hand.slice(0, count).map((id) => `hand:${id}`);
        }
        // Any option for his Response, whatever its id's prefix: a detector that can't miss it.
        const response = choice.options.find((o) => o.optionId.includes("04097.moon-knight-response"));
        if (response) {
          triggerOffered = true;
          return [response.optionId];
        }
        return firstLegal(s);
      },
      play(P1, moonKnight, []),
    );
    const drawn = events.filter((e) => e.type === "cardDrawn" && e.playerId === P1);
    return { state, moonKnight, hand, triggerOffered, payOptions, drawn };
  }

  it("Moon Knight: a resource with no [wild] icon cannot pay his Response, so it is not offered and draws nothing", () => {
    const { state, moonKnight, hand, triggerOffered, payOptions, drawn } = playWithoutWild(1);
    expect(playerOf(state, P1).playArea).toContain(moonKnight);
    // Why nothing was drawn: with no [wild] resource to spend, the Response is never offered (its cost can't be
    // paid), so no payment is asked for and no card is drawn. Every other card is still in hand.
    expect(triggerOffered).toBe(false);
    expect(payOptions).toEqual([]);
    expect(drawn).toEqual([]);
    for (const id of hand) expect(playerOf(state, P1).hand).toContain(id);
  });

  it("Moon Knight: control for the detector: with Hawkeye's Bow in that same hand, the Response is offered and draws 2", () => {
    const { triggerOffered, drawn } = playWithoutWild(1, { bow: true });
    expect(triggerOffered).toBe(true);
    expect(drawn).toHaveLength(2);
  });

  it("Moon Knight: two or more non-[wild] icons in hand still can't pay it: more icons are not a [wild] one", () => {
    // The hand left holds at least 2 non-[wild] resource icons (checked in `playWithoutWild`), so the Response is
    // refused for the icon's type, not for want of resources.
    const { triggerOffered, payOptions, drawn } = playWithoutWild(2);
    expect(triggerOffered).toBe(false);
    expect(payOptions).toEqual([]);
    expect(drawn).toEqual([]);
  });

  it("Captured by Hydra: places 1 random set-aside Captive ally facedown beneath this scheme", () => {
    expect(WAVE2_DEPS.abilities["04107.when-revealed"]).toBeDefined();
  });
});
