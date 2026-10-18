import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  handSize,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import { WAVE6_DEPS } from "../index.js";
import { WSP_PACK_CARDS } from "../../wave2/wsp/pack-cards.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  putOnTopOfDeck,
  payWith,
  picking,
  play,
  playerOf,
  runWith,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, moveToDiscard } from "../../testing/staging.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { minionEngaged } from "../../testing/wave10-engine-qa-bench.js";
import { chosen, encounterCards, revealCard, selectCards, whenRevealed } from "../../dsl/index.js";
import { FANTASY_ABILITIES } from "./fantasy.js";
import { fantasyGame, inEncounterPiles, inPlay, withHand } from "./fantasy-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const GAME_OF_MOJOS = "39041";
const DRAGON = "39042";
const GOBLIN = "39043";
const TROLL = "39044";
const FETCH_QUEST = "39045";
const MANA_DRAIN = "39046";
const NO_BOOST = "01187";

/** Core cards (Iron Man, Aggression): Haymaker 01087 prints [energy], Uppercut 01054 prints [physical]. */
const HAYMAKER = "01087";
const UPPERCUT = "01054";
/** Spider-Man: Swinging Web Kick prints [mental]: 8 damage to an enemy. */
const WEB_KICK = "01005";

const ironMan = () => fantasyGame({ players: [{ starterDeckId: "core-iron-man-aggression" }] });
const heroForm = (state: GameState) => run(state, toHero(P1));

/** Plays `code` from P1's hand (state surgery to put it there, with other cards to pay) against `target`. */
function attackWith(state: GameState, code: string, target: InstanceId, pick: Picker = picking(target)) {
  const hand = moveToHand(state, P1, code);
  const card = hand.ids[0]!;
  const owner = playerOf(hand.state, P1);
  const padded = {
    ...hand.state,
    players: hand.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...owner.deck.slice(0, 4)], deck: owner.deck.slice(4) } : p,
    ),
  };
  const cost = (padded.cardPool[padded.instances[card]!.cardId] as { cost: number }).cost;
  return driveEventsPicking(deps, padded, pick, play(P1, card, payWith(padded, P1, cost, [card])));
}
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "damageDealt")
    .filter((e) => e.targetInstanceId === id)
    .map((e) => e.amount);

describe("registry", () => {
  it("registers every ability ref of the Fantasy set", () => {
    expect(Object.keys(FANTASY_ABILITIES).sort()).toEqual(
      [
        "39041.a-game-of-mojos-constant",
        "39041.when-revealed",
        "39042.dragon-constant",
        "39042.when-defeated",
        "39043.goblin-constant",
        "39043.when-defeated",
        "39044.troll-constant",
        "39044.when-defeated",
        "39045.when-defeated",
        "39045.boost",
        "39046.when-revealed",
        "39046.boost",
      ].sort(),
    );
  });

  it("the set's six cards are in the game from data", () => {
    const state = fantasyGame();
    for (const code of [GAME_OF_MOJOS, DRAGON, GOBLIN, TROLL, FETCH_QUEST, MANA_DRAIN])
      expect(inEncounterPiles(state, code).length, code).toBeGreaterThanOrEqual(1);
  });
});

describe("A Game of Mojo's (39041)", () => {
  it("each player gets +1 hand size while it is in play", () => {
    const base = fantasyGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    const { state: withEnv } = encounterCardInVillainArea(base, GAME_OF_MOJOS);
    for (const player of [P1, P2]) expect(handSize(withEnv, player, deps)).toBe(handSize(base, player, deps) + 1);
  });

  it("reveals from the encounter deck: enters play, gains surge (the next card is revealed too)", () => {
    const state = run(fantasyGame(), toHero(P1));
    const stacked = stackEncounterDeck(state, NO_BOOST, GAME_OF_MOJOS, MANA_DRAIN);
    const { state: after, events } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    expect(inPlay(after, GAME_OF_MOJOS)).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(expect.arrayContaining([GAME_OF_MOJOS, MANA_DRAIN]));
  });

  it("When Revealed: discards each other SETTING environment in play", () => {
    const base = fantasyGame({ modularSetIds: ["fantasy", "crime"] });
    // The Crime SHOW environment (Dial M for Mojo, 39035) is a SETTING too.
    const { state: withSetting, id: setting } = encounterCardInVillainArea(base, "39035");
    const state = run(withSetting, toHero(P1));
    const stacked = stackEncounterDeck(state, NO_BOOST, GAME_OF_MOJOS);
    const { state: after } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    expect(inPlay(after, GAME_OF_MOJOS)).toHaveLength(1);
    expect(cardsInPlay(after)).not.toContain(setting);
    expect(activeEncounterDeck(after).discard).toContain(setting);
  });

  it("does not surge when revealed by a search (insert p. 18: not 'revealed from the encounter deck')", () => {
    const state = run(fantasyGame({ modularSetIds: ["fantasy", "acolytes"] }), toHero(P1));
    // Zeal for the Cause stands in for "search the encounter deck for A Game of Mojo's and reveal it".
    const searching: EngineDeps = {
      ...deps,
      abilities: {
        ...deps.abilities,
        "32164.when-revealed": whenRevealed(
          selectCards("found", encounterCards(["deck", "discard"], { name: "A Game of Mojo's" })),
          revealCard(chosen("found")),
        ),
      },
    };
    const stacked = stackEncounterDeck(state, NO_BOOST, "32164", MANA_DRAIN);
    const { state: after, events } = driveEventsPicking(searching, stacked, firstLegal, {
      type: "endTurn",
      playerId: P1,
    });
    expect(inPlay(after, GAME_OF_MOJOS)).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(expect.arrayContaining(["32164", GAME_OF_MOJOS]));
    expect(revealed).not.toContain(MANA_DRAIN);
    expect(inEncounterPiles(after, MANA_DRAIN)).toHaveLength(1);
  });
});

describe("Dragon (39042)", () => {
  const dragonGame = () => {
    const hero1 = heroForm(ironMan());
    return engageMinion(hero1, DRAGON, P1);
  };

  it("doubles damage from a card with a printed [energy] resource (Haymaker: 3 becomes 6)", () => {
    const { state, id } = dragonGame();
    const { state: after, events } = attackWith(state, HAYMAKER, id);
    expect(damageTo(events, id)).toEqual([6]);
    expect(inst(after, id).damage).toBe(6);
  });

  it("does not double damage from a card printing another resource (Uppercut [physical]: 5)", () => {
    const { state, id } = dragonGame();
    const { events } = attackWith(state, UPPERCUT, id);
    expect(damageTo(events, id)).toEqual([5]);
  });

  it("does not double a hero's basic attack (the identity prints no resource)", () => {
    const { state, id } = dragonGame();
    const before = inst(state, id).damage;
    const after = run(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state, P1),
      targetInstanceId: id,
    });
    // Iron Man's ATK is 1, so a doubled hit would be 2.
    expect(inst(after, id).damage - before).toBe(1);
  });

  it("additions come before doubling (RRG 1.8 p. 29, Q40): with Wild Wild Mojo's +1, Haymaker deals (3 + 1) x 2 = 8", () => {
    const both = fantasyGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }],
      modularSetIds: ["fantasy", "western"],
    });
    const { state, id } = engageMinion(heroForm(both), DRAGON, P1);
    const { state: withMojo } = encounterCardInVillainArea(state, "39066"); // Wild Wild Mojo (Western set)
    const { events } = attackWith(withMojo, HAYMAKER, id);
    expect(damageTo(events, id)).toEqual([8]);
  });

  it("a tough status card prevents the whole (doubled) damage first; the next hit is doubled", () => {
    const { state, id } = dragonGame();
    const tough = patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 1 } });
    const first = attackWith(tough, HAYMAKER, id);
    expect(inst(first.state, id).damage).toBe(0);
    expect(inst(first.state, id).statuses.tough).toBe(0);
    const second = attackWith(first.state, HAYMAKER, id);
    expect(inst(second.state, id).damage).toBe(6);
  });

  it("When Defeated: each player draws 4 cards", () => {
    const base = fantasyGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    const { state, id } = engageMinion(heroForm(base), DRAGON, P1);
    const hands = (s: GameState) => [P1, P2].map((p) => playerOf(s, p).hand.length);
    const before = hands(state);
    // A real basic attack with 999 damage already on it: the defeat pipeline runs.
    const near = patchInstance(state, id, { damage: 999 });
    const after = run(near, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(near, P1),
      targetInstanceId: id,
    });
    expect(inPlay(after, DRAGON)).toHaveLength(0);
    expect(hands(after).map((n, i) => n - before[i]!)).toEqual([4, 4]);
  });
});

describe("Goblin (39043)", () => {
  const goblinGame = () => engageMinion(heroForm(ironMan()), GOBLIN, P1);

  it("takes no damage from a card printing [energy] (Haymaker), and a hero's basic attack cannot target it", () => {
    const { state, id } = goblinGame();
    const haymaker = attackWith(state, HAYMAKER, id);
    expect(inst(haymaker.state, id).damage).toBe(0);
    expect(inPlay(haymaker.state, GOBLIN)).toEqual([id]);
    // The identity prints no resource (§4 Q39), so its basic attack could deal no damage: not a valid target for it
    // (RRG 1.8 "Target", p. 43; ruling Mar 19, 2026 (2)).
    const basic = applyCommand(
      state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(state, P1), targetInstanceId: id },
      deps,
    );
    expect(basic.ok).toBe(false);
    if (!basic.ok) expect(basic.error.code).toBe("no_valid_target");
  });

  it("takes damage from a card printing [physical] (Uppercut), and When Defeated removes 2 threat from a scheme", () => {
    const { state, id } = goblinGame();
    const main = state.mainScheme.instanceId;
    const charged = patchInstance(state, main, { threat: 5 });
    const { state: after, events } = attackWith(charged, UPPERCUT, id);
    expect(damageTo(events, id)).toEqual([5]);
    expect(inPlay(after, GOBLIN)).toHaveLength(0);
    expect(inst(after, main).threat).toBe(3);
  });
});

describe("Troll (39044)", () => {
  const trollGame = () => engageMinion(heroForm(fantasyGame()), TROLL, P1);

  it("takes 1 additional damage from a card printing [mental] (Swinging Web Kick: 8 becomes 9)", () => {
    const { state, id } = trollGame();
    const { events } = attackWith(state, WEB_KICK, id);
    expect(damageTo(events, id)).toEqual([9]);
  });

  it("takes no additional damage from a card printing another resource (Haymaker [energy]: 3) or a basic attack", () => {
    const { state, id } = trollGame();
    const { events } = attackWith(state, HAYMAKER, id);
    expect(damageTo(events, id)).toEqual([3]);
    const before = inst(state, id).damage;
    const basic = run(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state, P1),
      targetInstanceId: id,
    });
    expect(inst(basic, id).damage - before).toBe(2); // Spider-Man's ATK
  });

  it("When Defeated: the defeating player may put 1 ally from their discard pile into play", () => {
    const { state, id } = trollGame();
    const withAlly = moveToDiscard(state, P1, "01002"); // Black Cat
    const cat = withAlly.id;
    const { state: after } = attackWith(withAlly.state, WEB_KICK, id, picking(id, cat));
    expect(inPlay(after, TROLL)).toHaveLength(0);
    expect(playerOf(after, P1).playArea).toContain(cat);
    expect(playerOf(after, P1).discard).not.toContain(cat);
  });

  it("the ally is optional (declined here), and only an ally is offered", () => {
    const { state, id } = trollGame();
    const withEvent = moveToDiscard(state, P1, "01003"); // Backflip, an event
    const withAlly = moveToDiscard(withEvent.state, P1, "01002");
    const offered: string[][] = [];
    const watch: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards") offered.push(s.pendingChoice.options.map((o) => o.optionId));
      return picking(id)(s);
    };
    const { state: after } = attackWith(withAlly.state, WEB_KICK, id, watch);
    expect(inPlay(after, TROLL)).toHaveLength(0);
    expect(offered.flat()).toContain(withAlly.id);
    expect(offered.flat()).not.toContain(withEvent.id);
    expect(playerOf(after, P1).playArea).not.toContain(withAlly.id);
    expect(playerOf(after, P1).discard).toContain(withAlly.id);
  });
});

describe("Fetch Quest (39045)", () => {
  /**
   * P1 Iron Man, P2 Spider-Man, both in hero form, Fetch Quest in play with 1 threat for P1's Iron Man to thwart. One
   * card of P2's deck is relabeled No Quarter (28013, Requirement [physical]) by surgery: no Core card has one.
   */
  const quest = () => {
    const base = fantasyGame({
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    // P2's form is set by surgery: a form change is only legal on its own turn.
    const hero = {
      ...run(base, toHero(P1)),
      players: run(base, toHero(P1)).players.map((p) =>
        p.playerId === P2 ? { ...p, identity: { ...p.identity, form: "hero" as const } } : p,
      ),
    };
    const relabeled = patchInstance(hero, playerOf(hero, P2).deck[0]!, { cardId: cardId("28013") });
    // The searched cards are in the decks, not the opening hands.
    const searched = putOnTopOfDeck(putOnTopOfDeck(relabeled, P2, "01002").state, P1, "01030", HAYMAKER).state;
    return encounterCardInVillainArea(searched, FETCH_QUEST, 1);
  };
  const defeat = (state: GameState, id: InstanceId, pick: Picker) =>
    driveEventsPicking(deps, state, pick, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(state, P1),
      schemeInstanceId: id,
    });
  const codeOf = (state: GameState, id: string) => state.instances[id as InstanceId]!.cardId as string;

  /** Records what each player is offered by the deck search, and takes `want` (a card code per player) from it. */
  const searching = (want: Record<string, string | null>) => {
    const offered: { player: string; cards: string[] }[] = [];
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseCards" || choice.prompt.slot !== "playFromHand") return firstLegal(state);
      offered.push({ player: choice.playerId, cards: choice.options.map((o) => codeOf(state, o.optionId)) });
      const wanted = want[choice.playerId];
      const hit = choice.options.find((o) => codeOf(state, o.optionId) === wanted);
      return hit ? [hit.optionId] : [];
    };
    return { offered, pick };
  };

  it("When Defeated: in player order, each player searches their own deck and plays a card ignoring its cost", () => {
    const { state, id } = quest();
    const { offered, pick } = searching({ p1: "01030", p2: "01002" });
    const { state: after, events } = defeat(state, id, pick);
    expect(offered.map((o) => o.player)).toEqual(["p1", "p2"]);
    // War Machine (cost 4) enters play with no resources spent.
    const p1Play = playerOf(after, P1).playArea.map((i) => codeOf(after, i));
    expect(p1Play).toContain("01030");
    expect(of(events, "cardPlayed").length).toBeGreaterThanOrEqual(1);
    expect(playerOf(after, P1).discard).toHaveLength(playerOf(state, P1).discard.length);
    expect(playerOf(after, P2).playArea.map((i) => codeOf(after, i))).toContain("01002");
    expect(cardsInPlay(after)).not.toContain(id);
  });

  it("may be declined by each player: nothing is played", () => {
    const { state, id } = quest();
    const { offered, pick } = searching({});
    const { state: after } = defeat(state, id, pick);
    expect(offered).toHaveLength(2);
    expect(playerOf(after, P1).playArea).toEqual(playerOf(state, P1).playArea);
    expect(playerOf(after, P2).playArea).toEqual(playerOf(state, P2).playArea);
  });

  it("erratum (RRG 1.8 p. 69): a card with a requirement is never offered (Nova's No Quarter)", () => {
    const { state, id } = quest();
    const { offered, pick } = searching({});
    defeat(state, id, pick);
    const nova = offered.find((o) => o.player === "p2")!;
    expect(nova.cards).not.toContain("28013");
    expect(nova.cards.length).toBeGreaterThan(0);
  });

  it("an Action event (Haymaker) can be played during the hero phase, by either player (RRG 1.8 'Action', p. 6)", () => {
    const { state, id } = quest();
    const { offered, pick } = searching({});
    defeat(state, id, pick);
    for (const player of ["p1", "p2"]) expect(offered.find((o) => o.player === player)!.cards).toContain(HAYMAKER);
  });

  it("a searched upgrade that attaches to a minion (Spider-Tracer 01007): its host is asked, then the deck is shuffled", () => {
    // docs/phase7-wave11.md §3.2 broadened the ignore-cost play to an upgrade naming its host (RRG 1.8 "Attach To",
    // p. 8); the search's shuffle still comes once the played card has resolved (RRG 1.8 "Search", p. 39).
    const { state: base, id } = quest();
    const first = minionEngaged(putOnTopOfDeck(base, P2, "01007").state, "01101");
    const second = minionEngaged(first.state, "01101");
    const state = second.state;
    const tracer = playerOf(state, P2).deck[0]!;
    const hostsOffered: string[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand") {
        const hit = choice.playerId === "p2" ? choice.options.find((o) => o.optionId === tracer) : undefined;
        return hit ? [hit.optionId] : [];
      }
      if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "playFromHandHost") {
        hostsOffered.push(choice.options.map((o) => o.optionId));
        return [second.id];
      }
      return firstLegal(s);
    };
    const { state: after, events } = defeat(state, id, pick);
    expect(hostsOffered).toEqual([[first.id, second.id]]);
    expect(inst(after, second.id).attachments).toContain(tracer);
    const played = events.findIndex((e) => e.type === "cardPlayed" && e.instanceId === tracer);
    expect(played).toBeGreaterThanOrEqual(0);
    const shuffled = events.findIndex(
      (e, at) => at > played && e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P2,
    );
    expect(shuffled).toBeGreaterThan(played);
  });

  it("a searched Ironheart (13018) does not answer 'after you play Ironheart from your hand' (RRG 1.8 FAQ p. 64)", () => {
    // The play is from the deck and Fetch Quest does not say "as if it were in your hand", so it is not a play from the
    // hand (FAQ "Magik (#30A)": only such a card "is considered to have been played from her hand").
    const withIronheart: EngineDeps = { abilities: { ...deps.abilities, ...WSP_PACK_CARDS } };
    const { state: base, id } = quest();
    const ironheart = playerOf(base, P1).deck[0]!;
    const state = patchInstance(base, ironheart, { cardId: cardId("13018") });
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand") {
        return choice.playerId === "p1" && choice.options.some((o) => o.optionId === ironheart) ? [ironheart] : [];
      }
      // Every response offered is taken, so a from-hand response that wrongly heard the play would resolve.
      if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
      return firstLegal(s);
    };
    const thwart = (using: EngineDeps) =>
      driveEventsPicking(using, state, pick, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state, P1),
        schemeInstanceId: id,
      });
    const responded = (events: readonly GameEvent[]) =>
      events.filter((e) => e.type === "abilityResolved" && String(e.abilityId) === "13018.ironheart-response");
    const { state: after, events } = thwart(withIronheart);
    expect(playerOf(after, P1).playArea).toContain(ironheart);
    expect(of(events, "cardPlayed").find((e) => e.instanceId === ironheart)).toMatchObject({ from: "deck" });
    expect(responded(events)).toEqual([]);
    // Control: the same response without "from your hand" answers the play.
    const printed = withIronheart.abilities["13018.ironheart-response"]!;
    const anyPlay: EngineDeps = {
      abilities: {
        ...withIronheart.abilities,
        "13018.ironheart-response": {
          ...printed,
          trigger: { kind: "response", forced: false, on: { on: "cardPlayed", selfIs: "target" } },
        },
      },
    };
    expect(responded(thwart(anyPlay).events)).toHaveLength(1);
  });

  it("[star] Boost: put this card into play (it starts with its threat)", () => {
    const state = heroForm(fantasyGame());
    const stacked = stackEncounterDeck(state, FETCH_QUEST, NO_BOOST);
    const { state: after, events } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    const [quest] = inPlay(after, FETCH_QUEST);
    expect(quest).toBeDefined();
    expect(inst(after, quest!).threat).toBe(6);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).not.toContain(FETCH_QUEST);
  });
});

describe("Mana Drain (39046)", () => {
  const twoPlayers = () =>
    fantasyGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    });
  /** Both players end their turns; P1 is dealt Mana Drain (the villain's two activations take a boost card each, first). */
  const reveal = (pick: Picker, state = heroForm(twoPlayers())) => {
    const stacked = stackEncounterDeck(state, NO_BOOST, "01186", MANA_DRAIN, "01186");
    return driveEventsPicking(
      deps,
      stacked,
      pick,
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    );
  };
  const choosing =
    (label: string): Picker =>
    (state) => {
      const hit = state.pendingChoice?.options.find((o) => o.label === label);
      return hit ? [hit.optionId] : firstLegal(state);
    };
  const icons = (state: GameState, id: InstanceId) =>
    (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons ?? {};

  /** Both players hold one card printing each type (and P1 a [wild] one), so the drain has something to find. */
  const staged = () => {
    // Iron Man's hero hand size is 1, so the players are Spider-Man and She-Hulk (hand size 5): nothing is discarded.
    const base = heroForm(
      fantasyGame({
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      }),
    );
    const p1 = moveToHand(base, P1, "01006", "01003", "01005"); // Aunt May [energy], Backflip [physical], Web Kick [mental]
    // P2's three and P1's fourth card are relabeled by surgery (War Machine prints only [wild]).
    const [e2, ph2, m2] = playerOf(p1.state, P2).deck.slice(0, 3) as [InstanceId, InstanceId, InstanceId];
    const spare = playerOf(p1.state, P1).deck[0]!;
    const relabel = (state: GameState, id: InstanceId, code: string) =>
      patchInstance(state, id, { cardId: cardId(code) });
    const relabeled = relabel(
      relabel(relabel(relabel(p1.state, e2, "01093"), ph2, "01003"), m2, "01005"),
      spare,
      "01030",
    );
    return {
      state: withHand(withHand(relabeled, P1, [...p1.ids, spare]), P2, [e2, ph2, m2]),
      p1: { energy: p1.ids[0]!, physical: p1.ids[1]!, mental: p1.ids[2]!, wild: spare },
      p2: { energy: e2, physical: ph2, mental: m2 },
    };
  };

  for (const type of ["Physical", "Mental", "Energy"] as const) {
    it(`chosen ${type}: each player draws 2, then discards each card in hand printing that resource`, () => {
      const key = type.toLowerCase() as "physical" | "mental" | "energy";
      const { state, p1, p2 } = staged();
      const { state: after, events } = reveal(choosing(type), state);
      const revealedAt = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === MANA_DRAIN);
      expect(revealedAt).toBeGreaterThanOrEqual(0);
      const drawn = of(events.slice(revealedAt), "cardDrawn");
      for (const player of [P1, P2]) expect(drawn.filter((e) => e.playerId === player)).toHaveLength(2);
      for (const player of [P1, P2]) {
        const hand = playerOf(after, player).hand;
        expect(hand.some((id) => (icons(after, id)[key] ?? 0) > 0)).toBe(false);
      }
      // The staged card of that type was discarded, the others stayed (a wild-only card is not of any type).
      expect(playerOf(after, P1).discard).toContain(p1[key]);
      expect(playerOf(after, P2).discard).toContain(p2[key]);
      for (const other of (["physical", "mental", "energy"] as const).filter((t) => t !== key)) {
        expect(playerOf(after, P1).hand).toContain(p1[other]);
        expect(playerOf(after, P2).hand).toContain(p2[other]);
      }
      expect(playerOf(after, P1).hand).toContain(p1.wild);
    });
  }

  it("the first option offered is Physical (the greedy default)", () => {
    const { state, p1, p2 } = staged();
    const { state: after } = reveal(firstLegal, state);
    expect(playerOf(after, P1).discard).toContain(p1.physical);
    expect(playerOf(after, P2).discard).toContain(p2.physical);
    expect(playerOf(after, P1).hand).toContain(p1.energy);
  });

  it("[star] Boost: the boosted player discards 1 card from their hand", () => {
    const { state } = staged();
    const end = (boost: string) =>
      driveEventsPicking(
        deps,
        stackEncounterDeck(state, boost, "01186", "32153", "32154"),
        firstLegal,
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      );
    const discards = (events: readonly GameEvent[]) =>
      of(events, "cardDiscardedFromHand").filter((e) => e.playerId === P1).length;
    expect(discards(end(MANA_DRAIN).events) - discards(end(NO_BOOST).events)).toBe(1);
  });
});
