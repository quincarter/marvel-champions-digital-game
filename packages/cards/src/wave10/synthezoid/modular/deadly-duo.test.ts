import { CORE_CARDS, cardId, encounterSetId, trait } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  SINGLE_TEAM,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  revealedCodes,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay } from "../../testing.js";
import { SYNTHEZOID_MODULAR_DEADLY_DUO, SYNTHEZOID_MODULAR_DEADLY_DUO_SKIPPED } from "./deadly-duo.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Deadly Duo modular set (57027 Jester, 57028 Jack O'Lantern, 57029 Mad Jack's Platform, 57030 Jester's Yo-Yo,
 * 57031 Deadly Duo), docs/phase7-synthezoid.md section 8.3. The pack is gated and its leader scenarios are not
 * scripted yet, so the set is tested inside Core's Rhino scenario against Core starter decks with the set's cards added
 * to the encounter deck by hand (the Hell's Kitchen test's setup; `ungatedStageGame` plays a Civil War deck that holds
 * none of this set). There "the enemy leader" is Rhino (FFG ruling July 9, 2026).
 */
const JESTER = "57027";
const JACK = "57028";
const PLATFORM = "57029";
const YOYO = "57030";
const DUO = "57031";
const SET = [JESTER, JACK, PLATFORM, YOYO, DUO];
const SHOCKER = "01103"; // Core minion: ATK 2, SCH 1, 3 hit points
const MERCENARY = "01101"; // Core minion: ATK 1, SCH 0
const BLANK_B = "01104"; // Hard to Keep Down: no boost icon
const REFS = [
  "57027.when-revealed",
  "57028.when-revealed",
  "57029.mad-jacks-platform-constant",
  "57029.mad-jacks-platform-constant-2",
  "57029.boost",
  "57030.when-revealed",
  "57030.boost",
  "57031.when-defeated",
];
const deps = WAVE10_DEPS;

type Loose = Record<string, unknown>;
const dataOf = (code: string) => WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Loose;
const coreOf = (code: string) => CORE_CARDS.find((c) => (c.id as string) === code)! as unknown as Loose;
const typeOfCode = (code: string): string => coreOf(code).type as string;
const costOfCode = (code: string): number => (coreOf(code).cost as number | undefined) ?? 0;

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;

/** Rhino's game against the Core decks (hero form) with one copy of each of the set's cards in the encounter deck. */
function game(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("deadly_duo")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: Rhino's boost, then the rest). */
const villainPhase = (state: GameState, stack: readonly string[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );

/** `player`'s deck with the first card of each of these Core types on top, in order, the rest below. */
function deckTopTypes(state: GameState, player: PlayerId, ...wanted: readonly string[]): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const used: InstanceId[] = [];
  for (const type of wanted) {
    const id = owner.deck.find((i) => !used.includes(i) && typeOfCode(codeOf(state, i)) === type);
    if (!id) throw new Error(`no ${type} left in the deck`);
    used.push(id);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: [...used, ...p.deck.filter((i) => !used.includes(i))] } : p,
    ),
  };
}
const deckOf = (s: GameState, player: PlayerId) => s.players.find((p) => p.playerId === player)!.deck;
const discardOf = (s: GameState, player: PlayerId) => s.players.find((p) => p.playerId === player)!.discard;
/** Both players' discard piles (a card staged under P2 keeps P1 as its owner, so it is discarded to P1's pile). */
const anyDiscard = (s: GameState) => [...discardOf(s, P1), ...discardOf(s, P2)];
const damageOn = (s: GameState, player: PlayerId) => inst(s, identityOf(s, player)).damage;
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, deps)!;
const optionIds = (s: GameState) => s.pendingChoice!.options.map((o) => o.optionId).sort();

/** Answers the pending choice as `player` with `optionId`, then every later choice with the first legal option. */
function answer(state: GameState, player: PlayerId, optionId: string) {
  const choice = state.pendingChoice!;
  const picked = applyCommand(
    state,
    { type: "resolveChoice", playerId: player, choiceId: choice.choiceId, selectedOptionIds: [optionId] },
    deps,
  );
  if (!picked.ok) throw new Error(picked.error.message);
  const rest = driveEventsPicking(deps, picked.state, firstLegal);
  return rest.state;
}

/** Every player ends the turn; choices take the first legal option until a target or host prompt is asked. */
function villainPhaseAsked(state: GameState, stack: readonly string[]): GameState {
  let current = stackEncounterDeck(state, ...stack);
  const apply = (command: Command): void => {
    const result = applyCommand(current, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    current = result.state;
  };
  for (const player of state.players) {
    for (let guard = 0; guard < 100 && current.pendingChoice; guard++) {
      const choice = current.pendingChoice;
      if (choice.prompt.kind === "chooseTarget" || choice.prompt.kind === "chooseAttachmentTarget") return current;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    apply(endTurn(player.playerId));
  }
  for (let guard = 0; guard < 100 && current.pendingChoice; guard++) {
    const choice = current.pendingChoice;
    if (choice.prompt.kind === "chooseTarget" || choice.prompt.kind === "chooseAttachmentTarget") return current;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: firstLegal(current),
    });
  }
  return current;
}

describe("registry", () => {
  it("scripts every ref the data names, none skipped, each valid", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_DEADLY_DUO).sort()).toEqual([...REFS].sort());
    expect(SYNTHEZOID_MODULAR_DEADLY_DUO_SKIPPED).toEqual({});
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_DEADLY_DUO)) {
      expect(validateDefinition(def), id).toEqual([]);
    }
    const fromData = SET.flatMap((code) => [...abilityRefIds(dataOf(code) as never)]);
    expect(fromData.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const trig = (ref: string) => SYNTHEZOID_MODULAR_DEADLY_DUO[ref]!.trigger;
    expect(trig("57027.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    expect(trig("57028.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    expect(trig("57029.mad-jacks-platform-constant")).toMatchObject({ kind: "cannotAttach" });
    expect(trig("57029.mad-jacks-platform-constant-2")).toMatchObject({ kind: "constant" });
    expect(trig("57029.boost")).toMatchObject({ kind: "boost" });
    expect(trig("57030.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    expect(trig("57030.boost")).toMatchObject({ kind: "boost" });
    expect(trig("57031.when-defeated")).toMatchObject({ kind: "whenDefeated" });
  });

  it("the encounter deck holds the set's five cards once each", () => {
    const s = game();
    for (const code of SET) {
      expect(
        Object.values(s.instances).filter((i) => (i.cardId as string) === code),
        code,
      ).toHaveLength(1);
    }
  });
});

describe("Jester (57027)", () => {
  it("is data: a unique Thunderbolt minion, ATK 2, SCH 1, 3 hit points, 2 boost icons", () => {
    const card = dataOf(JESTER);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      2,
      1,
      3,
      2,
      true,
    ]);
    expect(card.traits).toEqual([trait("THUNDERBOLT")]);
  });

  it("WHEN REVEALED: discards the top 3 and takes 1 indirect damage per different card type", () => {
    const staged = deckTopTypes(game(), P1, "ally", "event", "upgrade");
    const milled = deckOf(staged, P1).slice(0, 3);
    const control = villainPhase(staged, [BLANK, BLANK]);
    const run = villainPhase(staged, [BLANK, JESTER, BLANK]);
    expect(revealedCodes(run.state, run.events)).toContain(JESTER);
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(control.state, P1).length - 3);
    for (const id of milled) expect(discardOf(run.state, P1)).toContain(id);
    expect(damageOn(run.state, P1) - damageOn(control.state, P1)).toBe(3);
  });

  it("three cards of one type are one indirect damage", () => {
    const staged = deckTopTypes(game(), P1, "ally", "ally", "ally");
    const control = villainPhase(staged, [BLANK, BLANK]);
    const run = villainPhase(staged, [BLANK, JESTER, BLANK]);
    expect(damageOn(run.state, P1) - damageOn(control.state, P1)).toBe(1);
  });

  it("a deck of two cards discards both and counts their types (RRG 1.8 'Player Deck', p. 33)", () => {
    const staged = deckTopTypes(game(), P1, "ally", "event");
    const two = { ...staged, players: staged.players.map((p) => ({ ...p, deck: p.deck.slice(0, 2) })) } as GameState;
    const control = villainPhase(two, [BLANK, BLANK]);
    const run = villainPhase(two, [BLANK, JESTER, BLANK]);
    expect(damageOn(run.state, P1) - damageOn(control.state, P1)).toBe(2);
  });
});

/** The threat Jack O'Lantern's own When Revealed placed (events whose source is the revealed Jack). */
const threatFromJack = (run: { state: GameState; events: readonly GameEvent[] }) => {
  const jack = Object.values(run.state.instances).find((i) => (i.cardId as string) === JACK)!.instanceId;
  return run.events
    .filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced")
    .filter((e) => e.sourceInstanceId === jack)
    .map((e) => ({ scheme: e.schemeInstanceId, amount: e.amount }));
};

describe("Jack O'Lantern (57028)", () => {
  it("is data: a unique Thunderbolt minion, ATK 1, SCH 2, 3 hit points, 2 boost icons", () => {
    const card = dataOf(JACK);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      1,
      2,
      3,
      2,
      true,
    ]);
    expect(card.traits).toEqual([trait("THUNDERBOLT")]);
  });

  it("WHEN REVEALED: discards the top 3 and places 1 threat on the main scheme per different card type", () => {
    const staged = deckTopTypes(game(), P1, "ally", "event", "upgrade");
    const control = villainPhase(staged, [BLANK, BLANK]);
    const run = villainPhase(staged, [BLANK, JACK, BLANK]);
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(control.state, P1).length - 3);
    expect(threatFromJack(run)).toEqual([{ scheme: run.state.mainScheme.instanceId, amount: 3 }]);
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1));
  });

  it("two allies and an event are 2 threat", () => {
    const run = villainPhase(deckTopTypes(game(), P1, "ally", "ally", "event"), [BLANK, JACK, BLANK]);
    expect(threatFromJack(run).map((t) => t.amount)).toEqual([2]);
  });

  it("three cards of one type are 1 threat", () => {
    const run = villainPhase(deckTopTypes(game(), P1, "ally", "ally", "ally"), [BLANK, JACK, BLANK]);
    expect(threatFromJack(run).map((t) => t.amount)).toEqual([1]);
  });
});

describe("Mad Jack's Platform (57029)", () => {
  it("is data: a Tech attachment for a minion, +1 ATK and +1 SCH, enemy team's choice of host, a boost star", () => {
    const card = dataOf(PLATFORM);
    expect([card.type, card.statModifiers, card.boostIcons, card.starIcon, card.attachesTo]).toEqual([
      "attachment",
      { atk: 1, sch: 1 },
      0,
      true,
      { kind: "minion" },
    ]);
    expect(card.hostChosenBy).toBe("enemyTeam");
    expect(card.traits).toEqual([trait("TECH")]);
  });

  it("WHEN REVEALED with no minion in play: it cannot attach, gains surge (the next card is revealed too), is discarded", () => {
    const run = villainPhase(game(), [BLANK, PLATFORM, FILLER_A, FILLER_B]);
    expect(revealedCodes(run.state, run.events)).toEqual([PLATFORM, FILLER_A]);
    expect(inPlayCard(run.state, PLATFORM)).toBeUndefined();
    expect(inDiscard(run.state, PLATFORM)).toHaveLength(1);
  });

  it("WHEN REVEALED with one minion in play: it attaches to it and does not surge", () => {
    const start = engageMinion(game(), SHOCKER, "shocker");
    const run = villainPhase(start, [BLANK, PLATFORM, FILLER_A]);
    expect(attachedCodes(run.state, "shocker" as InstanceId)).toEqual([PLATFORM]);
    expect(revealedCodes(run.state, run.events)).toEqual([PLATFORM]);
  });

  it("OF THE ENEMY TEAM'S CHOICE: with two minions the first player is asked, as the enemy team, not the revealer", () => {
    const start = engageMinion(
      engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2),
      MERCENARY,
      "mercenary",
      P2,
    );
    const asked = villainPhaseAsked(start, [BLANK, BLANK_B, FILLER_A, PLATFORM, FILLER_B]);
    const choice = asked.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseAttachmentTarget");
    expect(choice.playerId).toBe(P1);
    expect(choice.authority).toBe("enemyTeam");
    expect(choice.onBehalfOf).toEqual({ kind: "enemyTeam", teamId: SINGLE_TEAM, facingPlayerId: P2 });
    expect(optionIds(asked)).toEqual(["mercenary", "shocker"]);
    const done = answer(asked, P1, "mercenary");
    expect(attachedCodes(done, "mercenary" as InstanceId)).toEqual([PLATFORM]);
    expect(attachedCodes(done, "shocker" as InstanceId)).toEqual([]);
  });

  it("CONSTANT: the attached minion has +4 hit points, +1 ATK, +1 SCH and stalwart; another minion does not", () => {
    const start = engageMinion(engageMinion(game(), SHOCKER, "shocker"), MERCENARY, "mercenary");
    const shocker = "shocker" as InstanceId;
    const before = profile(start, shocker);
    expect(hasKeyword(start, shocker, "stalwart", deps)).toBe(false);
    const host = answer(villainPhaseAsked(start, [BLANK, PLATFORM, FILLER_A]), P1, "shocker");
    const after = profile(host, shocker);
    expect(attachedCodes(host, shocker)).toEqual([PLATFORM]);
    expect([after.maxHp - before.maxHp, after.atk - before.atk, after.sch - before.sch]).toEqual([4, 1, 1]);
    expect(hasKeyword(host, shocker, "stalwart", deps)).toBe(true);
    const other = "mercenary" as InstanceId;
    expect(hasKeyword(host, other, "stalwart", deps)).toBe(false);
    expect(profile(host, other).maxHp).toBe(profile(start, other).maxHp);
  });

  it("BOOST: it is attached to a minion engaged with you", () => {
    const start = engageMinion(game(), SHOCKER, "shocker");
    const run = villainPhase(start, [PLATFORM, FILLER_A]);
    expect(attachedCodes(run.state, "shocker" as InstanceId)).toEqual([PLATFORM]);
    expect(inDiscard(run.state, PLATFORM)).toHaveLength(0);
  });

  it("BOOST on P2's attack: the first player P1 chooses among the minions engaged with P2", () => {
    const start = engageMinion(
      engageMinion(game([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker", P2),
      MERCENARY,
      "mercenary",
      P2,
    );
    const asked = villainPhaseAsked(start, [BLANK_B, PLATFORM, FILLER_A]);
    expect(asked.pendingChoice!.playerId).toBe(P1);
    expect(optionIds(asked)).toEqual(["mercenary", "shocker"]);
    const done = answer(asked, P1, "shocker");
    expect(attachedCodes(done, "shocker" as InstanceId)).toEqual([PLATFORM]);
  });

  it("BOOST with no minion engaged with you: it stays unattached and is discarded as a boost card", () => {
    const run = villainPhase(game(), [PLATFORM, FILLER_A]);
    expect(inPlayCard(run.state, PLATFORM)).toBeUndefined();
    expect(inDiscard(run.state, PLATFORM)).toHaveLength(1);
  });
});

/** The first card of P1's (deck or discard) matching `pick`, put into play under P1's control. */
function inPlay(state: GameState, pick: (code: string) => boolean) {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const id = [...owner.deck, ...owner.discard].find((i) => pick(codeOf(state, i)));
  if (!id) throw new Error("no such card in the deck");
  return stagedInPlay(state, codeOf(state, id));
}
/** Surgery: the staged card changed hands to P2 (control and play area). */
function toP2(staged: { state: GameState; id: InstanceId }) {
  const { state, id } = staged;
  return {
    id,
    state: {
      ...patchInstance(state, id, { controllerId: P2 }),
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== id) }
          : p.playerId === P2
            ? { ...p, playArea: [...p.playArea, id] }
            : p,
      ),
    } as GameState,
  };
}
/** Surgery: the staged card becomes Hercules' permanent upgrade 59005 (cost 0). */
const permanent = (staged: { state: GameState; id: InstanceId }) => ({
  id: staged.id,
  state: patchInstance(staged.state, staged.id, { cardId: cardId("59005") }),
});
const ZONES = ["ally", "support", "upgrade"];

describe("Jester's Yo-Yo (57030)", () => {
  it("is data: a treachery with a boost star and no boost icon", () => {
    const card = dataOf(YOYO);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 0, true]);
  });

  it("WHEN REVEALED: discards the highest-cost card you control, and only that one", () => {
    const cheap = inPlay(game(), (c) => ZONES.includes(typeOfCode(c)) && costOfCode(c) === 1);
    const dear = inPlay(cheap.state, (c) => ZONES.includes(typeOfCode(c)) && costOfCode(c) >= 3);
    const run = villainPhase(dear.state, [BLANK, YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).toContain(dear.id);
    expect(discardOf(run.state, P1)).not.toContain(cheap.id);
    expect(revealedCodes(run.state, run.events)).toEqual([YOYO]);
    expect(inDiscard(run.state, YOYO)).toHaveLength(1);
  });

  it("WHEN REVEALED with a tie for highest cost: P2 reveals, the first player P1 is asked (RRG 'First Player', p. 19)", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const one = toP2(inPlay(start, (c) => ZONES.includes(typeOfCode(c)) && costOfCode(c) === 2));
    const two = toP2(
      inPlay(one.state, (c) => ZONES.includes(typeOfCode(c)) && costOfCode(c) === 2 && c !== codeOf(one.state, one.id)),
    );
    const asked = villainPhaseAsked(two.state, [BLANK, BLANK_B, FILLER_A, YOYO, FILLER_B]);
    expect(asked.pendingChoice!.playerId).toBe(P1);
    expect(optionIds(asked)).toEqual([one.id, two.id].sort());
    const done = answer(asked, P1, two.id);
    expect(anyDiscard(done)).toContain(two.id);
    expect(anyDiscard(done)).not.toContain(one.id);
  });

  it("WHEN REVEALED with only a permanent card you control: it is not a target, so the card gains surge", () => {
    const perm = permanent(inPlay(game(), (c) => typeOfCode(c) === "upgrade"));
    const run = villainPhase(perm.state, [BLANK, YOYO, FILLER_A, FILLER_B]);
    expect(revealedCodes(run.state, run.events)).toEqual([YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).not.toContain(perm.id);
  });

  it("WHEN REVEALED with a permanent card and a cost-1 or dearer card: the non-permanent one is discarded", () => {
    const perm = permanent(inPlay(game(), (c) => typeOfCode(c) === "upgrade"));
    const plain = inPlay(perm.state, (c) => ZONES.includes(typeOfCode(c)) && costOfCode(c) >= 1);
    const run = villainPhase(plain.state, [BLANK, YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).toContain(plain.id);
    expect(discardOf(run.state, P1)).not.toContain(perm.id);
    expect(revealedCodes(run.state, run.events)).toEqual([YOYO]);
  });

  it("WHEN REVEALED with nothing you control that has a cost: it gains surge", () => {
    const run = villainPhase(game(), [BLANK, YOYO, FILLER_A, FILLER_B]);
    expect(revealedCodes(run.state, run.events)).toEqual([YOYO, FILLER_A]);
  });

  it("BOOST: discards an upgrade you control, not an ally", () => {
    const ally = inPlay(game(), (c) => typeOfCode(c) === "ally");
    const upgrade = inPlay(ally.state, (c) => typeOfCode(c) === "upgrade");
    const run = villainPhase(upgrade.state, [YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).toContain(upgrade.id);
    expect(discardOf(run.state, P1)).not.toContain(ally.id);
  });

  it("BOOST on P2's attack: the first player P1 chooses among P2's upgrades", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const one = toP2(inPlay(start, (c) => typeOfCode(c) === "upgrade"));
    const two = toP2(inPlay(one.state, (c) => typeOfCode(c) === "upgrade" && c !== codeOf(one.state, one.id)));
    const asked = villainPhaseAsked(two.state, [BLANK_B, YOYO, FILLER_A]);
    expect(asked.pendingChoice!.playerId).toBe(P1);
    expect(optionIds(asked)).toEqual([one.id, two.id].sort());
    const done = answer(asked, P1, one.id);
    expect(anyDiscard(done)).toContain(one.id);
    expect(anyDiscard(done)).not.toContain(two.id);
  });

  it("BOOST: a permanent upgrade is not discarded", () => {
    const perm = permanent(inPlay(game(), (c) => typeOfCode(c) === "upgrade"));
    const run = villainPhase(perm.state, [YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).not.toContain(perm.id);
  });

  it("BOOST with no upgrade: nothing is discarded", () => {
    const ally = inPlay(game(), (c) => typeOfCode(c) === "ally");
    const run = villainPhase(ally.state, [YOYO, FILLER_A]);
    expect(discardOf(run.state, P1)).not.toContain(ally.id);
  });
});

describe("Deadly Duo (57031)", () => {
  it("is data: a crisis side scheme with 3 base threat, 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(DUO);
    expect([card.type, card.startingThreat, card.boostIcons, card.icons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      ["crisis"],
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("WHEN DEFEATED: each player discards the top 8 cards of their deck", () => {
    const placed = encounterCardInVillainArea(game([SPIDER_MAN, CAPTAIN_MARVEL]), DUO, 1);
    const before = [deckOf(placed.state, P1).length, deckOf(placed.state, P2).length];
    const run = heroThwarts(deps, placed.state, placed.id);
    expect([deckOf(run.state, P1).length, deckOf(run.state, P2).length]).toEqual([before[0]! - 8, before[1]! - 8]);
  });

  it("does nothing while it stands: a thwart that leaves threat discards no cards", () => {
    const placed = encounterCardInVillainArea(game(), DUO, 3);
    const run = heroThwarts(deps, placed.state, placed.id);
    expect(inst(run.state, placed.id).threat).toBeLessThan(3);
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(placed.state, P1).length);
  });
});
