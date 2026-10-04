import {
  activeVillain,
  cardsInPlay,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { handWith } from "../../mut_gen/project-wideawake-testing.js";
import { GAMBIT_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { gambitGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const ADVANCE = "01186";
const ONE_ICON = "01188"; // Caught Off Guard
const FILLER = "01187";
const ACTION = "37025.guild-business-action";
const BELLADONNA_FR = "37026.belladonna-forced-response";
const GUILD_FR = "37027.the-assassins-guild-forced-response";
const ASSASSIN_FR = "37028.guild-assassin-forced-response";
const ATTEMPT = "37029.when-revealed";

const REFS = ["37025.guild-business-constant", ACTION, BELLADONNA_FR, GUILD_FR, ASSASSIN_FR, ATTEMPT] as const;

/** Applies `command`, answering every choice with `pick`; checks the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;

const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const status = (state: GameState, id: InstanceId, kind: "stunned" | "confused" | "tough") =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, [kind]: 1 } });
const inPlayIds = (state: GameState, code: string): InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));
const resolved = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const threatFrom = (events: readonly GameEvent[], source: InstanceId) =>
  events.flatMap((e) => (e.type === "threatPlaced" && e.sourceInstanceId === source ? [e] : []));

/** A hand card whose printed resources include neither [energy] nor [wild] (moved from the deck by surgery). */
function handWithoutEnergy(state: GameState): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const lacks = (i: InstanceId) => {
    const card = state.cardPool[state.instances[i]!.cardId]!;
    const icons = "resourceIcons" in card ? (card.resourceIcons ?? {}) : {};
    return (icons.energy ?? 0) === 0 && (icons.wild ?? 0) === 0;
  };
  const id = [...owner.hand, ...owner.deck].find(lacks)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand.filter((i) => i !== id), id] }
          : p,
      ),
    },
  };
}

/** Guild Business revealed (the villain stunned; one filler is its boost card) by `revealer`, in a game of `game`. */
function revealGuildBusiness(game: GameState = gambitGame(), revealer = P1) {
  const base = status(game, villainOf(game), "stunned");
  // Two players: the villain activates against each (a boost card apiece), then P2 (first player) is dealt first.
  const ordered = revealer === P1 ? [ADVANCE, "37025"] : [ADVANCE, ONE_ICON, "37025", FILLER];
  const staged = stackEncounterDeck(base, ...ordered);
  const afterP1 = drive(staged, endTurn(P1)).state;
  const { state } = revealer === P1 ? { state: afterP1 } : drive(afterP1, endTurn(P2));
  return { state, id: inPlayIds(state, "37025")[0]! };
}
const twoPlayers = () => {
  const base = gambitGame("rhino", { extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] });
  return { ...base, firstPlayerId: P2 };
};

/**
 * `code` from the set-aside nemesis cards revealed in the villain phase's deal step in `game`, the villain stunned (in
 * hero form that cancels its attack, so it draws no boost card; `fillers` ADVANCEs ahead of the card absorb boosts).
 */
function reveal(game: GameState, code: string, opts: { fillers?: number; pick?: Picker } = {}) {
  const fillers = opts.fillers ?? (playerOf(game, P1).identity.form === "hero" ? 0 : 1);
  const staged = stackEncounterDeck(
    stackSetAside(status(game, villainOf(game), "stunned"), code),
    ...Array.from({ length: fillers }, () => ADVANCE),
    code,
  );
  const { state, events } = drive(staged, endTurn(P1), opts.pick);
  return { state, events, id: inPlayIds(state, code)[0]! };
}
/** Gambit in hero form, undamaged. */
const heroGame = () => withForm(gambitGame(), { heroForm: 0 });
/**
 * Gambit in hero form with Dazzler (a 3 HP ally, no Toughness) in play at 1 HP left, declared as the defender by
 * `defender`: whatever attacks defeats her. (A hero's own defeat ends a solo game before any response, so an ally is
 * the defeated character.)
 */
const DAZZLER = "37012";
function heroWithDyingAlly() {
  const hero = heroGame();
  const id = playerOf(hero, P1).deck.find((i) => hero.instances[i]!.cardId === DAZZLER)!;
  const state = {
    ...hero,
    players: hero.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return {
    ally: id,
    state: patchInstance(state, id, { faceup: true, controllerId: P1, damage: 2 }),
    defender: ((s) => {
      const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id);
      return hit ? [hit.optionId] : firstLegal(s);
    }) as Picker,
  };
}

describe("Gambit's obligation and nemesis set (37025-37029)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(GAMBIT_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(GAMBIT_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Guild Business (37025)", () => {
    it("37025.guild-business-constant: is revealed into the Remy LeBeau player's play area and stays there", () => {
      const { state, id } = revealGuildBusiness();
      expect(playerOf(state, P1).playArea).toContain(id);
      expect(cardsInPlay(state)).toContain(id);
      expect(state.removedFromGame).not.toContain(id);
    });

    it("37025.guild-business-constant: given to the Remy LeBeau player when another player reveals it", () => {
      const game = twoPlayers();
      expect(game.firstPlayerId).toBe(P2);
      const { state, id } = revealGuildBusiness(game, P2);
      expect(playerOf(state, P1).playArea).toContain(id);
      expect(playerOf(state, P2).playArea).not.toContain(id);
      expect(inst(state, id).controllerId ?? P1).toBe(P1);
    });

    const withEnergy = () => {
      const { state, id } = revealGuildBusiness();
      const { state: staged, ids } = handWith(state, P1, "energy", 1);
      return { state: staged, id, energy: ids[0]! };
    };
    const useAction = (id: InstanceId, hand: readonly InstanceId[]) =>
      use(
        P1,
        id,
        ACTION,
        hand.map((fromHand) => ({ fromHand })),
      );

    it("37025.guild-business-action: exhausts Remy LeBeau, spends an [energy] resource and removes it from the game", () => {
      const { state, id, energy } = withEnergy();
      expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      const { state: after, events } = drive(state, useAction(id, [energy]));
      expect(resolved(events)).toContain(ACTION);
      expect(inst(after, identityOf(after, P1)).exhausted).toBe(true);
      expect(playerOf(after, P1).hand).not.toContain(energy);
      expect(playerOf(after, P1).discard).toContain(energy);
      expect(after.removedFromGame).toContain(id);
      expect(cardsInPlay(after)).not.toContain(id);
      expect(playerOf(after, P1).discard).not.toContain(id);
    });

    it("37025.guild-business-action: needs Remy LeBeau ready (the exhaust is a cost)", () => {
      const { state, id, energy } = withEnergy();
      const tired = patchInstance(state, identityOf(state, P1), { exhausted: true });
      expect(rejected(tired, useAction(id, [energy]))).toBe(true);
    });

    it("37025.guild-business-action: needs an [energy] resource (no payment, or a card with none, is refused)", () => {
      const { state, id } = withEnergy();
      expect(rejected(state, useAction(id, []))).toBe(true);
      const { state: other, id: noEnergy } = handWithoutEnergy(state);
      expect(rejected(other, useAction(id, [noEnergy]))).toBe(true);
    });

    it("37025.guild-business-action: is an Alter-Ego Action, not usable in hero form", () => {
      const { state, id, energy } = withEnergy();
      const hero = withForm(state, { heroForm: 0 });
      expect(rejected(hero, useAction(id, [energy]))).toBe(true);
    });
  });

  describe("Belladonna (37026, nemesis minion)", () => {
    it("is revealed from the set-aside nemesis cards, engaged with the revealing player", () => {
      const { state, id } = reveal(gambitGame(), "37026");
      expect(id).toBeDefined();
      expect(inst(state, id).engagedWith).toBe(P1);
    });

    it("37026.belladonna-forced-response: after she attacks and defeats a character, 2 threat goes on the main scheme", () => {
      // Quickstrike: engaging a hero-form player she attacks at once (after her reveal); Dazzler defends and is defeated.
      const dying = heroWithDyingAlly();
      const { state, events, id } = reveal(dying.state, "37026", { pick: dying.defender });
      expect(events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: dying.ally }));
      expect(resolved(events)).toContain(BELLADONNA_FR);
      const placed = threatFrom(events, id);
      expect(placed).toHaveLength(1);
      expect(placed[0]).toMatchObject({ schemeInstanceId: state.mainScheme.instanceId, amount: 2 });
    });

    it("37026.belladonna-forced-response: an attack that defeats nothing places no threat", () => {
      const { events, id } = reveal(heroGame(), "37026");
      expect(events).toContainEqual(expect.objectContaining({ type: "attackResolved", enemyInstanceId: id }));
      expect(events.some((e) => e.type === "characterDefeated")).toBe(false);
      expect(resolved(events)).not.toContain(BELLADONNA_FR);
      expect(threatFrom(events, id)).toHaveLength(0);
    });
  });

  describe("The Assassins Guild (37027, side scheme)", () => {
    const withGuild = (base: GameState) => {
      const { state, id } = encounterCardInVillainArea(stackSetAside(base, "37027"), "37027", 0);
      return { state, scheme: id };
    };

    it("37027.the-assassins-guild-forced-response: after an ASSASSIN minion attacks and defeats a character, 2 threat goes here", () => {
      // Guild Assassin (ASSASSIN) defeats Dazzler: 2 here (this card), 1 on the main scheme (its own response).
      const dying = heroWithDyingAlly();
      const { state, scheme } = withGuild(dying.state);
      const { state: after, events, id } = reveal(state, "37028", { pick: dying.defender });
      expect(resolved(events)).toContain(GUILD_FR);
      expect(threatFrom(events, scheme)).toEqual([expect.objectContaining({ schemeInstanceId: scheme, amount: 2 })]);
      expect(inst(after, scheme).threat).toBe(2);
      expect(threatFrom(events, id)).toEqual([
        expect.objectContaining({ schemeInstanceId: after.mainScheme.instanceId, amount: 1 }),
      ]);
    });

    it("37027.the-assassins-guild-forced-response: Belladonna (an ASSASSIN) also feeds it", () => {
      const dying = heroWithDyingAlly();
      const { state, scheme } = withGuild(dying.state);
      const { state: after, events } = reveal(state, "37026", { pick: dying.defender });
      expect(resolved(events)).toContain(GUILD_FR);
      expect(inst(after, scheme).threat).toBe(2);
    });

    it("37027.the-assassins-guild-forced-response: an attack that defeats nothing places no threat here", () => {
      const { state, scheme } = withGuild(heroGame());
      const { state: after, events } = reveal(state, "37028");
      expect(events).toContainEqual(expect.objectContaining({ type: "attackResolved" }));
      expect(resolved(events)).not.toContain(GUILD_FR);
      expect(inst(after, scheme).threat).toBe(0);
    });
  });

  describe("Guild Assassin (37028, minion x2)", () => {
    it("37028.guild-assassin-forced-response: after it attacks and defeats a character, 1 threat goes on the main scheme", () => {
      const dying = heroWithDyingAlly();
      const { events, id, state } = reveal(dying.state, "37028", { pick: dying.defender });
      expect(events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: dying.ally }));
      expect(resolved(events)).toContain(ASSASSIN_FR);
      const placed = threatFrom(events, id);
      expect(placed).toEqual([expect.objectContaining({ schemeInstanceId: state.mainScheme.instanceId, amount: 1 })]);
    });

    it("37028.guild-assassin-forced-response: an attack that defeats nothing places no threat", () => {
      const { events, id } = reveal(heroGame(), "37028");
      expect(events).toContainEqual(expect.objectContaining({ type: "attackResolved", enemyInstanceId: id }));
      expect(resolved(events)).not.toContain(ASSASSIN_FR);
      expect(threatFrom(events, id)).toHaveLength(0);
    });

    it("the nemesis set has two Guild Assassins", () => {
      expect(instancesOf(gambitGame(), "37028")).toHaveLength(2);
    });
  });

  describe("Assassination Attempt (37029, treachery)", () => {
    /** The set-aside copy of `code` put into `player`'s play area, engaged, faceup (a minion in play, by surgery). */
    const engageSetAside = (state: GameState, code: string, player = P1) => {
      const id = playerOf(state, player).setAside.find((i) => state.instances[i]!.cardId === code)!;
      return {
        id,
        state: {
          ...state,
          players: state.players.map((p) =>
            p.playerId === player
              ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] }
              : p,
          ),
          instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: player } },
        },
      };
    };
    /** Confused minions lose their villain-phase scheme (alter-ego form), leaving the treachery's attack to be seen. */
    const confused = (state: GameState, ...ids: readonly InstanceId[]) =>
      ids.reduce((s, id) => status(s, id, "confused"), state);
    const attacks = (events: readonly GameEvent[]) =>
      events.filter((e) => e.type === "attackResolved" || (e.type === "enemyActivated" && e.activation === "attack"));

    it("37029.when-revealed: each ASSASSIN minion attacks you, even in alter-ego form", () => {
      const first = engageSetAside(gambitGame(), "37028");
      const second = engageSetAside(first.state, "37028");
      const belladonna = engageSetAside(second.state, "37026");
      const base = confused(belladonna.state, first.id, second.id, belladonna.id);
      expect(playerOf(base, P1).identity.form).toBe("alterEgo");
      const staged = stackEncounterDeck(
        stackSetAside(status(base, villainOf(base), "stunned"), "37029"),
        ADVANCE,
        "37029",
      );
      const { state, events } = drive(staged, endTurn(P1));
      const hits = events.filter((e) => e.type === "attackResolved");
      expect(resolved(events)).toContain(ATTEMPT);
      expect(hits.map((e) => (e.type === "attackResolved" ? e.enemyInstanceId : null)).sort()).toEqual(
        [first.id, second.id, belladonna.id].sort(),
      );
      for (const hit of hits) expect(hit.type === "attackResolved" && hit.targetInstanceId).toBe(identityOf(state, P1));
      // Nothing was searched for: ASSASSIN minions were in play.
      expect(inPlayIds(state, "37028")).toHaveLength(2);
    });

    it("37029.when-revealed: only ASSASSIN minions attack (the villain is not one)", () => {
      const first = engageSetAside(gambitGame(), "37028");
      const base = confused(first.state, first.id);
      const staged = stackEncounterDeck(
        stackSetAside(status(base, villainOf(base), "stunned"), "37029"),
        ADVANCE,
        "37029",
      );
      const { events } = drive(staged, endTurn(P1));
      const attackers = events.flatMap((e) => (e.type === "attackResolved" ? [e.enemyInstanceId] : []));
      expect(attackers).toEqual([first.id]);
    });

    it("37029.when-revealed: with no ASSASSIN minion in play, searches the encounter deck for one and reveals it", () => {
      const game = gambitGame();
      const staged = stackEncounterDeck(
        stackSetAside(stackSetAside(status(game, villainOf(game), "stunned"), "37028"), "37029"),
        ADVANCE,
        "37029",
      );
      const { state, events } = drive(staged, endTurn(P1));
      expect(resolved(events)).toContain(ATTEMPT);
      const found = inPlayIds(state, "37028");
      expect(found).toHaveLength(1);
      expect(inst(state, found[0]!).engagedWith).toBe(P1);
      // Revealed, not attacking: no assassin was in play to attack, and alter-ego form does not quickstrike.
      expect(attacks(events).filter((e) => e.type === "attackResolved")).toHaveLength(0);
    });

    it("37029.when-revealed: the search also covers the encounter discard pile", () => {
      const game = gambitGame();
      const stagedDeck = stackSetAside(game, "37028");
      const piles = Object.values(stagedDeck.encounterDecks)[0]!;
      const copy = piles.deck[0]!;
      const deckId = Object.keys(stagedDeck.encounterDecks)[0]!;
      const inDiscard: GameState = {
        ...stagedDeck,
        encounterDecks: {
          ...stagedDeck.encounterDecks,
          [deckId]: { deck: piles.deck.slice(1), discard: [copy, ...piles.discard] },
        },
      };
      const staged = stackEncounterDeck(
        stackSetAside(status(inDiscard, villainOf(inDiscard), "stunned"), "37029"),
        ADVANCE,
        "37029",
      );
      const { state } = drive(staged, endTurn(P1));
      expect(inPlayIds(state, "37028")).toEqual([copy]);
    });

    it("37029.when-revealed: nothing is revealed when no ASSASSIN minion is in the deck or discard", () => {
      const game = gambitGame();
      const staged = stackEncounterDeck(
        stackSetAside(status(game, villainOf(game), "stunned"), "37029"),
        ADVANCE,
        "37029",
      );
      const { state, events } = drive(staged, endTurn(P1));
      expect(resolved(events)).toContain(ATTEMPT);
      // Belladonna and both Guild Assassins stay set aside: the search covers the deck and discard pile only.
      expect(inPlayIds(state, "37026")).toHaveLength(0);
      expect(inPlayIds(state, "37028")).toHaveLength(0);
    });

    it("37029.when-revealed: attacks the revealing player in a 2-player game", () => {
      const game = twoPlayers();
      const first = engageSetAside(game, "37028");
      const base = confused(first.state, first.id);
      expect(base.firstPlayerId).toBe(P2);
      // P2, the first player, is dealt the treachery (after the villain's boost card), P1 a filler.
      const staged = stackEncounterDeck(
        stackSetAside(status(base, villainOf(base), "stunned"), "37029"),
        ADVANCE,
        ONE_ICON,
        "37029",
        FILLER,
      );
      const afterP1 = drive(staged, endTurn(P1));
      const { state, events: p2Events } = drive(afterP1.state, endTurn(P2));
      const events = [...afterP1.events, ...p2Events];
      const hit = events.find((e) => e.type === "attackResolved");
      expect(hit && hit.type === "attackResolved" && hit.targetInstanceId).toBe(identityOf(state, P2));
    });
  });
});
