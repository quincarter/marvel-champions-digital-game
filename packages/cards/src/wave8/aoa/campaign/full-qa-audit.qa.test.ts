import {
  cardsInPlay,
  createGame,
  locateCard,
  type EngineDeps,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { APOCALYPSE } from "../apocalypse.js";
import { PRELATES } from "../prelates.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import {
  atMission,
  atTheMission,
  attempting,
  CAMPAIGN_DEPS,
  campaignGame,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA audit of the Age of Apocalypse campaign content (wave 8, 2026-10-09). Each test names the printed text, the
 * ruling or the owner decision it proves. Only gaps no sibling test covers: two-player mission attempts, the owner
 * decision of row 51, the deck run-out in step 1 and the data the mission area depends on.
 */
const X23 = "45012";
const MARROW = "45021";
const CLOBBER = "45046";
const ENERGY = "01088";
const GENIUS = "01089";
const DESPERATE_MEASURES = "45176";
const EVACUATE = "45167a";
const SUGAR_MAN = "45182a";
const MIKHAIL = "45183a";
const AGENT = "45164";

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const accepted = (state: GameState, command: Command) => sessionApply(startSession(state), command, CAMPAIGN_DEPS).ok;

describe("data the mission area depends on (MC45 pp. 5 to 6; docs/phase7-wave8.md row 62 era, 5 per hero)", () => {
  const card = (code: string) => AOA_CARDS.find((c) => c.id === code)!;
  it.each(["45166a", "45167a", "45168a", "45169a", "45170a"])(
    "%s: a MISSION side scheme with 5 threat per hero",
    (code) => {
      expect(card(code)).toMatchObject({ type: "side_scheme", startingThreat: { base: 0, perPlayer: 5 } });
    },
  );
  it.each(["45179", "45180", "45181", "45182", "45183"])(
    "%s a and b: 5 hit points per hero on both faces, as MC45 p. 5 prints",
    (code) => {
      expect(card(`${code}a`)).toMatchObject({ type: "minion", hp: 5, hpPerPlayer: true });
      expect(card(`${code}b`)).toMatchObject({ type: "minion", hp: 5, hpPerPlayer: true });
    },
  );
  it("two heroes: the drawn mission enters the mission area with 10 threat", () => {
    const game = campaignGame({ players: 2, mission: { mission: EVACUATE, overseer: SUGAR_MAN, team: true } });
    expect(inst(game, theCard(game, EVACUATE)).threat).toBe(10);
  });
});

describe("who may act on the mission area (MC45 p. 5; row 51)", () => {
  const stage = () => {
    const game = campaignGame({
      encounter: [AGENT],
      mission: { mission: EVACUATE, overseer: SUGAR_MAN, team: true },
    });
    return withForm(game, { heroForm: 0 });
  };

  it("row 51: a hero's basic attack cannot target an Overseer in the mission area", () => {
    const state = stage();
    const hero = identityOf(state, P1);
    expect(
      accepted(state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero,
        targetInstanceId: theCard(state, SUGAR_MAN),
      } as Command),
    ).toBe(false);
  });

  it("MC45 p. 5 'Players cannot thwart MISSION side schemes': a basic thwart on the mission is refused", () => {
    const state = stage();
    const hero = identityOf(state, P1);
    expect(
      accepted(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: hero,
        schemeInstanceId: theCard(state, EVACUATE),
      } as Command),
    ).toBe(false);
  });
});

describe("a mission attempt with two heroes (MC45 p. 6: 'discard X cards from the top of their deck')", () => {
  /** P1's X-23 ([physical]) and P2's Marrow ([energy]) at the mission; Mission Team is the first player's. */
  function pair(overseer: string, top: readonly string[]) {
    const game = campaignGame({
      players: 2,
      deck: [X23, MARROW, ENERGY, GENIUS, CLOBBER, DESPERATE_MEASURES],
      mission: { mission: EVACUATE, overseer, team: true },
    });
    const a = atMission(game, P1, X23);
    const b = atMission(a.state, P2, MARROW);
    const stacked = putOnTopOfDeck(b.state, P1, ...top);
    return {
      state: stacked.state,
      x23: a.ids[0]!,
      marrow: b.ids[0]!,
      cards: stacked.ids,
      mission: theCard(stacked.state, EVACUATE),
      overseer: theCard(stacked.state, overseer),
      team: theCard(stacked.state, MISSION_TEAM),
    };
  }
  const run = (t: ReturnType<typeof pair>, pairs: Parameters<typeof attempting>[0], fallback: Picker = firstLegal) =>
    driveEventsPicking(CAMPAIGN_DEPS, t.state, attempting(pairs, fallback), use(P1, t.team, MISSION_TEAM_ACTION));

  it("X counts the other hero's ally too; the cards come off the first player's deck only; both allies take the counter's damage", () => {
    const t = pair(SUGAR_MAN, [CLOBBER, ENERGY]);
    const p2Deck = [...playerOf(t.state, P2).deck];
    const r = run(t, (cards) => [
      [cards[0]!, t.x23],
      [cards[1]!, t.marrow],
    ]);
    expect(of(r.events, "cardDiscardedFromDeck").map((e) => e.playerId ?? null)).not.toContain(P2);
    expect(playerOf(r.state, P2).deck).toEqual(p2Deck);
    expect(inst(r.state, t.mission).counters?.["attempt"]).toBe(1);
    expect(inst(r.state, t.x23).damage).toBe(1);
    expect(inst(r.state, t.marrow).damage).toBe(1);
  });

  it("Mikhail Rasputin: the discarding player (P1) chooses, and may choose the other hero's ally", () => {
    const t = pair(MIKHAIL, [ENERGY, CLOBBER]);
    const offered: InstanceId[][] = [];
    const r = run(
      t,
      (cards) => [
        [cards[0]!, t.marrow],
        [cards[1]!, t.x23],
      ],
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseTarget") {
          offered.push(choice.options.map((o) => o.optionId as InstanceId));
          expect(choice.playerId).toBe(P1);
          const mine = choice.options.find((o) => o.optionId === t.x23);
          return [(mine ?? choice.options[0]!).optionId];
        }
        return firstLegal(s);
      },
    );
    expect(offered.length).toBeGreaterThan(0);
    expect(offered[0]).toContain(t.marrow);
    // 2 [energy] icons, one instance of 2 on X-23 (3 hit points), then the counter's 1: defeated, to its owner's discard.
    expect(locateCard(r.state, t.x23)).toMatchObject({ kind: "discard", playerId: P1 });
    expect(inst(r.state, t.marrow).damage).toBe(1);
  });

  it("step 1 with a short deck: the deck resets and no further cards are discarded from the new deck (RRG 1.8 'Player Deck', p. 33)", () => {
    const t = pair(SUGAR_MAN, [CLOBBER]);
    const owner = playerOf(t.state, P1);
    // Leave exactly one card in the deck; X is 2.
    const rest = owner.deck.filter((id) => id !== t.cards[0]);
    const squeezed: GameState = {
      ...t.state,
      players: t.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [t.cards[0]!], discard: [...p.discard, ...rest] } : p,
      ),
    };
    const r = driveEventsPicking(
      CAMPAIGN_DEPS,
      squeezed,
      attempting((cards) => cards.map((c) => [c, t.x23] as const).slice(0, 1)),
      use(P1, t.team, MISSION_TEAM_ACTION),
    );
    expect(of(r.events, "cardDiscardedFromDeck").map((e) => e.instanceId)).toEqual([t.cards[0]]);
    // The empty deck reset: the discard pile was shuffled into a new deck and P1 was dealt a facedown encounter card.
    expect(playerOf(r.state, P1).deck.length).toBeGreaterThan(0);
    expect(of(r.events, "playerDeckReset").map((e) => e.playerId)).toEqual([P1]);
    expect(of(r.events, "cardMoved").some((e) => e.to.kind === "dealtEncounter")).toBe(true);
  });
});

describe("When Defeated across two owners (MC45 p. 5: 'Shuffle each player card at the mission into its owner's deck')", () => {
  it("P1's Desperate Measures on P2's ally goes to P1's deck and the ally to P2's", () => {
    const game = campaignGame({
      players: 2,
      deck: [MARROW, DESPERATE_MEASURES, CLOBBER],
      mission: { mission: EVACUATE, team: true },
    });
    const a = atMission(game, P2, MARROW);
    const hand = moveToHand(a.state, P1, DESPERATE_MEASURES, CLOBBER);
    const [dm, clobber] = hand.ids as [InstanceId, InstanceId];
    const marrow = a.ids[0]!;
    const attached = driveEventsPicking(
      CAMPAIGN_DEPS,
      hand.state,
      firstLegal,
      play(P1, dm, payWith(hand.state, P1, 1, [dm, clobber]), { attachToInstanceId: marrow }),
    );
    expect(inst(attached.state, dm).attachedTo).toBe(marrow);
    const mission = theCard(attached.state, EVACUATE);
    const ready = { state: patchInstance(attached.state, mission, { threat: 1 }) };
    // Marrow (THW 1 +1) at the mission: P1 discards the top card, matched to her.
    const top = putOnTopOfDeck(ready.state, P1, ENERGY);
    const team = theCard(top.state, MISSION_TEAM);
    const done = driveEventsPicking(
      CAMPAIGN_DEPS,
      top.state,
      attempting((cards) => [[cards[0]!, marrow]]),
      use(P1, team, MISSION_TEAM_ACTION),
    );
    expect(of(done.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([mission]);
    expect(locateCard(done.state, dm)).toMatchObject({ kind: "deck", playerId: P1 });
    expect(locateCard(done.state, marrow)).toMatchObject({ kind: "deck", playerId: P2 });
    expect(cardsInPlay(done.state)).not.toContain(dm);
    expect(atTheMission(done.state)).not.toContain(marrow);
  });
});

describe("Panicked Refugees and the Sea Wall with two heroes (MC45 p. 24; owner decision row 76)", () => {
  const REFUGEES = "45178";
  const SEA_WALL = "45177";
  const FILLER = "01186";
  const ACTION = "45178.panicked-refugees-action";

  /** Panicked Refugees added to P2's hand, then revealed into P2's area by its Forced Response. */
  function revealedForP2() {
    const game = campaignGame({ players: 2, deck: [REFUGEES] });
    const card = instancesOf(game, REFUGEES).find((id) => playerOf(game, P2).deck.includes(id))!;
    const staged: GameState = {
      ...game,
      players: game.players.map((p) =>
        p.playerId === P2 ? { ...p, deck: p.deck.filter((i) => i !== card), hand: [...p.hand, card] } : p,
      ),
      pendingEnteredHand: [{ playerId: P2, instanceId: card, from: "deck" }],
    };
    const run = driveEventsPicking(CAMPAIGN_DEPS, staged, firstLegal, toHero(P1));
    return { ...run, card };
  }

  it("revealed into the owner's play area only; another hero cannot use its Alter-Ego Action, the owner in alter-ego form can", () => {
    const { state, card } = revealedForP2();
    expect(playerOf(state, P2).playArea).toContain(card);
    expect(playerOf(state, P1).playArea).not.toContain(card);
    const alter = patchInstance(withForm(state, "alterEgo", P2), identityOf(state, P2), { exhausted: false });
    expect(accepted(alter, use(P1, card, ACTION))).toBe(false);
    expect(accepted(alter, use(P2, card, ACTION))).toBe(true);
  });

  it("'Alter-Ego Action': in hero form the owner cannot use it", () => {
    const { state, card } = revealedForP2();
    const hero = patchInstance(withForm(state, { heroForm: 0 }, P2), identityOf(state, P2), { exhausted: false });
    expect(accepted(hero, use(P2, card, ACTION))).toBe(false);
  });

  it("Hinder 2[per_hero]: the Sea Wall enters a two-hero game with 2 + 2 x 2 = 6 threat (RRG 1.8 'Hinder X', p. 22)", () => {
    const game = stackEncounterDeck(
      campaignGame({ players: 2, encounter: [SEA_WALL, FILLER, FILLER] }),
      FILLER,
      SEA_WALL,
    );
    const run = driveEventsPicking(CAMPAIGN_DEPS, game, firstLegal, endTurn(P1), endTurn(P2));
    const wall = instancesOf(run.state, SEA_WALL)[0]!;
    expect(inst(run.state, wall).threat).toBe(6);
  });
});

describe("Prelate stars read 'you' as the player the Prelate attacks, with two heroes (45183b, 45180b)", () => {
  const WOLF = "45110";
  const PRELATE_CODES = ["45179b", "45180b", "45181b", "45182b", "45183b"];
  const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, APOCALYPSE, PRELATES) };
  const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;

  /** Apocalypse stage II, two heroes; the seed is searched until step 12a's random Prelate is `want`. */
  function twoHeroes(want: string) {
    for (let seed = 1; seed < 80; seed++) {
      const config = coreScenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
        seed,
        difficulty: "standard",
        modularSetIds: [],
        cardPool: [...CORE_CARDS, ...AOA_CARDS],
      });
      const set = encounterSetId("apocalypse");
      const copies = AOA_CARDS.filter(
        (c) =>
          "encounterSetIds" in c &&
          c.encounterSetIds.includes(set) &&
          !["45104b", "45105a", "45105b"].includes(c.id as string) &&
          (c.type as string) !== "villain" &&
          (c.type as string) !== "main_scheme",
      ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
      const created = createGame(
        {
          ...config,
          villainCardId: "45101a" as typeof config.villainCardId,
          villainSide: "A",
          villainStartStageIndex: 1,
          villainLastStageIndex: 3,
          mainSchemeCardId: "45103a" as typeof config.mainSchemeCardId,
          encounterDeck: [...config.encounterDeck, ...copies, WOLF as never, ...(Array(8).fill("01186") as never[])],
          setAside: [...PRELATE_CODES, "45105a"] as never[],
        },
        DEPS,
      );
      if (!created.ok) continue;
      const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
      const prelate = Object.keys(state.instances).find(
        (id) =>
          PRELATE_CODES.includes(codeOf(state, id as InstanceId)) && state.instances[id as InstanceId]!.engagedWith,
      ) as InstanceId | undefined;
      if (prelate && codeOf(state, prelate) === want) return { state, prelate };
    }
    throw new Error(`no seed reveals ${want}`);
  }

  /** Wolf Among Sheep is P2's reveal: the Prelate, engaged with P1, activates against P2. */
  function wolfAtP2(state: GameState, pick: Picker = firstLegal) {
    // The blank cards are the villain's boosts and P1's reveal (Advance); then P2's Wolf Among Sheep.
    const stacked = stackEncounterDeck(state, "01186", "01186", "01186", WOLF, "01186", "01186");
    const staged = withForm(withForm(stacked, "alterEgo", P1), { heroForm: 0 }, P2);
    return driveEventsPicking(DEPS, staged, pick, endTurn(P1), endTurn(P2));
  }

  it("Mikhail Rasputin (45183b): attacking P2 through Wolf Among Sheep, the 1 damage lands on P2's identity, not P1's", () => {
    const { state, prelate } = twoHeroes("45183b");
    expect(inst(state, prelate).engagedWith).toBe(P1);
    const run = wolfAtP2(state);
    const hits = of(run.events, "damageDealt").filter((e) => e.sourceInstanceId === prelate);
    expect(hits.map((e) => e.targetInstanceId)).not.toContain(identityOf(state, P1));
    expect(hits.filter((e) => e.targetInstanceId === identityOf(state, P2)).map((e) => e.amount)).toContain(1);
  });

  /** Test surgery: P2's ally in play (a hero acts only in turn order, and P2's turn comes after the villain's boost). */
  function allyInPlay(state: GameState, player: typeof P2, code: string) {
    const owner = playerOf(state, player);
    const id = owner.deck.find((c) => codeOf(state, c) === code)!;
    return {
      id,
      state: {
        ...state,
        instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId: player, faceup: true } },
        players: state.players.map((p) =>
          p.playerId === player ? { ...p, deck: p.deck.filter((c) => c !== id), playArea: [...p.playArea, id] } : p,
        ),
      } satisfies GameState,
    };
  }

  const discarding: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const hit = choice.options.find((o) => o.label.startsWith("Discard"));
      if (hit) return [hit.optionId];
    }
    return firstLegal(s);
  };

  it("The Shadow King (45180b): attacking P2, the ally 'you control' with the highest THW is P2's, not P1's higher-THW ally", () => {
    const { state } = twoHeroes("45180b");
    const daredevil = playFromHand(DEPS, state, "01058", 4, firstLegal, P1);
    const jessica = allyInPlay(daredevil.state, P2, "01066");
    const run = wolfAtP2(jessica.state, discarding);
    expect(locateCard(run.state, jessica.id)).toMatchObject({ kind: "discard", playerId: P2 });
    expect(cardsInPlay(run.state)).toContain(daredevil.id);
  });

  it("The Shadow King (45180b): P2 controls no ally, so nothing happens even though P1 controls one", () => {
    const { state } = twoHeroes("45180b");
    const daredevil = playFromHand(DEPS, state, "01058", 4, firstLegal, P1);
    const run = wolfAtP2(daredevil.state, discarding);
    expect(cardsInPlay(run.state)).toContain(daredevil.id);
  });
});

describe("boost cards on a scheme activation (45164, 45165: 'Give the activating enemy an additional boost card')", () => {
  const CRISIS = "45165";
  const AGENT_CARD = "45164";
  it.each([CRISIS, AGENT_CARD])(
    "%s as the boost of the villain's scheme in alter-ego form: the villain gets 2 boost cards",
    (code) => {
      const game = withForm(
        stackEncounterDeck(
          campaignGame({ encounter: [code, "01186", "01186", "01186"] }),
          code,
          "01186",
          "01186",
          "01186",
        ),
        "alterEgo",
      );
      const run = driveEventsPicking(CAMPAIGN_DEPS, game, firstLegal, endTurn(P1));
      const firstReveal = run.events.findIndex((e) => e.type === "encounterCardRevealed");
      const flipped = run.events.slice(0, firstReveal).filter((e) => e.type === "boostCardFlipped");
      expect(of(run.events, "schemeResolved")[0]).toBeDefined();
      expect(flipped).toHaveLength(2);
    },
  );
});

describe("the attempt follows Mission Team's controller (MC45 p. 5: 'the first player takes control'; p. 6: 'their deck')", () => {
  it("round 2, P2 first player: P2's attempt discards from P2's deck, for P1's ally at the mission", () => {
    const game = campaignGame({
      players: 2,
      deck: [X23, CLOBBER],
      mission: { mission: EVACUATE, overseer: SUGAR_MAN, team: true },
    });
    const round = driveEventsPicking(CAMPAIGN_DEPS, game, firstLegal, endTurn(P1), endTurn(P2));
    expect(round.state.firstPlayerId).toBe(P2);
    const ally = atMission(round.state, P1, X23);
    const top = putOnTopOfDeck(ally.state, P2, CLOBBER);
    const team = theCard(top.state, MISSION_TEAM);
    const p1Deck = [...playerOf(top.state, P1).deck];
    const run = driveEventsPicking(
      CAMPAIGN_DEPS,
      top.state,
      attempting((cards) => [[cards[0]!, ally.ids[0]!]]),
      use(P2, team, MISSION_TEAM_ACTION),
    );
    expect(of(run.events, "cardDiscardedFromDeck").map((e) => e.instanceId)).toEqual(top.ids);
    expect(playerOf(run.state, P1).deck).toEqual(p1Deck);
    expect(inst(run.state, ally.ids[0]!).damage).toBe(1);
  });
});
