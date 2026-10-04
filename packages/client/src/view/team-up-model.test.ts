import { beforeAll, describe, expect, test } from "vitest";
import { getInstance, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { POOL_CARDS } from "../content/pool.js";
import { SessionStore } from "../store/session-store.js";
import {
  activeTeamUps,
  observeTeamUps,
  resumedGame,
  teamUpDetail,
  teamUpProviders,
  poolTeamUpPairs,
  seatLabel,
  teamUpNoticeFor,
  teamUpWhyNot,
  presentTeamUps,
  ringLabel,
  teamUpWaitingSeats,
  teamUpStatus,
  teamUpRoleOf,
  teamUpTagFor,
  teamUpPairsOf,
} from "./team-up-model.js";

const PAIRS = teamUpPairsOf(POOL_CARDS);
const GAMBIT_ROGUE = PAIRS.find((pair) => pair.key === "gambit-rogue")!;

const config = (...decks: string[]): SessionConfig => ({
  scenarioId: "rhino",
  difficulty: "standard",
  players: decks.map((starterDeckId) => ({ starterDeckId })),
  seed: 5,
});

async function startGame(...decks: string[]): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config(...decks));
  return store.state.game!;
}

/** Puts the card `cardId` from `player`'s own deck into their play area, as an ally they control. */
function withAllyInPlay(game: GameState, player: PlayerId, cardId: string): GameState {
  const owner = game.players.find((p) => p.playerId === player)!;
  const id = Object.values(game.instances).find((i) => i.cardId === cardId && i.ownerId === player)!
    .instanceId as InstanceId;
  const strip = (list: readonly InstanceId[]): InstanceId[] => list.filter((other) => other !== id);
  const players = game.players.map((p) =>
    p.playerId === owner.playerId
      ? { ...p, hand: strip(p.hand), deck: strip(p.deck), playArea: [...strip(p.playArea), id] }
      : p,
  );
  const instance = { ...getInstance(game, id)!, controllerId: player };
  return { ...game, players, instances: { ...game.instances, [id]: instance } };
}

/** Flips every seat to hero form: a Team-Up names Gambit, not Remy LeBeau, and an identity counts as the face showing. */
function heroForms(game: GameState): GameState {
  return {
    ...game,
    players: game.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
}

describe("teamUpPairsOf", () => {
  test("finds each pair once, from the keyword's names", () => {
    expect(PAIRS.filter((pair) => pair.key === "gambit-rogue")).toHaveLength(1);
    expect(GAMBIT_ROGUE.label).toBe("Gambit and Rogue");
    expect(PAIRS.length).toBeGreaterThan(3);
  });
});

describe("activeTeamUps", () => {
  let both: GameState;
  let gambitSolo: GameState;
  let rogueSolo: GameState;
  let spiderSolo: GameState;

  beforeAll(async () => {
    both = heroForms(await startGame("gambit-justice", "rogue-protection"));
    gambitSolo = heroForms(await startGame("gambit-justice"));
    rogueSolo = await startGame("rogue-protection");
    spiderSolo = await startGame("core-spider-man-justice");
  });

  test("alter-ego faces do not count: the keyword names Gambit and Rogue, not Remy LeBeau and Anna Marie", async () => {
    const atSetup = await startGame("gambit-justice", "rogue-protection");
    expect(activeTeamUps(atSetup, PAIRS)).toEqual([]);
  });

  test("both identities in hero form: active", () => {
    expect(activeTeamUps(both, PAIRS).map((pair) => pair.key)).toEqual(["gambit-rogue"]);
  });

  test("an identity and an ally that player controls: active", () => {
    expect(activeTeamUps(gambitSolo, PAIRS)).toEqual([]);
    const withRogue = withAllyInPlay(gambitSolo, gambitSolo.players[0]!.playerId, "37002");
    expect(activeTeamUps(withRogue, PAIRS).map((pair) => pair.key)).toEqual(["gambit-rogue"]);
  });

  test("an ally under one player and an identity under another: active", async () => {
    const seats = heroForms(await startGame("gambit-justice", "core-spider-man-justice"));
    const [gambit, spider] = seats.players;
    expect(activeTeamUps(seats, PAIRS)).toEqual([]);
    const withRogue = withAllyInPlay(seats, gambit!.playerId, "37002");
    // Rogue is Gambit's own ally; moved to Spider-Man's table it is still a friendly character in play.
    const moved: GameState = {
      ...withRogue,
      players: withRogue.players.map((p) => ({
        ...p,
        playArea:
          p.playerId === spider!.playerId
            ? [
                ...p.playArea,
                ...withRogue.players[0]!.playArea.filter((id) => getInstance(withRogue, id)?.cardId === "37002"),
              ]
            : p.playArea.filter((id) => getInstance(withRogue, id)?.cardId !== "37002"),
      })),
    };
    expect(activeTeamUps(moved, PAIRS).map((pair) => pair.key)).toEqual(["gambit-rogue"]);
  });

  test("ally and ally under different players, with both identities in alter-ego form: active", async () => {
    const seats = await startGame("gambit-justice", "rogue-protection");
    const [gambit, rogue] = seats.players;
    expect(activeTeamUps(seats, PAIRS)).toEqual([]);
    const game = withAllyInPlay(withAllyInPlay(seats, gambit!.playerId, "37002"), rogue!.playerId, "38003");
    expect(activeTeamUps(game, PAIRS).map((pair) => pair.key)).toEqual(["gambit-rogue"]);
  });

  test("neither character in play: inactive", () => {
    expect(activeTeamUps(rogueSolo, PAIRS)).toEqual([]);
    expect(activeTeamUps(spiderSolo, PAIRS)).toEqual([]);
  });

  test("a pair irrelevant to the game is never reported, whatever else is in the pool", () => {
    const others = PAIRS.filter((pair) => pair.key !== "gambit-rogue");
    expect(others.length).toBeGreaterThan(0);
    expect(activeTeamUps(both, others)).toEqual([]);
    // Names nobody in this game carries, even though both could be "in play" by title elsewhere.
    expect(activeTeamUps(both, [{ names: ["Nobody", "Nowhere"], key: "nobody-nowhere", label: "x" }])).toEqual([]);
  });

  test("the pair leaves when the ally does", () => {
    const withRogue = withAllyInPlay(gambitSolo, gambitSolo.players[0]!.playerId, "37002");
    const gone: GameState = { ...withRogue, players: gambitSolo.players };
    expect(activeTeamUps(gone, PAIRS)).toEqual([]);
  });
});

describe("observeTeamUps", () => {
  const none = { resumed: false };

  test("the first state of a fresh game announces what is already active", () => {
    const { announce, watch } = observeTeamUps(null, [GAMBIT_ROGUE], none);
    expect(announce).toEqual([GAMBIT_ROGUE]);
    expect([...watch.shown]).toEqual(["gambit-rogue"]);
  });

  test("a resumed game's first state announces nothing, but later arrivals do", () => {
    const first = observeTeamUps(null, [GAMBIT_ROGUE], { resumed: true });
    expect(first.announce).toEqual([]);
    expect(observeTeamUps(first.watch, [GAMBIT_ROGUE], { resumed: true }).announce).toEqual([]);
    const fresh = observeTeamUps(null, [], { resumed: true });
    expect(observeTeamUps(fresh.watch, [GAMBIT_ROGUE], { resumed: true }).announce).toEqual([GAMBIT_ROGUE]);
  });

  test("a pair that becomes active mid-game is announced once, and not again after leaving and returning", () => {
    const start = observeTeamUps(null, [], none);
    const arrived = observeTeamUps(start.watch, [GAMBIT_ROGUE], none);
    expect(arrived.announce).toEqual([GAMBIT_ROGUE]);
    expect(observeTeamUps(arrived.watch, [GAMBIT_ROGUE], none).announce).toEqual([]);
    const left = observeTeamUps(arrived.watch, [], none);
    expect(left.announce).toEqual([]);
    expect(observeTeamUps(left.watch, [GAMBIT_ROGUE], none).announce).toEqual([]);
  });
});

describe("resumedGame", () => {
  test("a store whose version is ahead of its command trail was loaded from a save", () => {
    expect(resumedGame({ version: 12, commandTrail: [] })).toBe(true);
    expect(resumedGame({ version: 2, commandTrail: [{}, {}] })).toBe(false);
    expect(resumedGame({ version: 0, commandTrail: [] })).toBe(false);
  });
});

describe("teamUpDetail", () => {
  test("names the providers, the rule, and the Team-Up card with copies counted per seated deck", async () => {
    const seats = await startGame("gambit-justice", "rogue-protection");
    const game = withAllyInPlay(seats, seats.players[0]!.playerId, "37002");
    const seatName = (id: PlayerId): string => `Player ${game.players.findIndex((p) => p.playerId === id) + 1}`;
    const detail = teamUpDetail(
      {
        ...game,
        players: game.players.map((p, i) =>
          i === 1 ? { ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } } : p,
        ),
      },
      GAMBIT_ROGUE,
      POOL_CARDS,
      seatName,
    );
    expect(detail.title).toBe("Team-Up: Gambit and Rogue");
    expect(detail.rule).toContain("RRG 1.8 p. 43");
    // Rogue is both Player 2's hero and Player 1's ally; the identity is found first.
    expect(detail.providers).toEqual([
      { name: "Gambit", by: "Player 1's hero, in alter-ego form (Remy LeBeau)", showing: false },
      { name: "Rogue", by: "Player 2's hero, in hero form", showing: true },
    ]);
    expect(detail.cards.map((card) => card.name)).toEqual(["Beauty and the Thief"]);
    const [row] = detail.cards;
    expect(row!.cost).toBe("2");
    expect(row!.text).toContain("Deal 4 damage to an enemy");
    expect(row!.copies.length).toBeGreaterThan(0);
  });

  test("a Team-Up card in nobody's deck reads as none", async () => {
    const game = await startGame("core-spider-man-justice");
    const detail = teamUpDetail(game, GAMBIT_ROGUE, POOL_CARDS, () => "Player 1");
    expect(detail.cards[0]!.copies).toEqual(["none in this game's decks"]);
    expect(detail.providers.every((p) => p.by === "not in play")).toBe(true);
  });
});

describe("teamUpProviders", () => {
  test("both identities: each seat provides one", async () => {
    const game = heroForms(await startGame("gambit-justice", "rogue-protection"));
    expect(teamUpProviders(game, GAMBIT_ROGUE)).toEqual(game.players.map((p) => p.playerId));
  });

  test("solo with the partner as an ally: one seat, listed once", async () => {
    const solo = heroForms(await startGame("gambit-justice"));
    const game = withAllyInPlay(solo, solo.players[0]!.playerId, "37002");
    expect(teamUpProviders(game, GAMBIT_ROGUE)).toEqual([solo.players[0]!.playerId]);
  });

  test("a seat providing neither character is not listed", async () => {
    const game = heroForms(await startGame("gambit-justice", "core-spider-man-justice"));
    const withRogue = withAllyInPlay(game, game.players[0]!.playerId, "37002");
    expect(teamUpProviders(withRogue, GAMBIT_ROGUE)).toEqual([game.players[0]!.playerId]);
  });
});

/** Puts the first copy of `cardId` that `player` owns into their hand, whatever zone it was in. */
function withCardInHand(game: GameState, player: PlayerId, cardId: string): { game: GameState; id: InstanceId } {
  const id = Object.values(game.instances).find((i) => i.cardId === cardId && i.ownerId === player)!
    .instanceId as InstanceId;
  const strip = (list: readonly InstanceId[]): InstanceId[] => list.filter((other) => other !== id);
  const players = game.players.map((p) =>
    p.playerId === player
      ? { ...p, hand: [...strip(p.hand), id], deck: strip(p.deck), playArea: strip(p.playArea) }
      : p,
  );
  return { game: { ...game, players }, id };
}

const BEAUTY = "37019";
const ROGUE_ALLY = "37002";

describe("Team-Up roles, tags and the Inspect notice", () => {
  let two: GameState;
  let twoAlterEgos: GameState;
  let solo: GameState;

  beforeAll(async () => {
    twoAlterEgos = await startGame("gambit-justice", "rogue-protection");
    two = heroForms(twoAlterEgos);
    solo = heroForms(await startGame("gambit-justice"));
  });

  const pairsOf = (game: GameState) => poolTeamUpPairs(game);
  const card = (game: GameState, id: InstanceId) => game.cardPool[getInstance(game, id)!.cardId as string]!;

  test("a Team-Up card with its pair active: tagged, full when playable, quiet when not", () => {
    const { game, id } = withCardInHand(two, two.players[0]!.playerId, BEAUTY);
    const role = teamUpRoleOf(game, id, pairsOf(game));
    expect(role).toMatchObject({ kind: "teamUpCard", active: true });
    expect(teamUpTagFor(role, true)).toEqual({ text: "▶ Team-Up", go: true });
    expect(teamUpTagFor(role, false)).toEqual({ text: "Team-Up", go: false });
  });

  test("a Team-Up card with its pair present but not showing: the quiet tag, and the notice names the form needed", () => {
    const { game, id } = withCardInHand(twoAlterEgos, twoAlterEgos.players[0]!.playerId, BEAUTY);
    const role = teamUpRoleOf(game, id, pairsOf(game));
    expect(role).toMatchObject({ kind: "teamUpCard", active: false, present: true });
    expect(teamUpTagFor(role, false)).toEqual({ text: "Team-Up", go: false });
    const notice = teamUpNoticeFor(game, card(game, id), id, pairsOf(game))!;
    expect(notice.kind).toBe("needs");
    expect(notice.text).toBe("Team-Up: needs Gambit and Rogue in hero form.");
  });

  test("with one of the two in hero form the notice names only the other", () => {
    const flipped: GameState = {
      ...twoAlterEgos,
      players: twoAlterEgos.players.map((p, i) =>
        i === 0 ? { ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } } : p,
      ),
    };
    const { game, id } = withCardInHand(flipped, flipped.players[0]!.playerId, BEAUTY);
    const notice = teamUpNoticeFor(game, card(game, id), id, pairsOf(game))!;
    expect(notice.text).toBe("Team-Up: needs Rogue in hero form.");
  });

  test("a Team-Up card with a character absent gets no tag, and the notice names who is missing", async () => {
    const spider = await startGame("gambit-justice", "core-spider-man-justice");
    const { game, id } = withCardInHand(spider, spider.players[0]!.playerId, BEAUTY);
    const role = teamUpRoleOf(game, id, pairsOf(game));
    expect(role).toMatchObject({ kind: "teamUpCard", active: false, present: false });
    expect(teamUpTagFor(role, false)).toBeNull();
    const notice = teamUpNoticeFor(game, card(game, id), id, pairsOf(game))!;
    expect(notice.text).toBe("Team-Up: needs Gambit and Rogue both in play. Missing: Rogue.");
  });

  test("the engine's why-not is reworded when the character is in play on her alter-ego side", () => {
    const { game, id } = withCardInHand(twoAlterEgos, twoAlterEgos.players[0]!.playerId, BEAUTY);
    expect(teamUpWhyNot(game, id, "Team-Up needs Gambit and Rogue in play")).toBe(
      "Team-Up needs Gambit and Rogue in hero form",
    );
    expect(teamUpWhyNot(game, id, "not enough resources")).toBe("not enough resources");
    const hero = withCardInHand(two, two.players[0]!.playerId, BEAUTY);
    expect(teamUpWhyNot(hero.game, hero.id, "Team-Up needs Rogue in play")).toBe("Team-Up needs Rogue in play");
  });

  test("the active notice says so and names who provides each character", () => {
    const { game, id } = withCardInHand(two, two.players[0]!.playerId, BEAUTY);
    const notice = teamUpNoticeFor(game, card(game, id), id, pairsOf(game))!;
    expect(notice.kind).toBe("active");
    expect(notice.text).toBe("Team-Up active: Gambit and Rogue are both in play, so this card can be played.");
    expect(notice.lines).toEqual([
      `Gambit: ${seatLabel(game, game.players[0]!.playerId)}'s hero, in hero form.`,
      `Rogue: ${seatLabel(game, game.players[1]!.playerId)}'s hero, in hero form.`,
    ]);
  });

  test("with no game behind the sheet only the neutral rule line shows, and only on a Team-Up card", () => {
    const beauty = POOL_CARDS.find((c) => (c.id as string) === BEAUTY)!;
    expect(teamUpNoticeFor(null, beauty, null, [])).toMatchObject({
      kind: "needs",
      text: "Team-Up: needs Gambit and Rogue both in play.",
    });
    const rogue = POOL_CARDS.find((c) => (c.id as string) === ROGUE_ALLY)!;
    expect(teamUpNoticeFor(null, rogue, null, [])).toBeNull();
  });

  test("an ally in hand whose partner is in play completes the pair: tagged, with the Team-Up cards listed", () => {
    const { game, id } = withCardInHand(solo, solo.players[0]!.playerId, ROGUE_ALLY);
    const role = teamUpRoleOf(game, id, pairsOf(game));
    expect(role).toMatchObject({ kind: "completesPair", name: "Rogue", partner: "Gambit" });
    expect(teamUpTagFor(role, true)?.go).toBe(true);
    expect(teamUpTagFor(role, false)?.go).toBe(false);
    const notice = teamUpNoticeFor(game, card(game, id), id, pairsOf(game))!;
    expect(notice.kind).toBe("completes");
    expect(notice.text).toBe(
      "Team-Up: playing Rogue brings Gambit and Rogue together. Team-Up cards for this pair: Beauty and the Thief (in Gambit's deck: 1).",
    );
  });

  test("an ally whose partner is only in alter-ego form still completes the pair (present, not yet playable)", () => {
    const alterEgo = withCardInHand(
      { ...solo, players: solo.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })) },
      solo.players[0]!.playerId,
      ROGUE_ALLY,
    );
    expect(teamUpRoleOf(alterEgo.game, alterEgo.id, pairsOf(alterEgo.game))).toMatchObject({
      kind: "completesPair",
      partner: "Gambit",
    });
  });

  test("an ally whose partner is not in play either gets no tag and the neutral line", async () => {
    const seats = await startGame("gambit-justice", "core-spider-man-justice");
    // Gambit's seat is dropped (its Rogue ally card stays among the instances) and the ally goes to Spider-Man's hand.
    const spiderSolo: GameState = { ...seats, players: seats.players.slice(1) };
    const spiderSeat = spiderSolo.players[0]!.playerId;
    const rogueCard = Object.values(seats.instances).find((i) => i.cardId === ROGUE_ALLY)!;
    const rogueAlterEgo = withCardInHand(
      {
        ...spiderSolo,
        instances: { ...spiderSolo.instances, [rogueCard.instanceId]: { ...rogueCard, ownerId: spiderSeat } },
      },
      spiderSeat,
      ROGUE_ALLY,
    );
    const role = teamUpRoleOf(rogueAlterEgo.game, rogueAlterEgo.id, pairsOf(rogueAlterEgo.game));
    expect(role).toMatchObject({ kind: "needsPartner", partner: "Gambit" });
    expect(teamUpTagFor(role, true)).toBeNull();
    const notice = teamUpNoticeFor(
      rogueAlterEgo.game,
      card(rogueAlterEgo.game, rogueAlterEgo.id),
      rogueAlterEgo.id,
      pairsOf(rogueAlterEgo.game),
    )!;
    expect(notice.text).toBe("Team-Up with Gambit: needs both in play.");
  });

  test("once the ally is in play there is no tag, and an ordinary card has no role", () => {
    const inPlay = withAllyInPlay(solo, solo.players[0]!.playerId, ROGUE_ALLY);
    const id = inPlay.players[0]!.playArea.find((i) => getInstance(inPlay, i)?.cardId === ROGUE_ALLY)!;
    expect(teamUpRoleOf(inPlay, id, pairsOf(inPlay))).toBeNull();
    const ordinary = solo.players[0]!.hand[0]!;
    expect(teamUpRoleOf(solo, ordinary, pairsOf(solo))).toBeNull();
  });
});

describe("presentTeamUps: present in any form, playable only when both show the hero side", () => {
  const keys = (game: GameState) => presentTeamUps(game, PAIRS).map((s) => [s.pair.key, s.playable]);
  const presentPairs = (game: GameState) => presentTeamUps(game, PAIRS).map((s) => s.pair);
  const formOf = (game: GameState, index: number, form: "hero" | "alterEgo"): GameState => ({
    ...game,
    players: game.players.map((p, i) =>
      i === index ? { ...p, identity: { ...p.identity, form, ...(form === "hero" ? { heroFormIndex: 0 } : {}) } } : p,
    ),
  });
  let seats: GameState;

  beforeAll(async () => {
    seats = await startGame("gambit-justice", "rogue-protection");
  });

  test("two heroes: hero+hero is present and playable", () => {
    expect(keys(heroForms(seats))).toEqual([["gambit-rogue", true]]);
  });

  test("two heroes: hero+alter-ego is present but not playable, either way round", () => {
    expect(keys(formOf(heroForms(seats), 1, "alterEgo"))).toEqual([["gambit-rogue", false]]);
    expect(keys(formOf(heroForms(seats), 0, "alterEgo"))).toEqual([["gambit-rogue", false]]);
  });

  test("two heroes: alter-ego+alter-ego (the start of a game) is present but not playable", () => {
    expect(keys(seats)).toEqual([["gambit-rogue", false]]);
  });

  test("identity + ally: the identity counts by its hero title on either side", async () => {
    const solo = await startGame("gambit-justice");
    const withRogue = withAllyInPlay(solo, solo.players[0]!.playerId, ROGUE_ALLY);
    expect(keys(withRogue)).toEqual([["gambit-rogue", false]]);
    expect(keys(heroForms(withRogue))).toEqual([["gambit-rogue", true]]);
    expect(keys(solo)).toEqual([]);
  });

  test("ally + ally: always playable, whatever the identities show", () => {
    const one = withAllyInPlay(seats, seats.players[0]!.playerId, ROGUE_ALLY);
    expect(keys(withAllyInPlay(one, seats.players[1]!.playerId, "38003"))).toEqual([["gambit-rogue", true]]);
  });

  test("neither: nothing, and a pair whose characters are in no seated deck is never present", async () => {
    expect(keys(await startGame("core-spider-man-justice"))).toEqual([]);
    expect(presentTeamUps(heroForms(seats), [{ names: ["Nobody", "Nowhere"], key: "n", label: "x" }])).toEqual([]);
  });

  test("the splash fires once when the pair first becomes present, never again when it becomes playable", () => {
    const start = observeTeamUps(null, presentPairs(seats), { resumed: false });
    expect(start.announce.map((p) => p.key)).toEqual(["gambit-rogue"]);
    const flipped = observeTeamUps(start.watch, presentPairs(heroForms(seats)), { resumed: false });
    expect(flipped.announce).toEqual([]);
  });

  test("a resumed game's pair already present at load gets no splash", () => {
    expect(observeTeamUps(null, presentPairs(seats), { resumed: true }).announce).toEqual([]);
  });

  test("the panel names each character's form and ends with a one-line status", () => {
    const seatName = (id: PlayerId): string => seatLabel(seats, id);
    const quiet = teamUpDetail(formOf(heroForms(seats), 1, "alterEgo"), GAMBIT_ROGUE, POOL_CARDS, seatName);
    expect(quiet.providers.map((p) => `${p.name}: ${p.by}.`)).toEqual([
      "Gambit: Player 1's hero, in hero form.",
      "Rogue: Player 2's hero, in alter-ego form (Anna Marie).",
    ]);
    expect(quiet.playable).toBe(false);
    expect(quiet.status).toBe("Team-Up cards need Rogue in hero form.");
    const both = teamUpDetail(heroForms(seats), GAMBIT_ROGUE, POOL_CARDS, seatName);
    expect(both.playable).toBe(true);
    expect(both.status).toBe("Team-Up cards can be played now.");
  });

  test("teamUpStatus names every character still waiting, and an absent one as needing play", () => {
    const showing = { name: "A", by: "x", showing: true };
    expect(teamUpStatus([showing, showing]).text).toBe("Team-Up cards can be played now.");
    const waiting = [
      { name: "A", by: "p", showing: false },
      { name: "B", by: "q", showing: false },
    ];
    expect(teamUpStatus(waiting).text).toBe("Team-Up cards need A and B in hero form.");
    expect(teamUpStatus([showing, { name: "B", by: "not in play", showing: false }]).text).toBe(
      "Team-Up cards need B in play.",
    );
  });
});

describe("which panels carry the yellow 'needs hero form' blurb", () => {
  let seats: GameState;
  const flip = (game: GameState, index: number, form: "hero" | "alterEgo"): GameState => ({
    ...game,
    players: game.players.map((p, i) =>
      i === index ? { ...p, identity: { ...p.identity, form, ...(form === "hero" ? { heroFormIndex: 0 } : {}) } } : p,
    ),
  });
  const waiting = (game: GameState): number[] => {
    const set = teamUpWaitingSeats(game, presentTeamUps(game, PAIRS));
    return game.players.flatMap((p, i) => (set.has(p.playerId) ? [i] : []));
  };

  beforeAll(async () => {
    seats = await startGame("gambit-justice", "rogue-protection");
  });

  test("both in alter-ego: each seat gets one", () => {
    expect(waiting(seats)).toEqual([0, 1]);
  });

  test("one in hero form: only the other seat, whichever it is", () => {
    expect(waiting(flip(seats, 0, "hero"))).toEqual([1]);
    expect(waiting(flip(seats, 1, "hero"))).toEqual([0]);
  });

  test("both in hero form: none", () => {
    expect(waiting(flip(flip(seats, 0, "hero"), 1, "hero"))).toEqual([]);
  });

  test("an ally provider never gets one, and neither does a seat outside the pair", async () => {
    const solo = await startGame("gambit-justice");
    const withRogue = withAllyInPlay(solo, solo.players[0]!.playerId, ROGUE_ALLY);
    expect(waiting(withRogue)).toEqual([0]);
    expect(waiting(flip(withRogue, 0, "hero"))).toEqual([]);
    const mixed = await startGame("gambit-justice", "core-spider-man-justice");
    const mixedWithRogue = withAllyInPlay(mixed, mixed.players[0]!.playerId, ROGUE_ALLY);
    expect(waiting(mixedWithRogue)).toEqual([0]);
  });

  test("the hover label names only the pair", () => {
    const base = { label: "Gambit and Rogue" };
    expect(ringLabel({ ...base, playable: false })).toBe("Team-Up: Gambit and Rogue");
    expect(ringLabel({ ...base, playable: true })).toBe("Team-Up active: Gambit and Rogue");
  });
});
