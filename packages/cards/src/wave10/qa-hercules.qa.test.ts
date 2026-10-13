/**
 * Rules QA, wave 10 part 4: the Hercules hero pack (59001a to 59045 less 59025 Gilgamesh and 59032 Avengers Compound,
 * which are still skipped, and the heal amount of 59017 Prince of Power, which owner answer 31B is changing). Each test
 * cites the printed card, RRG 1.8 (page numbers are the printed ones), an FFG ruling (marvel-champions-rulings-post-
 * rrg-1-7.md, by date) or an owner answer (docs/phase7-wave10.md section 4.0). `it.fails` records a bug found (the test
 * states the printed behavior and fails today; flip it to `it` when the script is fixed); a plain `it` pins behavior the
 * audit confirmed beyond the module tests. Findings and the full audit: docs/phase7-wave10-qa-hercules.md.
 *
 * Staging: real commands against Core's Rhino with the hand-built Leadership deck `HERCULES_DECK` (there is no printed
 * decklist yet). Gifts and cards in play are placed by surgery where a test is about something else; a Labor card is
 * revealed for real (New Labors of Hercules) wherever its reveal is part of the test.
 */
import { HERCULES_CARDS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  legalActions,
  locateCard,
  playCostOf,
  replay,
  separateDeckOf,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import {
  DEFEAT_THE_HYDRA,
  EMBODY_PATHOS,
  GIFT,
  LERNEAN_HYDRA,
  PROTECT_HUMANITY,
  laborCodes,
  newLabors,
  theCard,
  withLaborOrder,
} from "../dsl/wave10-labor.testing.js";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { codeOf } from "../wave9/testing.js";
import {
  CORE_SPIDER_MAN,
  HERCULES_DECK,
  HERO_PACK_CARDS,
  WAVE10_DEPS as DEPS,
  engageMinion,
  heroPackSeat,
  herculesGame,
  stagedInPlay,
} from "./testing.js";

vi.setConfig({ testTimeout: 240_000 });

const ADVANCE = "01186"; // a Core treachery with no boost icon and no boost ability
const NEMEAN = "59005";
const SHIELD = "59006";
const SWORD = "59007";
const MACE = "59014";
const HELM = "59015";
const GAUNTLETS = "59013";
const ATONEMENT = ".atonement";
const PRINCE = ".prince-of-power-response";

/** What a prompt picker saw and what it was told to do (the planner of the earlier QA passes, plus what these tests need). */
interface Plan {
  /** Optional triggers to take (the id ends with one of these); every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Declare the hero the defender when asked (otherwise "no defense"). One-player games only. */
  readonly defend?: boolean;
  /** Every chooseTriggers window's offered ids, in order. */
  readonly windows?: string[][];
  /** Every offered trigger with the player it was offered to. */
  readonly offeredTo?: { player: string; id: string }[];
  /** A chooseOption label to pick (the first label starting with it). */
  readonly option?: string;
  /** A card code to pick on card prompts. */
  readonly card?: string;
  /** Answer card-choice prompts that allow it with nothing. */
  readonly declineCards?: boolean;
  /** Every prompt: kind and option labels. */
  readonly prompts?: string[];
  /** Only take triggers of attacks against this player. */
  readonly attackedPlayer?: string;
}
const planner =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    plan.prompts?.push(`${choice.prompt.kind}: ${choice.options.map((o) => o.label).join(" | ")}`);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        plan.windows?.push(offered);
        for (const id of offered) plan.offeredTo?.push({ player: choice.playerId as string, id });
        const ev = choice.prompt.event as { attackedPlayerId?: string };
        const wrongAttack = plan.attackedPlayer !== undefined && ev.attackedPlayerId !== plan.attackedPlayer;
        const hit = wrongAttack ? undefined : offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : offered.slice(0, choice.minSelections);
      }
      case "declareDefender":
        return plan.defend && offered.includes(identityOf(s) as string) ? [identityOf(s) as string] : ["decline"];
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      default: {
        if (plan.declineCards && choice.prompt.kind === "chooseCards" && choice.minSelections === 0) return [];
        const hit = plan.card
          ? choice.options.find((o) => o.ref.kind === "card" && codeOf(s, o.ref.instanceId) === plan.card)
          : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
    }
  };
const drive = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planner(plan), ...commands);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const offeredIn = (windows: readonly (readonly string[])[], ref: string): boolean =>
  windows.some((w) => w.some((o) => o.endsWith(ref)));

// ---------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------
const heroGame = (): GameState => withForm(herculesGame(), { heroForm: 0 });
const encounterPile = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
/** The top twelve encounter cards that are not Hercules's own made into Advance (no boost icon, no ability), so a boost card is harmless. */
function quiet(state: GameState): GameState {
  return activeEncounterDeck(state)
    .deck.slice(0, 12)
    .filter((id) => !codeOf(state, id).startsWith("59"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}
const giftDeck = (s: GameState): readonly InstanceId[] => separateDeckOf(s, P1, GIFT).deck;
/** Surgery: the Gift `code` taken out of the Gift deck and attached to the identity of `player`, under their control. */
function withGift(state: GameState, code: string): GameState {
  const id = giftDeck(state).find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state, P1);
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              [GIFT]: { ...p.separateDecks[GIFT]!, deck: p.separateDecks[GIFT]!.deck.filter((i) => i !== id) },
            },
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, { faceup: true, controllerId: P1, attachedTo: host });
  return patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] });
}
/** Surgery: `codes` on top of the Gift deck, in this order. */
function giftOrder(state: GameState, ...codes: readonly string[]): GameState {
  const top = codes.map((code) => giftDeck(state).find((id) => codeOf(state, id) === code)!);
  const rest = giftDeck(state).filter((id) => !top.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? { ...p, separateDecks: { ...p.separateDecks, [GIFT]: { deck: [...top, ...rest], discard: [] } } }
        : p,
    ),
  };
}
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });
const mainScheme = (s: GameState): InstanceId => s.mainScheme.instanceId;

/** Defeat the Hydra revealed for real (alter-ego form), then Hercules in hero form: the Lernean Hydra is the attached minion. */
function hydraBoard(extra: (s: GameState) => GameState = (s) => s) {
  const start = withLaborOrder(herculesGame(), DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
  const revealed = drive(start, { card: LERNEAN_HYDRA }, newLabors(start)).state;
  const hydra = theCard(revealed, LERNEAN_HYDRA);
  return { state: extra(withForm(revealed, { heroForm: 0 })), hydra };
}

/** Embody Pathos revealed for real on Olympic Feud (alter-ego form), then Hercules in hero form with `threat` on the scheme. */
function embodyBoard(threat: number) {
  const start = withLaborOrder(herculesGame(), EMBODY_PATHOS, PROTECT_HUMANITY, DEFEAT_THE_HYDRA);
  const scheme = theCard(start, "59038");
  const revealed = drive(start, { card: "59038" }, newLabors(start)).state;
  return { state: withForm(patchInstance(revealed, scheme, { threat }), { heroForm: 0 }), scheme };
}
/** `code` and the payers moved to the hand: the card, and the command that plays it paying with the payers. */
function handWith(state: GameState, code: string, ...payers: readonly string[]) {
  const given = moveToHand(state, P1, code, ...payers);
  const [id, ...paying] = given.ids as [InstanceId, ...InstanceId[]];
  return { state: given.state, id, command: play(P1, id, paying) };
}
const OLYMPUS = "59012";
const LION = "59016";

/** Hercules (P1, hero form) and Core's Spider-Man (P2, hero form) against Rhino. */
function twoPlayerGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: HERO_PACK_CARDS,
  } as never);
  const created = createGame({ ...config, players: [heroPackSeat(HERCULES_DECK), ...config.players] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(withForm(opened, { heroForm: 0 }), { heroForm: 0 }, P2);
}
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const basicAttack = (_s: GameState, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const text = (code: string): string => {
  const c = [...PLAYABLE_CARDS, ...HERO_PACK_CARDS].find((x) => (x.id as string) === code) as unknown as {
    text?: { current: string };
  };
  return (c?.text?.current ?? "").replace(/[:\s]+/g, " ").trim();
};
const playable = (s: GameState, id: InstanceId): boolean => {
  const actions = legalActions(s, P1, DEPS);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)
  );
};

// ---------------------------------------------------------------------------------------------------------------
// 59001a Atonement, 59001b New Labors of Hercules
// ---------------------------------------------------------------------------------------------------------------
describe("59001a Atonement against Prince of Power 59017: two triggering conditions, two response windows", () => {
  // Defeating the Hydra is one occurrence with two triggering conditions: a Labor card added to the victory display (a
  // Victory X attachment is added "when the attached card is defeated", RRG 'Victory X' p. 46) and "Hercules attacks and
  // defeats an enemy". RRG 'Triggering Condition' (p. 45) puts conditions of ONE occurrence in one window; the engine
  // opens the victory display's window first and Prince of Power's after. Pinned as a reading, not a ruling: it decides
  // whether a player can heal with Prince of Power and THEN flip with Atonement.
  function board() {
    const { state, hydra } = hydraBoard((s) => s);
    const hydraId = theCard(state, LERNEAN_HYDRA);
    const worn = stagedInPlay(patchInstance(state, hydraId, { damage: 11 }), "59017");
    return { state: worn.state, hydra };
  }
  const attack = (s: GameState, hydra: InstanceId) => basicAttack(s, identityOf(s), hydra);

  it("Atonement's window comes first and offers only it; taking the flip means Prince of Power (a Hero Response) is never offered", () => {
    const { state, hydra } = board();
    const windows: string[][] = [];
    const run = drive(state, { take: [ATONEMENT, PRINCE], option: "Flip", windows }, attack(state, hydra));
    expect(windows[0]).toEqual([expect.stringContaining(ATONEMENT)]);
    expect(offeredIn(windows, PRINCE)).toBe(false);
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
  });
  it("control: with the flip declined Prince of Power is offered in a later window", () => {
    const { state, hydra } = board();
    const windows: string[][] = [];
    const run = drive(state, { take: [ATONEMENT, PRINCE], option: "Do not", windows }, attack(state, hydra));
    const first = windows.findIndex((w) => w.some((o) => o.endsWith(ATONEMENT)));
    const second = windows.findIndex((w) => w.some((o) => o.endsWith(PRINCE)));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    expect(playerOf(run.state, P1).identity.form).toBe("hero");
  });
});

describe("59001b New Labors of Hercules: a Labor card that fails to find its target (RRG 1.8 FAQ p. 65; March 6, 2026 - Ruling 3 (2))", () => {
  it("59003 Embody Pathos with no encounter side scheme anywhere to find: discarded (announced) and on the bottom of the Labor deck; no Labor card is in play", () => {
    const start0 = withLaborOrder(herculesGame(), EMBODY_PATHOS, DEFEAT_THE_HYDRA, PROTECT_HUMANITY);
    const key = activeEncounterDeckId(start0);
    const pile = start0.encounterDecks[key]!;
    const isSide = (i: InstanceId) => start0.cardPool[start0.instances[i]!.cardId]?.type === "side_scheme";
    const bare: GameState = {
      ...start0,
      encounterSetAside: start0.encounterSetAside.filter((i) => !isSide(i)),
      encounterDecks: {
        ...start0.encounterDecks,
        [key]: { deck: pile.deck.filter((i) => !isSide(i)), discard: pile.discard.filter((i) => !isSide(i)) },
      },
      players: start0.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !isSide(i)) })),
    };
    const run = drive(bare, {}, newLabors(bare));
    expect(ofType(run.events, "revealedCardDiscarded")).toHaveLength(1);
    expect(laborCodes(run.state)).toEqual(["59002", "59004", "59003"]);
    expect(cardsInPlay(run.state)).not.toContain(theCard(run.state, EMBODY_PATHOS));
  });

  /** Protect Humanity on top; Cho is wherever `where` says (a set of surgery moves on his instance). */
  function protectHumanity(where: "hand" | "deck" | "removed") {
    const start0 = withLaborOrder(herculesGame(), PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS);
    const cho = playerOf(start0, P1).deck.find((i) => codeOf(start0, i) === "59008")!;
    const staged: GameState =
      where === "hand"
        ? moveToHand(start0, P1, "59008").state
        : where === "removed"
          ? {
              ...start0,
              removedFromGame: [...start0.removedFromGame, cho],
              players: start0.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== cho) })),
            }
          : start0;
    return { cho, run: drive(staged, {}, newLabors(staged)), start: staged };
  }

  it("59004 Protect Humanity: 'Find Amadeus Cho and put him into play' finds him in the hand (RRG 'Find' p. 19: every game area), with no shuffle", () => {
    const { cho, run } = protectHumanity("hand");
    expect(cardsInPlay(run.state)).toContain(cho);
    expect(ofType(run.events, "deckShuffled")).toHaveLength(0);
  });
  it("59004 Protect Humanity: Cho found in the deck puts him into play and shuffles the deck (RRG 'Search' p. 39)", () => {
    const { cho, run } = protectHumanity("deck");
    expect(cardsInPlay(run.state)).toContain(cho);
    expect(ofType(run.events, "deckShuffled")).toHaveLength(1);
  });
  it("59004 Protect Humanity with Amadeus Cho removed from the game (nothing to find): 'a labor card fails to find a target when it is revealed' is discarded and goes to the bottom of the Labor deck, never into play (RRG 1.8 FAQ p. 65)", () => {
    const { run, start } = protectHumanity("removed");
    const ph = theCard(run.state, PROTECT_HUMANITY);
    expect(cardsInPlay(run.state)).not.toContain(ph);
    expect(playerOf(run.state, P1).playArea).not.toContain(ph);
    // Answer 54B (2026-10-13; RRG 'Find' p. 19, "each game area where that card could be found"): an ally could be in
    // the player deck, which is searched and shuffled (RRG 'Search' p. 39), and in neither the Labor deck nor the Gift
    // deck, which are not looked through and keep their order.
    expect(ofType(run.events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "deck", playerId: P1 }]);
    expect(laborCodes(run.state)).toEqual(["59002", "59003", "59004"]);
    expect(playerOf(run.state, P1).separateDecks.Gift!.deck).toEqual(playerOf(start, P1).separateDecks.Gift!.deck);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 59002 Defeat the Hydra
// ---------------------------------------------------------------------------------------------------------------
describe("59002 Defeat the Hydra: 'cannot take damage except from Hercules's attacks'", () => {
  it("Retaliate is not an attack: Shield of Perseus's Retaliate 1 hurts the villain but not the minion wearing the Labor card (RRG 'Retaliate X' p. 38: a Forced Response that deals damage)", () => {
    const { state, hydra } = hydraBoard((s) => withGift(s, SHIELD));
    const run = drive(quiet(state), {}, endTurn());
    expect(ofType(run.events, "attackResolved").some((e) => e.enemyInstanceId === hydra)).toBe(true);
    expect(inst(run.state, hydra).damage).toBe(0);
    expect(inst(run.state, villain(run.state)).damage).toBe(1);
  });

  it("'Find ... Reveal it' on a minion already in play re-resolves its When Revealed (RRG 'Find' p. 19): Tweedledope (6 hit points, 'You are stunned') engaged with Hercules stuns him, and wears the Labor card", () => {
    const start0 = withLaborOrder(herculesGame(), DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const start = engageMinion(start0, "48037", "tweedledope", P1);
    const run = drive(start, { card: "48037" }, newLabors(start));
    const minion = "tweedledope" as InstanceId;
    expect(inst(run.state, minion).attachments).toEqual([theCard(run.state, DEFEAT_THE_HYDRA)]);
    expect(ofType(run.events, "revealedInPlay")).toHaveLength(1);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 59003 Embody Pathos
// ---------------------------------------------------------------------------------------------------------------
describe("59003 Embody Pathos: 'threat cannot be removed ... except by Hercules's thwarts'", () => {
  it("Wisdom of Athena is Hercules's thwart: it removes its 4 (assault changes only a BASIC thwart, RRG 'Assault' p. 8)", () => {
    const { state, scheme } = embodyBoard(8);
    const given = handWith(state, "59011", OLYMPUS, LION, LION);
    const run = drive(given.state, { card: "59038" }, given.command);
    expect(inst(run.state, scheme).threat).toBe(4);
  });

  it("Teamwork 59021 with Deathcry: the ally's power is added to HERCULES's thwart, so it is still his: assault makes the thwart use ATK (3), and the 'matching power' is Deathcry's ATK 3 (RRG 'Assault' p. 8, last bullet): 12 leaves 6", () => {
    const { state, scheme } = embodyBoard(12);
    const ally = stagedInPlay(state, "59018");
    const given = moveToHand(ally.state, P1, "59021");
    const run = drive(given.state, { take: [".teamwork-interrupt"] }, basicThwart(identityOf(given.state), scheme));
    expect(inst(run.state, ally.id).exhausted).toBe(true);
    expect(inst(run.state, scheme).threat).toBe(6);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 59004 Protect Humanity against Herc's Helm 59015
// ---------------------------------------------------------------------------------------------------------------
describe("59004 Protect Humanity: 'if Hercules defended' counts a defense-labeled ability (RRG 'Defend, Defense' p. 15)", () => {
  it("the villain's attack is redirected to Cho; Herc's Helm (Hero Interrupt (defense)) makes Hercules the defender, so the labor counter goes 3 to 2, Cho takes nothing and Hercules takes ATK 2 - 1 = 1 with no DEF", () => {
    const start0 = withLaborOrder(herculesGame(), PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS);
    const revealed = drive(start0, {}, newLabors(start0)).state;
    const obligation = theCard(revealed, PROTECT_HUMANITY);
    const cho = playerOf(revealed, P1).playArea.find((i) => codeOf(revealed, i) === "59008")!;
    const worn = stagedInPlay(withForm(revealed, { heroForm: 0 }), HELM, { attach: true });
    const run = drive(quiet(worn.state), { take: [".hercs-helm-interrupt"] }, endTurn());
    expect(inst(run.state, obligation).counters.labor).toBe(2);
    expect(inst(run.state, cho).damage).toBe(0);
    const [attack] = ofType(run.events, "attackResolved");
    expect(attack).toMatchObject({
      targetInstanceId: identityOf(run.state),
      baseAtk: 1,
      defenseReduction: 0,
      damageDealt: 1,
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 59005 to 59007 the Gift cards
// ---------------------------------------------------------------------------------------------------------------
describe("59007 Sword of Peleus (Permanent, Restricted) with two other Restricted cards in play (RRG 'Restricted' p. 38, 'Permanent' p. 32)", () => {
  it("the third Restricted card is a Gift put into play by Atonement: the player must discard down to two, and the Permanent Sword is not one of the cards offered to discard", () => {
    // Golden Mace 59014 and Excelsior 56045 (a Protection upgrade with Restricted) are in play; Sword of Peleus comes next.
    const base = herculesGame();
    const lion = playerOf(base, P1).deck.find((i) => codeOf(base, i) === LION)!;
    const retagged = patchInstance(base, lion, { cardId: cardId("56045") });
    const start = withLaborOrder(retagged, DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const revealed = drive(start, { card: LERNEAN_HYDRA }, newLabors(start)).state;
    const mace = stagedInPlay(withForm(revealed, { heroForm: 0 }), MACE, { attach: true });
    const excelsior = stagedInPlay(mace.state, "56045", { attach: true });
    const hydra = theCard(excelsior.state, LERNEAN_HYDRA);
    const brink = giftOrder(patchInstance(excelsior.state, hydra, { damage: 11 }), SWORD);
    const prompts: string[] = [];
    const run = drive(
      brink,
      { take: [ATONEMENT], option: "Do not", prompts },
      basicAttack(brink, identityOf(brink), hydra),
    );
    const discard = prompts.find((p) => p.startsWith("discardRestricted"))!;
    expect(discard).toContain("Golden Mace");
    expect(discard).toContain("Excelsior");
    expect(discard).not.toContain("Sword of Peleus");
    const sword = theCard(run.state, SWORD);
    expect(locateCard(run.state, sword)).toEqual({ kind: "attachment", hostInstanceId: identityOf(run.state) });
  });
});

describe("59005 Nemean Lion Skin: Hercules gains steady (RRG 'Steady' p. 41)", () => {
  const stunnedAttack = (s: GameState) => {
    const hero = identityOf(s);
    return drive(withStatus(s, hero, "stunned"), {}, basicAttack(s, hero, villain(s)));
  };
  it("with steady, one stunned status card does not stun him: his basic attack happens (3 damage) and the card stays", () => {
    const s = withGift(heroGame(), NEMEAN);
    const run = stunnedAttack(s);
    expect(inst(run.state, villain(s)).damage).toBe(3);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
  });
  it("control: without it the same stunned card replaces the attack and is discarded (RRG 'Stun' p. 41)", () => {
    const s = heroGame();
    const run = stunnedAttack(s);
    expect(inst(run.state, villain(s)).damage).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Events 59009 to 59011
// ---------------------------------------------------------------------------------------------------------------
describe("59009 The Gift of Battle and 59011 Wisdom of Athena are an attack and a thwart by Hercules (RRG 'Stun' p. 41, 'Confuse')", () => {
  it("a stunned Hercules plays The Gift of Battle: the stunned card is discarded instead, no damage is dealt, the event is spent", () => {
    const base = heroGame();
    const hero = identityOf(base);
    const given = handWith(withStatus(base, hero, "stunned"), "59009", OLYMPUS, LION, LION);
    const run = drive(given.state, {}, given.command);
    expect(inst(run.state, villain(base)).damage).toBe(0);
    expect(inst(run.state, hero).statuses.stunned).toBe(0);
    expect(playerOf(run.state, P1).discard).toContain(given.id);
  });
  it("a confused Hercules plays Wisdom of Athena: the confused card is discarded instead, no threat is removed, the event is spent", () => {
    const base = heroGame();
    const hero = identityOf(base);
    const threatened = patchInstance(withStatus(base, hero, "confused"), mainScheme(base), { threat: 3 });
    const given = handWith(threatened, "59011", OLYMPUS, LION, LION);
    const run = drive(given.state, {}, given.command);
    expect(inst(run.state, mainScheme(base)).threat).toBe(3);
    expect(inst(run.state, hero).statuses.confused).toBe(0);
    expect(playerOf(run.state, P1).discard).toContain(given.id);
  });
});

describe("59011 Wisdom of Athena against a scheme with no threat (RRG 'Target' p. 42; 'Cost' pp. 13 to 14: a cost cannot be paid without a valid target)", () => {
  it("not playable while no scheme has threat on it, playable with 1 threat on the main scheme", () => {
    const base = heroGame();
    const quietBoard = patchInstance(base, mainScheme(base), { threat: 0 });
    const noThreat = moveToHand(quietBoard, P1, "59011");
    expect(playable(noThreat.state, noThreat.ids[0]!)).toBe(false);
    const oneThreat = moveToHand(patchInstance(base, mainScheme(base), { threat: 1 }), P1, "59011");
    expect(playable(oneThreat.state, oneThreat.ids[0]!)).toBe(true);
  });
  it("59045 Roving Mobs prints the crisis icon (RRG 'Crisis Icon' p. 14): with it in play only the side scheme is offered, not the main scheme", () => {
    const base = heroGame();
    const mobs = activeEncounterDeck(base).deck[0]!;
    const asMobs = patchInstance(base, mobs, { cardId: cardId("59045"), threat: 3, faceup: true });
    const key = activeEncounterDeckId(asMobs);
    const pile = asMobs.encounterDecks[key]!;
    const inPlay: GameState = {
      ...asMobs,
      villainArea: [...asMobs.villainArea, mobs],
      encounterDecks: { ...asMobs.encounterDecks, [key]: { ...pile, deck: pile.deck.filter((i) => i !== mobs) } },
    };
    const given = handWith(patchInstance(inPlay, mainScheme(base), { threat: 5 }), "59011", OLYMPUS, LION, LION);
    const run = drive(given.state, {}, given.command);
    expect(inst(run.state, mainScheme(base)).threat).toBe(5);
    expect(inst(run.state, mobs).threat).toBe(0);
  });
});

describe("59010 Son of Zeus: the three bullets are independent", () => {
  it("with all three Gifts ready, the bullet that readies an upgrade has nothing to ready, and the tough status card and the card still come", () => {
    const base = [NEMEAN, SHIELD, SWORD].reduce(withGift, heroGame());
    const hero = identityOf(base);
    const given = handWith(base, "59010", OLYMPUS, LION);
    const deck0 = playerOf(given.state, P1).deck.length;
    const run = drive(patchInstance(given.state, hero, { exhausted: true }), {}, given.command);
    expect(inst(run.state, hero).exhausted).toBe(false);
    expect(inst(run.state, hero).statuses.tough).toBe(1);
    expect(deck0 - playerOf(run.state, P1).deck.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Upgrades 59013 to 59015, Deathcry 59018
// ---------------------------------------------------------------------------------------------------------------
describe("59015 Herc's Helm (Hero Interrupt (defense)) and 59013 Gauntlets of Hercules (RRG 'Defend, Defense' p. 15)", () => {
  it("'abilities that trigger when your hero defends can be triggered when resolving a defense-labeled ability': after the Helm makes him the defender Gauntlets is offered; Retaliate 1 (Shield) + 1 (one Gift) = 2 damage to Rhino; Hercules takes ATK 2 - 1 = 1", () => {
    const worn = stagedInPlay(stagedInPlay(withGift(heroGame(), SHIELD), HELM, { attach: true }).state, GAUNTLETS, {
      attach: true,
    });
    const windows: string[][] = [];
    const run = drive(
      quiet(worn.state),
      { take: [".hercs-helm-interrupt", ".gauntlets-of-hercules-interrupt"], windows },
      endTurn(),
    );
    expect(offeredIn(windows, ".gauntlets-of-hercules-interrupt")).toBe(true);
    expect(inst(run.state, villain(run.state)).damage).toBe(2);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(1);
  });

  it("the Helm reads 'When the villain attacks' (no 'you'): offered for an attack on another player, it makes Hercules the defender and the new target (RRG 'Attack (Enemy Activation)' p. 8)", () => {
    const worn = stagedInPlay(twoPlayerGame(), HELM, { attach: true });
    const offeredTo: { player: string; id: string }[] = [];
    const first = drive(quiet(worn.state), { offeredTo }, endTurn(P1));
    const run = drive(first.state, { take: [".hercs-helm-interrupt"], attackedPlayer: "p2", offeredTo }, endTurn(P2));
    expect(offeredTo.filter((o) => o.id.endsWith(".hercs-helm-interrupt")).map((o) => o.player)).toEqual(["p1", "p1"]);
    const attacks = ofType([...first.events, ...run.events], "attackResolved");
    expect(attacks).toHaveLength(2);
    expect(attacks[1]).toMatchObject({ targetInstanceId: identityOf(run.state, P1), baseAtk: 1, damageDealt: 1 });
  });
});

describe("59014 Golden Mace and 59018 Deathcry: a stunned attacker and a prevented cost", () => {
  it("a stunned Hercules attempting a basic attack is not 'making' one (RRG 'Stun' p. 41): Golden Mace is not offered and stays ready", () => {
    const worn = stagedInPlay(heroGame(), MACE, { attach: true });
    const hero = identityOf(worn.state);
    const windows: string[][] = [];
    const run = drive(
      withStatus(worn.state, hero, "stunned"),
      { take: [".golden-mace-interrupt"], windows },
      basicAttack(worn.state, hero, villain(worn.state)),
    );
    expect(offeredIn(windows, ".golden-mace-interrupt")).toBe(false);
    expect(inst(run.state, worn.id).exhausted).toBe(false);
    expect(inst(run.state, villain(worn.state)).damage).toBe(0);
  });

  it("'deal your hero 1 damage' is a cost that counts as paid even if prevented (RRG 'Cost' p. 14): a tough status card on Hercules is spent, he takes none, and Deathcry still takes 1 instead of 2 consequential damage", () => {
    const base = heroGame();
    const hero = identityOf(base);
    const ally = stagedInPlay(withStatus(base, hero, "tough"), "59018");
    const run = drive(
      ally.state,
      { take: [".deathcry-interrupt"] },
      basicAttack(ally.state, ally.id, villain(ally.state)),
    );
    expect(inst(run.state, hero).statuses.tough).toBe(0);
    expect(inst(run.state, hero).damage).toBe(0);
    expect(inst(run.state, ally.id).damage).toBe(1);
    expect(inst(run.state, villain(base)).damage).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Leadership and basic cards
// ---------------------------------------------------------------------------------------------------------------
describe("59024 \"Avenge Me!\" attached to another player's ally (RRG 'Ownership and Control' p. 31)", () => {
  /** Spider-Man's player (P2) controls Deathcry with 3 damage, "Avenge Me!" (played by P1) attached; Rhino's attack on P2 is defended by her. */
  function run(take: boolean) {
    let s = twoPlayerGame();
    const card = playerOf(s, P2).deck[0]!;
    s = patchInstance(s, card, { cardId: cardId("59018") });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P2 ? { ...p, deck: p.deck.filter((i) => i !== card), playArea: [...p.playArea, card] } : p,
      ),
    };
    s = patchInstance(s, card, { faceup: true, controllerId: P2, damage: 3 });
    const worn = stagedInPlay(s, "59024", { attach: true });
    // Moved from P1's identity to the ally (what playing it attached to that ally leaves behind).
    let t = patchInstance(worn.state, identityOf(worn.state), { attachments: [] });
    t = patchInstance(t, worn.id, { attachedTo: card });
    t = patchInstance(t, card, { attachments: [worn.id] });
    const offeredTo: { player: string; id: string }[] = [];
    const plan = planner({ take: take ? [".avenge-me-interrupt"] : [], offeredTo });
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "declareDefender" && c.playerId === P2 && c.options.some((o) => o.optionId === card))
        return [card];
      return plan(st);
    };
    const afterP1 = driveEventsPicking(DEPS, quiet(t), pick, endTurn(P1)).state;
    const result = driveEventsPicking(DEPS, afterP1, pick, endTurn(P2)).state;
    return { state: result, card, offeredTo };
  }
  it("an upgrade attached to a card another player controls is controlled by that player: the ally's controller is offered the Interrupt, and draws the 2 cards", () => {
    const taken = run(true);
    const declined = run(false);
    const avenge = taken.offeredTo.filter((o) => o.id.endsWith("avenge-me-interrupt"));
    expect(avenge.map((o) => o.player)).toEqual(["p2"]);
    expect(cardsInPlay(taken.state)).not.toContain(taken.card);
    expect(playerOf(taken.state, P2).hand.length - playerOf(declined.state, P2).hand.length).toBe(2);
    expect(playerOf(taken.state, P1).hand.length).toBe(playerOf(declined.state, P1).hand.length);
  });
});

describe("the Avenger trait is read off the face that is up (RRG 'Form, Change Form' p. 21): Hercules's alter ego prints only Olympus", () => {
  it("59028 Evaluate Threat ('Play only if your identity has the Avenger or S.H.I.E.L.D. trait') is not playable in alter-ego form, and is in hero form", () => {
    const a = moveToHand(herculesGame(), P1, "59028");
    const h = moveToHand(heroGame(), P1, "59028");
    expect(playable(a.state, a.ids[0]!)).toBe(false);
    expect(playable(h.state, h.ids[0]!)).toBe(true);
  });
});

describe("59028 Evaluate Threat: 'Each player MAY search their deck and discard pile'", () => {
  function defeated(takeACard: boolean) {
    const base = heroGame();
    const scheme = playerOf(base, P1).deck.find((i) => codeOf(base, i) === "59028")!;
    const inPlay: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== scheme) })),
      villainArea: [...base.villainArea, scheme],
    };
    const state = patchInstance(inPlay, scheme, { faceup: true, threat: 1, controllerId: P1 });
    const run = drive(state, takeACard ? {} : { option: "Do not" }, basicThwart(identityOf(state), scheme));
    const shuffles = ofType(run.events, "deckShuffled").filter(
      (e) => (e.zone as unknown as { kind?: string }).kind === "deck",
    );
    return { shuffles: shuffles.length, hand: playerOf(run.state, P1).hand.length };
  }
  it("a player who takes a card searched the deck: it is shuffled once (RRG 'Search' p. 39)", () => {
    expect(defeated(true).shuffles).toBe(1);
  });
  it("a player who declines the search searched nothing, so nothing is shuffled (RRG 'Search' p. 39: 'If any portion of a deck is searched ... shuffle')", () => {
    expect(defeated(false).shuffles).toBe(0);
  });
});

describe("the reprints that alias another card's script print the same rules text (colons aside)", () => {
  const PAIRS: readonly (readonly [string, string])[] = [
    ["59021", "06032"], // Teamwork
    ["59022", "40018"], // Call for Backup
    ["59027", "31023"], // Limitless Stamina
    ["59033", "01092"], // Helicarrier
    ["59034", "08023"], // Quincarrier
  ];
  for (const [reprint, source] of PAIRS)
    it(`${reprint} prints ${source}'s text`, () => {
      expect(text(reprint)).not.toBe("");
      expect(text(reprint)).toBe(text(source));
    });
});

// ---------------------------------------------------------------------------------------------------------------
// Nemesis set and All Versus All
// ---------------------------------------------------------------------------------------------------------------
describe("59040 God of War reveals a minion: the owner's answer 30B, a revealed minion resolves its When Revealed before Quickstrike (RRG 'Quickstrike' p. 36)", () => {
  it("with no minion in play the discarded minion is Hellcat 56079 (Quickstrike; 'When Revealed: You are stunned'): Hercules is stunned first, then Hellcat's quickstrike attack resolves", () => {
    const base = heroGame();
    const deck = activeEncounterDeck(base).deck;
    const stacked = [ADVANCE, "59040", "56079"].reduce(
      (acc, code, n) => patchInstance(acc, deck[n]!, { cardId: cardId(code) }),
      base,
    );
    const run = drive(stacked, {}, endTurn());
    const stunned = run.events.findIndex((e) => e.type === "statusGiven" && e.status === "stunned");
    const attacked = run.events.findIndex(
      (e) => e.type === "attackResolved" && codeOf(run.state, e.enemyInstanceId) === "56079",
    );
    expect(stunned).toBeGreaterThanOrEqual(0);
    expect(attacked).toBeGreaterThan(stunned);
  });
});

describe("59044 Bewitched Officer's attacks gain ranged, and a ranged attack ignores Retaliate (RRG 'Ranged' p. 36)", () => {
  it("Shield of Perseus's Retaliate 1 hurts Rhino when he attacks Hercules but not the Officer, whose attack also lands in full (ATK 3)", () => {
    const base = withGift(heroGame(), SHIELD);
    const withOfficer = engageMinion(base, "59044", "officer", P1);
    const run = drive(quiet(withOfficer), {}, endTurn());
    expect(inst(run.state, "officer" as InstanceId).damage).toBe(0);
    expect(inst(run.state, villain(run.state)).damage).toBe(1);
    const officer = ofType(run.events, "attackResolved").find((e) => (e.enemyInstanceId as string) === "officer");
    expect(officer).toMatchObject({ baseAtk: 3, damageDealt: 3 });
  });
});

// Owner answer 43B (2026-10-12, docs/phase7-wave10.md section 4.0), the audit's question Q1: a card that was not in
// play when a triggering condition occurred does not answer it (RRG 1.8 "Triggering Condition", p. 45; "Response",
// p. 38). Before it, the built answer A had All Versus All answer the defeat that revealed it (6 threat).
describe("59041 All Versus All against 59042 Hecate's When Defeated: a card that enters play during the defeat (owner question Q1 = B)", () => {
  it("All Versus All, found and revealed by Hecate's When Defeated, was not in play when she was defeated, so it does not answer her defeat: 2 + 2 Hinder = 4", () => {
    const base = heroGame();
    const top = activeEncounterDeck(base).deck[0]!;
    const withAva = patchInstance(base, top, { cardId: cardId("59041") });
    const hecate = patchInstance(engageMinion(withAva, "59042", "hecate", P1), "hecate" as InstanceId, { damage: 3 });
    const hecateId = "hecate" as InstanceId;
    const run = drive(hecate, {}, basicAttack(hecate, identityOf(hecate), hecateId));
    const ava = cardsInPlay(run.state).find((i) => codeOf(run.state, i) === "59041")!;
    expect(inst(run.state, ava).threat).toBe(4);
    // The trace says why: her defeat lists the card that came into play after it.
    const defeat = run.events.find(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterDefeated",
    );
    expect(defeat).toMatchObject({ event: { instanceId: hecateId, enteredPlaySince: [ava] } });
  });

  it("the next character defeated finds it in play: 2 more threat (4 + 2 = 6)", () => {
    const base = heroGame();
    const top = activeEncounterDeck(base).deck[0]!;
    const withAva = patchInstance(base, top, { cardId: cardId("59041") });
    const staged = patchInstance(engageMinion(withAva, "59042", "hecate", P1), "hecate" as InstanceId, { damage: 3 });
    const first = drive(staged, {}, basicAttack(staged, identityOf(staged), "hecate" as InstanceId)).state;
    const again = patchInstance(
      patchInstance(engageMinion(first, "01184", "modok", P1), "modok" as InstanceId, { damage: 7 }),
      identityOf(first),
      { exhausted: false },
    );
    const run = drive(again, {}, basicAttack(again, identityOf(again), "modok" as InstanceId));
    const ava = cardsInPlay(run.state).find((i) => codeOf(run.state, i) === "59041")!;
    expect(inst(run.state, ava).threat).toBe(6);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A scripted full game
// ---------------------------------------------------------------------------------------------------------------
describe("Hercules (hand-built Leadership deck) against Core's Rhino, seed 1: a scripted game, invariants after every command", () => {
  let session: GameSession;
  let state: GameState;
  /** Logged segments: a replay of each from its first state must end where the segment ended. */
  const segments: { readonly log: GameSession["log"]; readonly end: GameState }[] = [];
  const formChanges = new Map<number, number>();

  /** Hercules's own six cards, the Labor and Gift decks' contents. */
  const KIT = ["59002", "59003", "59004", "59005", "59006", "59007"];
  const HERC_OWNED = (s: GameState): InstanceId[] =>
    (Object.keys(s.instances) as InstanceId[]).filter((i) => s.instances[i]!.ownerId === P1);

  /** Throws on the first broken invariant of `s`. */
  function check(s: GameState, where: string): void {
    const fail = (message: string): never => {
      throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
    };
    const choice = s.pendingChoice;
    if (choice) {
      if (choice.minSelections > choice.options.length) fail(`soft lock: ${choice.prompt.kind}`);
    } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
      fail("the game stopped between steps with nothing pending");
    }
    const lists: [string, readonly InstanceId[]][] = [];
    for (const p of s.players) {
      lists.push([`${p.playerId} hand`, p.hand], [`${p.playerId} deck`, p.deck], [`${p.playerId} discard`, p.discard]);
      lists.push([`${p.playerId} playArea`, p.playArea], [`${p.playerId} setAside`, p.setAside]);
      for (const [name, piles] of Object.entries(p.separateDecks))
        lists.push([`${p.playerId} ${name} deck`, piles.deck], [`${p.playerId} ${name} discard`, piles.discard]);
    }
    for (const [name, piles] of Object.entries(s.encounterDecks))
      lists.push([`encounter ${name} deck`, piles.deck], [`encounter ${name} discard`, piles.discard]);
    lists.push(["villainArea", s.villainArea], ["victoryDisplay", s.victoryDisplay], ["removed", s.removedFromGame]);
    lists.push(["encounterSetAside", s.encounterSetAside]);
    const seen = new Map<InstanceId, string>();
    for (const [name, ids] of lists)
      for (const id of ids) {
        if (seen.has(id)) fail(`${id} is in two zones: ${seen.get(id)}, ${name}`);
        seen.set(id, name);
      }
    for (const id of HERC_OWNED(s)) if (locateCard(s, id) === null) fail(`${codeOf(s, id)} (${id}) is in no zone`);
    // The six cards of the two separate decks: each exists once, owned by Hercules's player, and the decks never gain a card.
    for (const code of KIT) {
      const ids = (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
      if (ids.length !== 1) fail(`${ids.length} copies of ${code}`);
      if (s.instances[ids[0]!]!.ownerId !== P1) fail(`${code} is not owned by the Hercules player`);
    }
    const laborInPlay = cardsInPlay(s).filter((i) => ["59002", "59003", "59004"].includes(codeOf(s, i)));
    if (laborInPlay.length > 1) fail(`${laborInPlay.length} Labor cards in play`);
    const giftsInPlay = cardsInPlay(s).filter((i) => [NEMEAN, SHIELD, SWORD].includes(codeOf(s, i)));
    const giftCount = giftsInPlay.length + separateDeckOf(s, P1, GIFT).deck.length;
    if (giftCount !== 3) fail(`the Gift cards add up to ${giftCount}`);
    for (const [id, i] of Object.entries(s.instances)) if (i.damage < 0) fail(`${id} has negative damage`);
  }

  /** Runs commands, answering each prompt by `plan`, through the session log; checks the invariants after each. */
  const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
    const events: GameEvent[] = [];
    const settleOne = (where: string) => {
      while (state.pendingChoice && !state.outcome) {
        const choice = state.pendingChoice;
        const r = sessionApply(
          session,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: planner(plan)(state),
          },
          DEPS,
        );
        if (!r.ok) throw new Error(r.error.message);
        session = r.session;
        state = r.session.state;
        events.push(...r.events);
        check(state, `${where} (choice)`);
      }
    };
    settleOne("pending");
    for (const command of commands) {
      if (command.type === "changeForm") formChanges.set(state.round, (formChanges.get(state.round) ?? 0) + 1);
      const r = sessionApply(session, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      session = r.session;
      state = r.session.state;
      events.push(...r.events);
      check(state, command.type);
      settleOne(command.type);
    }
    return events;
  };
  /** Test-only surgery: closes the logged segment and opens the next one from the changed state. */
  const surgery = (next: GameState) => {
    segments.push({ log: session.log, end: state });
    state = next;
    session = startSession(next);
  };
  const handId = (code: string): InstanceId => {
    const id = playerOf(state, P1).hand.find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in hand`);
    return id;
  };
  const inPlayId = (code: string): InstanceId => {
    const id = cardsInPlay(state).find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in play`);
    return id;
  };
  const hero = (): InstanceId => identityOf(state);
  const rhino = (): InstanceId => state.activeVillainId!;
  const dmg = (id: InstanceId): number => inst(state, id).damage;
  const give = (...codes: string[]) => surgery(moveToHand(state, P1, ...codes).state);
  const price = (code: string): number => playCostOf(state, P1, handId(code), DEPS)?.current ?? -1;

  it("setup: alter-ego form, hand of 6, the Labor and Gift decks facedown with three cards each, quiet board", () => {
    state = quiet(herculesGame());
    session = startSession(state);
    check(state, "start");
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(laborCodes(state).sort()).toEqual(["59002", "59003", "59004"]);
    expect(giftDeck(state)).toHaveLength(3);
  });

  it("round 1, alter ego: New Labors reveals Defeat the Hydra, which finds the Lernean Hydra (12 hit points, Elite); a second use is refused", () => {
    surgery(withLaborOrder(state, DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS));
    act({ card: LERNEAN_HYDRA }, newLabors(state));
    const hydra = theCard(state, LERNEAN_HYDRA);
    expect(inst(state, hydra)).toMatchObject({ engagedWith: P1, attachments: [theCard(state, DEFEAT_THE_HYDRA)] });
    expect(laborCodes(state)).toEqual(["59004", "59003"]);
    expect(applyCommand(state, newLabors(state), DEPS).ok).toBe(false);
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("round 1, hero form: Gauntlets attached; Hercules attacks the Hydra at the brink: defeated, Defeat the Hydra in the victory display, Atonement gives Nemean Lion Skin (draw 4), the flip declined", () => {
    const hydra = theCard(state, LERNEAN_HYDRA);
    surgery(giftOrder(patchInstance(state, hydra, { damage: 9 }), NEMEAN, SHIELD, SWORD));
    give(GAUNTLETS);
    act({}, play(P1, handId(GAUNTLETS), [], { attachToInstanceId: hero() }));
    const handBefore = playerOf(state, P1).hand.length;
    act({ take: [ATONEMENT, ".nemean-lion-skin-response"], option: "Do not" }, basicAttack(state, hero(), hydra));
    expect(state.victoryDisplay.map((i) => codeOf(state, i))).toEqual(["59002"]);
    expect(cardsInPlay(state)).not.toContain(hydra);
    expect(inPlayId(NEMEAN)).toBeDefined();
    expect(playerOf(state, P1).hand.length).toBe(handBefore + 4);
    expect(inst(state, hero()).exhausted).toBe(false);
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("round 1, villain phase: he readied at the end of the player phase and does not defend: Rhino's ATK 2 lands (RRG 'End of Player Phase' p. 18)", () => {
    surgery(quiet(state));
    act({}, endTurn());
    expect(state.round).toBe(2);
    expect(dmg(hero())).toBe(2);
    expect(inst(state, hero()).exhausted).toBe(false);
  });

  it("round 2: Olympus pays for Golden Mace (one Gift: one wild resource); Wisdom of Athena costs 3 - 1 and removes 4 threat from the main scheme", () => {
    give(OLYMPUS, MACE);
    act({}, play(P1, handId(OLYMPUS)));
    const olympus = inPlayId(OLYMPUS);
    act(
      {},
      play(P1, handId(MACE), [], {
        attachToInstanceId: hero(),
        abilities: [resourceAbility(olympus, "59012.olympus-resource")],
      }),
    );
    expect(inst(state, olympus).exhausted).toBe(true);
    surgery(moveToHand(patchInstance(state, mainScheme(state), { threat: 4 }), P1, "59011", LION, LION).state);
    expect(price("59011")).toBe(2);
    const lions = playerOf(state, P1).hand.filter((i) => codeOf(state, i) === LION);
    act({}, play(P1, handId("59011"), lions.slice(0, 2)));
    expect(inst(state, mainScheme(state)).threat).toBe(0);
  });

  it("round 2, villain phase: Appeal to Athena is revealed and kept in his play area; the Gift count is 0, so The Gift of Battle costs its full 3", () => {
    give("59009");
    expect(price("59009")).toBe(2);
    const ordered = quiet(state);
    const deck = activeEncounterDeck(ordered).deck;
    const appeal = deck.find((i) => codeOf(ordered, i) === "59035")!;
    const filler = deck.find((i) => i !== appeal && codeOf(ordered, i) === ADVANCE)!;
    surgery({
      ...ordered,
      encounterDecks: {
        ...ordered.encounterDecks,
        [activeEncounterDeckId(ordered)]: {
          ...encounterPile(ordered),
          deck: [filler, appeal, ...deck.filter((i) => i !== appeal && i !== filler)],
        },
      },
    });
    act({}, endTurn());
    expect(state.round).toBe(3);
    expect(playerOf(state, P1).playArea).toContain(theCard(state, "59035"));
    expect(price("59009")).toBe(3);
  });

  it("round 3: he flips to alter ego and pays Appeal to Athena's Alter-Ego Action by exhausting himself: it leaves the game and the Gift count is back to 1", () => {
    act({}, changeForm());
    const appeal = theCard(state, "59035");
    act({}, use(P1, appeal, "59035.appeal-to-athena-action", [], undefined, { branch: 0 }));
    expect(state.removedFromGame).toContain(appeal);
    expect(inst(state, hero()).exhausted).toBe(true);
    expect(price("59009")).toBe(2);
  });

  it("round 3: New Labors again (Protect Humanity on top): Amadeus Cho is found and put into play, the obligation sits in his play area with 3 labor counters", () => {
    surgery(withLaborOrder(state, PROTECT_HUMANITY, EMBODY_PATHOS));
    act({}, newLabors(state));
    const ph = theCard(state, PROTECT_HUMANITY);
    expect(playerOf(state, P1).playArea).toContain(ph);
    expect(inst(state, ph).counters.labor).toBe(3);
    expect(inst(state, inPlayId("59008"))).toMatchObject({ faceup: true });
  });

  it("round 3, villain phase: Rhino schemes against the alter ego (nothing is redirected: Protect Humanity answers an attack only)", () => {
    surgery(quiet(state));
    const before = inst(state, theCard(state, PROTECT_HUMANITY)).counters.labor;
    act({}, endTurn());
    expect(state.round).toBe(4);
    expect(inst(state, theCard(state, PROTECT_HUMANITY)).counters.labor).toBe(before);
  });

  it("round 4: back in hero form his basic attack with Golden Mace deals 4 (ATK 3 + 1 Gift); Rhino's attack is then redirected to Cho and Hercules defends it: one labor counter is removed", () => {
    act({}, changeForm());
    const before = dmg(rhino());
    act({ take: [".golden-mace-interrupt"] }, basicAttack(state, hero(), rhino()));
    expect(dmg(rhino()) - before).toBe(4);
    surgery(quiet(state));
    const ph = theCard(state, PROTECT_HUMANITY);
    act({ defend: true }, endTurn());
    expect(inst(state, ph).counters.labor).toBe(2);
    expect(inst(state, inPlayId("59008")).damage).toBe(0);
  });

  it("every card is accounted for, at most one Labor card is in play and the Gift cards add up to 3 (checked after every command above)", () => {
    check(state, "end");
    expect(state.outcome).toBeFalsy();
    expect(Math.max(0, ...formChanges.values())).toBeLessThanOrEqual(1);
  });

  it("every logged segment replays from its own first state, command by command, to the state it ended in (deep-equal)", () => {
    const all = [...segments, { log: session.log, end: state }];
    expect(all.length).toBeGreaterThan(5);
    for (const { log, end } of all) {
      const replayed = replay(log, DEPS);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(end);
    }
    expect(all.reduce((n, seg) => n + seg.log.commands.length, 0)).toBeGreaterThan(20);
  });
});

// A data check the audit leans on: the alter ego prints only the Olympus trait (scan 59001b), the hero Avenger and Olympus.
describe("data the audit leans on", () => {
  it("59001a prints Avenger and Olympus; 59001b prints Olympus only", () => {
    const card = HERCULES_CARDS.find((c) => (c.id as string) === "59001a") as unknown as {
      hero: { traits: string[] };
      alterEgo: { traits: string[] };
    };
    expect(card.hero.traits.map(String).sort()).toEqual(["AVENGER", "OLYMPUS"]);
    expect(card.alterEgo.traits.map(String)).toEqual(["OLYMPUS"]);
  });
});
