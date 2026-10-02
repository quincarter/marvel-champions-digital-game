import { trait } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  legalActions,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  threatOn,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withDamage } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../project-wideawake-testing.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { shadowcatGame } from "./support.js";

const REFS = [
  "32032.lockheed-response",
  "32033.kittys-room-action",
  "32034.acute-control-response",
  "32035.intangible-interference-response",
  "32036.phased-and-confused-forced-interrupt",
  "32041.wolverine-constant",
  "32041.wolverine-response",
  "32042.magik-response",
  "32043.attack-training-constant-2",
  "32044.gatekeeper-constant",
  "32044.gatekeeper-interrupt",
  "32047.aggressive-energy-interrupt",
  "32048.colossus-constant",
  "32049.x-mansion-action",
];

const identity = (state: GameState) => identityOf(state, P1);
const villainId = (state: GameState) => activeVillain(state).instanceId;
const handSize = (state: GameState) => playerOf(state, P1).hand.length;

/** Accepts every optional trigger offered; targets and the rest are the first legal choice. */
const accepting: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return firstLegal(state);
};
const declining: Picker = (state) => (state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(state));

/** Shadowcat past setup in alter-ego form, with `n` more cards in hand so any card can be paid for. */
function stocked(state: GameState, n = 8): GameState {
  const owner = playerOf(state, P1);
  const take = owner.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(n) } : p,
    ),
  };
}
const withMainThreat = (state: GameState, threat: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat });
const game = (scenario = "rhino"): GameState => withMainThreat(stocked(shadowcatGame(scenario)), 6);
const phaseControl = (state: GameState) => use(P1, identity(state), "32030b.kitty-pryde-constant");
const phased = (state: GameState): GameState =>
  settle(runWith(WAVE6_DEPS, state, phaseControl(state)), firstLegal, undefined, WAVE6_DEPS);
const hero = (state: GameState): GameState =>
  settle(runWith(WAVE6_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);

/** Plays `code` from hand (paying `cost` with other hand cards), attaching to `attachTo` where it is an attachment. */
function put(
  state: GameState,
  code: string,
  cost: number,
  options: { attachTo?: InstanceId; pick?: Picker; player?: typeof P1 } = {},
): { state: GameState; id: InstanceId } {
  const player = options.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWith(
      WAVE6_DEPS,
      given.state,
      play(
        player,
        id,
        payWith(given.state, player, cost, [id]),
        options.attachTo ? { attachToInstanceId: options.attachTo } : {},
      ),
    ),
    options.pick ?? accepting,
    undefined,
    WAVE6_DEPS,
  );
  return { state: played, id };
}

const abilityOffered = (state: GameState, player: typeof P1, abilityId: string): boolean => {
  const actions = legalActions(state, player, WAVE6_DEPS);
  if (actions.kind !== "turn") return false;
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === abilityId);
};

describe("Shadowcat's supports, upgrades and allies", () => {
  it("registers exactly the refs the scripts name, all valid", () => {
    expect(Object.keys(SHADOWCAT_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(SHADOWCAT_SUPPORT_UPGRADES_ALLIES))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Lockheed (32032)", () => {
    it("Solid: after he enters play, deals 2 damage to an enemy and removes no threat", () => {
      const state = game();
      const threat = mainThreat(state);
      const { state: after } = put(state, "32032", 2);
      expect(inst(after, villainId(after)).damage).toBe(2);
      expect(mainThreat(after)).toBe(threat);
    });

    it("Phased: removes 2 threat from a scheme and deals no damage", () => {
      const state = phased(game());
      const threat = mainThreat(state);
      const { state: after } = put(state, "32032", 2);
      expect(inst(after, villainId(after)).damage).toBe(0);
      expect(mainThreat(after)).toBe(threat - 2);
    });

    it("is an optional response: declining does nothing", () => {
      const { state: after } = put(game(), "32032", 2, { pick: declining });
      expect(inst(after, villainId(after)).damage).toBe(0);
    });
  });

  describe("Kitty's Room (32033)", () => {
    const room = "32033.kittys-room-action";

    it("Solid: exhaust to heal 2 damage from Kitty Pryde, and draws nothing", () => {
      const { state, id } = put(withDamage(game(), identity(game()), 0), "32033", 1);
      const hurt = withDamage(state, identity(state), 3);
      const before = handSize(hurt);
      const after = settle(runWith(WAVE6_DEPS, hurt, use(P1, id, room)), accepting, undefined, WAVE6_DEPS);
      expect(inst(after, identity(after)).damage).toBe(1);
      expect(handSize(after)).toBe(before);
      expect(inst(after, id).exhausted).toBe(true);
    });

    it("Phased: draws 1 card and heals nothing", () => {
      const base = phased(game());
      const { state, id } = put(base, "32033", 1);
      const hurt = withDamage(state, identity(state), 3);
      const before = handSize(hurt);
      const after = settle(runWith(WAVE6_DEPS, hurt, use(P1, id, room)), accepting, undefined, WAVE6_DEPS);
      expect(handSize(after)).toBe(before + 1);
      expect(inst(after, identity(after)).damage).toBe(3);
    });

    it("is an Alter-Ego Action: not offered in hero form", () => {
      const { state, id } = put(game(), "32033", 1);
      expect(abilityOffered(state, P1, room)).toBe(true);
      const inHero = hero(state);
      expect(abilityOffered(inHero, P1, room)).toBe(false);
      expect(applyCommand(inHero, use(P1, id, room), WAVE6_DEPS).ok).toBe(false);
    });
  });

  describe("Colossus (32048)", () => {
    /** Hand cards with exactly one resource icon, so `n` of them pay exactly `n`. */
    const pay = (state: GameState, player: typeof P1, n: number, exclude: readonly InstanceId[]) => {
      const single = playerOf(state, player).hand.filter((id) => {
        if (exclude.includes(id)) return false;
        const card = state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> };
        return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0) === 1;
      });
      if (single.length < n) throw new Error("not enough single-icon cards");
      return single.slice(0, n);
    };
    const tryPlay = (state: GameState, paid: number, player: typeof P1 = P1) => {
      const given = moveToHand(state, player, "32048");
      const [id] = given.ids as [InstanceId];
      return applyCommand(given.state, play(player, id, pay(given.state, player, paid, [id])), WAVE6_DEPS);
    };

    it("costs 3, not 4, for a MUTANT alter-ego (Kitty Pryde)", () => {
      const state = game();
      expect(tryPlay(state, 3).ok).toBe(true);
      expect(tryPlay(state, 2).ok).toBe(false);
    });

    it("costs 3 for an X-MEN hero (Shadowcat)", () => {
      const state = hero(game());
      expect(tryPlay(state, 3).ok).toBe(true);
      expect(tryPlay(state, 2).ok).toBe(false);
    });

    it("costs the full 4 for an identity with neither trait", () => {
      const base = shadowcatGame("rhino", { extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] });
      const owner = playerOf(base, P2);
      const state = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P2 ? { ...p, hand: [...p.hand, ...owner.deck.slice(0, 8)], deck: p.deck.slice(8) } : p,
        ),
      };
      // The ally is not in Spider-Man's deck: borrow Shadowcat's copy by surgery.
      const copy = playerOf(state, P1).deck.find((id) => state.instances[id]!.cardId === "32048")!;
      const borrowed: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((id) => id !== copy) } : { ...p, hand: [...p.hand, copy] },
        ),
        instances: {
          ...state.instances,
          [copy]: { ...state.instances[copy]!, controllerId: P2, ownerId: P2 } as never,
        },
      };
      // Spider-Man's turn: the first player's turn ends.
      const second = settle(runWith(WAVE6_DEPS, borrowed, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      const single = (n: number) => pay(second, P2, n, [copy]);
      expect(applyCommand(second, play(P2, copy, single(3)), WAVE6_DEPS).ok).toBe(false);
      expect(applyCommand(second, play(P2, copy, single(4)), WAVE6_DEPS).ok).toBe(true);
    });
  });

  describe("Wolverine (32041)", () => {
    const wolverine = (state: GameState) => put(state, "32041", 4, { pick: declining });
    const toughVillain = (state: GameState) =>
      patchInstance(state, villainId(state), { statuses: { ...inst(state, villainId(state)).statuses, tough: 1 } });
    const attackWith = (state: GameState, attacker: InstanceId): GameState =>
      settle(
        runWith(WAVE6_DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: attacker,
          targetInstanceId: villainId(state),
        }),
        declining,
        undefined,
        WAVE6_DEPS,
      );

    it("his attack gains piercing: it ignores the villain's tough status and deals its 3 damage", () => {
      const { state, id } = wolverine(hero(game()));
      const staged = toughVillain(state);
      const after = attackWith(staged, id);
      expect(inst(after, villainId(after)).damage).toBe(3);
      expect(inst(after, villainId(after)).statuses.tough).toBe(0);
    });

    it("another ally's attack does not: tough absorbs it", () => {
      const { state } = wolverine(hero(game()));
      const lockheed = put(state, "32032", 2, { pick: declining });
      const staged = toughVillain(lockheed.state);
      const after = attackWith(staged, lockheed.id);
      expect(inst(after, villainId(after)).damage).toBe(0);
      expect(inst(after, villainId(after)).statuses.tough).toBe(0);
    });

    it("after the player's turn begins, heals 1 damage from Wolverine only", () => {
      const { state, id } = wolverine(withMainThreat(game(), 0));
      const hurt = withDamage(withDamage(state, id, 2), identity(state), 3);
      let current = settle(runWith(WAVE6_DEPS, hurt, endTurn(P1)), accepting, undefined, WAVE6_DEPS);
      current = settle(current, accepting, (s) => s.step.phase === "player" && s.round > hurt.round, WAVE6_DEPS);
      expect(inst(current, id).damage).toBe(1);
      expect(inst(current, identity(current)).damage).toBe(3); // untouched by the response
    });
  });

  describe("X-Mansion (32049)", () => {
    const mansion = "32049.x-mansion-action";
    /** P1 Shadowcat (Kitty Pryde: MUTANT) and a second player, with X-Mansion in play under P1. */
    const twoPlayers = (other: string) => {
      const base = shadowcatGame("rhino", { extraPlayers: [{ starterDeckId: other }] });
      const { state, id } = put(stocked(base), "32049", 2);
      return { state, id };
    };
    /** Hands the support to P2 by surgery (moves it to their play area and control). */
    const underP2 = (state: GameState, id: InstanceId): GameState => ({
      ...patchInstance(state, id, { controllerId: P2 }),
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== id) }
          : p.playerId === P2
            ? { ...p, playArea: [...p.playArea, id] }
            : p,
      ),
    });
    const secondPlayersTurn = (state: GameState): GameState =>
      settle(runWith(WAVE6_DEPS, state, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);

    it("its MUTANT-alter-ego controller can trigger it: heals 1 damage from a chosen MUTANT or X-MEN character", () => {
      const { state, id } = twoPlayers("colossus-protection");
      const hurt = withDamage(state, identity(state), 3);
      let pending = runWith(WAVE6_DEPS, hurt, use(P1, id, mansion));
      expect(pending.pendingChoice?.prompt.kind).toBe("chooseTarget");
      // Only a MUTANT or X-MEN character is offered: both identities (Kitty Pryde and Piotr Rasputin), not the villain.
      const offered = pending.pendingChoice!.options.map((o) => o.optionId);
      expect(offered).toContain(identity(hurt));
      expect(offered).toContain(identityOf(hurt, P2));
      expect(offered).not.toContain(villainId(hurt));
      pending = settle(pending, () => [identity(hurt)], undefined, WAVE6_DEPS);
      expect(inst(pending, identity(pending)).damage).toBe(2);
      expect(inst(pending, id).exhausted).toBe(true);
    });

    it("another player whose alter-ego is MUTANT (Piotr Rasputin) may trigger it, and heals their own", () => {
      const { state, id } = twoPlayers("colossus-protection");
      const turn = withDamage(secondPlayersTurn(state), identityOf(state, P2), 2);
      expect(abilityOffered(turn, P2, mansion)).toBe(true);
      const after = settle(
        runWith(WAVE6_DEPS, turn, use(P2, id, mansion)),
        () => [identityOf(turn, P2)],
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, identityOf(after, P2)).damage).toBe(1);
      expect(inst(after, id).exhausted).toBe(true);
    });

    it("a player whose alter-ego is not MUTANT (Peter Parker) cannot, though the Mutant controller can", () => {
      const { state, id } = twoPlayers("core-spider-man-justice");
      expect(abilityOffered(state, P1, mansion)).toBe(true);
      const turn = secondPlayersTurn(state);
      expect(abilityOffered(turn, P2, mansion)).toBe(false);
      expect(applyCommand(turn, use(P2, id, mansion), WAVE6_DEPS).ok).toBe(false);
    });

    it("§3.11 literal: its controller cannot trigger it unless their own alter-ego is MUTANT", () => {
      const { state, id } = twoPlayers("core-spider-man-justice");
      const held = underP2(state, id);
      const turn = secondPlayersTurn(held);
      expect(abilityOffered(turn, P2, mansion)).toBe(false);
      // The MUTANT player who does not control it may still trigger it.
      const back = withDamage(state, identity(state), 1);
      expect(abilityOffered(underP2(back, id), P1, mansion)).toBe(true);
    });

    it("is an Alter-Ego Action: not offered once the MUTANT player is in hero form", () => {
      const { state } = twoPlayers("colossus-protection");
      expect(abilityOffered(hero(state), P1, mansion)).toBe(false);
    });
  });

  describe("Gatekeeper (32044)", () => {
    const withGatekeeper = () => {
      const { state: base, id: minion } = engageMinion(hero(game()), "01101");
      const printed = characterProfile(base, minion, WAVE6_DEPS)!.maxHp;
      const { state, id } = put(base, "32044", 0, { attachTo: minion });
      return { base, state, id, minion, printed };
    };
    const attackMinion = (state: GameState, minion: InstanceId, pick: Picker) =>
      settle(
        runWith(WAVE6_DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identity(state),
          targetInstanceId: minion,
        }),
        pick,
        undefined,
        WAVE6_DEPS,
      );

    it("the attached minion gets +2 hit points and gains patrol; an unattached one does neither", () => {
      const { base, state, minion, printed } = withGatekeeper();
      expect(characterProfile(state, minion, WAVE6_DEPS)!.maxHp).toBe(printed + 2);
      expect(hasKeyword(state, minion, "patrol", WAVE6_DEPS)).toBe(true);
      expect(hasKeyword(base, minion, "patrol", WAVE6_DEPS)).toBe(false);
      expect(inst(state, minion).attachments.length).toBe(1);
    });

    it("when the attached minion is defeated, removes 4 threat from the main scheme", () => {
      const { state, minion, printed } = withGatekeeper();
      const nearly = withDamage(state, minion, printed + 1);
      const after = attackMinion(nearly, minion, accepting);
      expect(
        playerOf(after, P1).discard.length +
          after.encounterDecks[Object.keys(after.encounterDecks)[0]!]!.discard.length,
      ).toBeGreaterThan(0);
      expect(mainThreat(after)).toBe(2);
    });

    it("is optional, and does nothing when the minion survives", () => {
      const { state, minion, printed } = withGatekeeper();
      const declined = attackMinion(withDamage(state, minion, printed + 1), minion, declining);
      expect(mainThreat(declined)).toBe(6);
      const survives = attackMinion(state, minion, accepting);
      expect(inst(survives, minion).damage).toBeGreaterThan(0);
      expect(mainThreat(survives)).toBe(6);
    });
  });

  describe("Attack Training (32043)", () => {
    it("the attached X-MEN ally gets +1 ATK and +2 hit points; another ally does not", () => {
      const state = hero(game());
      const lockheed = put(state, "32032", 2, { pick: declining });
      const wolverine = put(lockheed.state, "32041", 4, { pick: declining });
      const before = characterProfile(wolverine.state, lockheed.id, WAVE6_DEPS)!;
      const trained = put(wolverine.state, "32043", 1, { attachTo: lockheed.id });
      const after = characterProfile(trained.state, lockheed.id, WAVE6_DEPS)!;
      expect(after.atk).toBe(before.atk + 1);
      expect(after.maxHp).toBe(before.maxHp + 2);
      expect(after.thw).toBe(before.thw);
      expect(characterProfile(trained.state, wolverine.id, WAVE6_DEPS)!.atk).toBe(
        characterProfile(wolverine.state, wolverine.id, WAVE6_DEPS)!.atk,
      );
    });

    it("attaches only to an ally: not to her identity", () => {
      const state = hero(game());
      const given = moveToHand(state, P1, "32043");
      const [id] = given.ids as [InstanceId];
      const result = applyCommand(
        given.state,
        play(P1, id, payWith(given.state, P1, 1, [id]), { attachToInstanceId: identity(state) }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("Phased and Confused (32036)", () => {
    const fighting: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? [identity(state)] : declining(state);
    /** A villain that hits hard enough for a defense to cost hit points (the identity test's shape). */
    const strongVillain = (state: GameState): GameState => {
      const villain = state.cardPool[state.instances[villainId(state)]!.cardId]!;
      if (villain.type !== "villain") throw new Error("not a villain");
      return {
        ...state,
        cardPool: {
          ...state.cardPool,
          [villain.id]: {
            ...villain,
            sides: villain.sides.map((side) => ({ ...side, stages: side.stages.map((st) => ({ ...st, atk: 9 })) })),
          } as unknown as typeof villain,
        },
      };
    };
    const villainPhase = (state: GameState): { state: GameState; events: GameEvent[] } => {
      let current = runWith(
        WAVE6_DEPS,
        stackEncounterDeck(strongVillain(withMainThreat(state, 0)), "01186", "01186"),
        endTurn(P1),
      );
      const events: GameEvent[] = [];
      for (let guard = 0; current.pendingChoice && guard < 100; guard++) {
        const choice = current.pendingChoice;
        const next = applyOk(
          current,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: fighting(current),
          },
          WAVE6_DEPS,
        );
        events.push(...next.events);
        current = next.state;
      }
      return { state: current, events };
    };
    /** Confused status cards given to the villain, in log order. */
    const confusedGiven = (events: readonly GameEvent[]) =>
      events.filter((e) => e.type === "statusGiven" && e.status === "confused");

    it("Hero form only: it cannot be played in alter-ego form", () => {
      const state = game();
      const given = moveToHand(state, P1, "32036");
      const [id] = given.ids as [InstanceId];
      const result = applyCommand(
        given.state,
        play(P1, id, payWith(given.state, P1, 3, [id]), { attachToInstanceId: villainId(state) }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });

    it("max 1 per enemy: a second copy cannot attach to the same enemy", () => {
      const first = put(hero(game()), "32036", 3, { attachTo: villainId(hero(game())) });
      const given = moveToHand(first.state, P1, "32036");
      const [second] = given.ids as [InstanceId];
      const result = applyCommand(
        given.state,
        play(P1, second, payWith(given.state, P1, 3, [second]), { attachToInstanceId: villainId(given.state) }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });

    it("when the attached enemy would attack: the attack does not happen, the card is discarded, then the enemy is confused", () => {
      const base = hero(game());
      const { state, id } = put(base, "32036", 3, { attachTo: villainId(base) });
      expect(inst(state, id).attachedTo).toBe(villainId(state));
      const { state: after, events } = villainPhase(state);
      expect(events.some((e) => e.type === "attackResolved")).toBe(false);
      expect(inst(after, identity(after)).damage).toBe(0);
      expect(playerOf(after, P1).discard).toContain(id);
      expect(inst(after, villainId(after)).attachments).not.toContain(id);
      // Confused after the discard (its later scheme is what removes it again).
      const resolved = events.findIndex((e) => e.type === "abilityResolved" && e.instanceId === id);
      const confused = events.findIndex((e) => e.type === "statusGiven" && e.status === "confused");
      expect(resolved).toBeGreaterThanOrEqual(0);
      expect(confused).toBeGreaterThan(resolved);
      expect(confusedGiven(events)).toHaveLength(1);
    });

    it("control: without it the same villain attack deals damage and leaves the villain unconfused", () => {
      const base = hero(game());
      const { state: after, events } = villainPhase(base);
      expect(events.some((e) => e.type === "attackResolved")).toBe(true);
      expect(inst(after, identity(after)).damage).toBeGreaterThan(0);
      expect(confusedGiven(events)).toHaveLength(0);
    });
  });

  describe("Acute Control (32034) and Intangible Interference (32035)", () => {
    /** Shadowcat in hero form with the upgrade on her identity, Phased (the mass form that ignores) unless `solid`. */
    const armed = (code: string, options: { solid?: boolean } = {}): { state: GameState; id: InstanceId } => {
      const { state, id } = put(game(), code, 1, { attachTo: identity(game()) });
      return { state: hero(options.solid ? state : phased(state)), id };
    };
    const attackVillain = (state: GameState, pick: Picker = accepting) => {
      const events: GameEvent[] = [];
      let current = applyOk(
        state,
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identity(state),
          targetInstanceId: villainId(state),
        },
        WAVE6_DEPS,
      );
      events.push(...current.events);
      for (let guard = 0; current.state.pendingChoice && guard < 50; guard++) {
        const choice = current.state.pendingChoice;
        current = applyOk(
          current.state,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: pick(current.state),
          },
          WAVE6_DEPS,
        );
        events.push(...current.events);
      }
      return { state: current.state, events };
    };
    const thwartMain = (state: GameState, pick: Picker = accepting) => {
      const events: GameEvent[] = [];
      let current = applyOk(
        state,
        {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: identity(state),
          schemeInstanceId: state.mainScheme.instanceId,
        },
        WAVE6_DEPS,
      );
      events.push(...current.events);
      for (let guard = 0; current.state.pendingChoice && guard < 50; guard++) {
        const choice = current.state.pendingChoice;
        current = applyOk(
          current.state,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: pick(current.state),
          },
          WAVE6_DEPS,
        );
        events.push(...current.events);
      }
      return { state: current.state, events };
    };
    const ignored = (events: readonly GameEvent[]) =>
      events.filter((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "keywordIgnored");

    it("ignoring a guard minion: exhaust Acute Control to deal 2 damage to that minion", () => {
      const { state, id } = armed("32034");
      const { state: staged, id: minion } = engageMinion(state, "01101");
      const { state: after, events } = attackVillain(staged);
      expect(ignored(events)).toHaveLength(1);
      expect(inst(after, minion).damage).toBe(2);
      expect(inst(after, id).exhausted).toBe(true);
      expect(inst(after, villainId(after)).damage).toBeGreaterThan(0); // the attack itself went through
    });

    it("is heard once per ignored card; one Acute Control exhausts after the first", () => {
      const { state, id } = armed("32034");
      const first = engageMinion(state, "01101");
      const second = engageMinion(first.state, "01101");
      const { state: after, events } = attackVillain(second.state);
      expect(ignored(events)).toHaveLength(2);
      const damaged = [first.id, second.id].map((m) => inst(after, m).damage);
      expect(damaged.sort()).toEqual([0, 2]);
      expect(inst(after, id).exhausted).toBe(true);
    });

    it("Q6: with no guard in the way nothing is ignored, so nothing is offered", () => {
      const { state, id } = armed("32034");
      const { state: after, events } = attackVillain(state);
      expect(ignored(events)).toHaveLength(0);
      expect(inst(after, id).exhausted).toBe(false);
    });

    it("Q6: attacking the guard minion itself ignores nothing", () => {
      const { state, id } = armed("32034");
      const { state: staged, id: minion } = engageMinion(state, "01101");
      const after = settle(
        runWith(WAVE6_DEPS, staged, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identity(staged),
          targetInstanceId: minion,
        }),
        accepting,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, id).exhausted).toBe(false);
    });

    it("Solid does not ignore the guard (it cannot attack past it), so it never fires", () => {
      const { state } = armed("32034", { solid: true });
      const { state: staged } = engageMinion(state, "01101");
      expect(
        applyCommand(
          staged,
          {
            type: "basicAttack",
            playerId: P1,
            attackerInstanceId: identity(staged),
            targetInstanceId: villainId(staged),
          },
          WAVE6_DEPS,
        ).ok,
      ).toBe(false);
    });

    it("is optional: declining leaves the minion unhurt and Acute Control ready", () => {
      const { state, id } = armed("32034");
      const { state: staged, id: minion } = engageMinion(state, "01101");
      const { state: after } = attackVillain(staged, declining);
      expect(inst(after, minion).damage).toBe(0);
      expect(inst(after, id).exhausted).toBe(false);
    });

    it("a patrol minion ignored while thwarting the main scheme is a patrol ignore too (Gatekeeper grants patrol)", () => {
      const { state } = armed("32034");
      const { state: staged, id: minion } = engageMinion(state, "01101");
      const { state: gated } = put(staged, "32044", 0, { attachTo: minion });
      const { events } = thwartMain(gated);
      const heard = ignored(events).map((e) => (e.type === "triggerEvent" ? e.event : null));
      expect(heard).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "keywordIgnored", ignored: "patrol" })]),
      );
    });

    it("Intangible Interference: ignoring the crisis icon removes 2 threat from that scheme", () => {
      const { state, id } = armed("32035");
      const { state: staged, id: crisis } = encounterCardInVillainArea(state, "01108", 4);
      const before = threatOn(staged, crisis);
      const { state: after, events } = thwartMain(staged);
      expect(ignored(events)).toHaveLength(1);
      expect(threatOn(after, crisis)).toBe(before - 2);
      expect(inst(after, id).exhausted).toBe(true);
      expect(mainThreat(after)).toBe(mainThreat(staged) - 2); // her thwart went through
    });

    it("Intangible Interference does nothing for a guard, and Acute Control nothing for a crisis icon", () => {
      const { state: crisisState, id: acute } = armed("32034");
      const withCrisis = encounterCardInVillainArea(crisisState, "01108", 4).state;
      const { state: afterCrisis } = thwartMain(withCrisis);
      expect(inst(afterCrisis, acute).exhausted).toBe(false);
      const { state: guardState, id: interference } = armed("32035");
      const { state: staged } = engageMinion(guardState, "01101");
      const { state: afterGuard } = attackVillain(staged);
      expect(inst(afterGuard, interference).exhausted).toBe(false);
    });

    it("Solid: the crisis icon still stops her thwart of the main scheme", () => {
      const { state } = armed("32035", { solid: true });
      const { state: staged } = encounterCardInVillainArea(state, "01108", 4);
      expect(
        applyCommand(
          staged,
          {
            type: "basicThwart",
            playerId: P1,
            thwarterInstanceId: identity(staged),
            schemeInstanceId: staged.mainScheme.instanceId,
          },
          WAVE6_DEPS,
        ).ok,
      ).toBe(false);
    });
  });

  describe("Magik (32042)", () => {
    const iconsOf = (state: GameState, id: InstanceId): Record<string, number> =>
      (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons ?? {};
    /** Hand cards with exactly one resource icon (any type), so `n` of them pay exactly `n`. */
    const singles = (state: GameState, exclude: readonly InstanceId[]) =>
      playerOf(state, P1).hand.filter(
        (id) => !exclude.includes(id) && Object.values(iconsOf(state, id)).reduce((a, b) => a + b, 0) === 1,
      );
    /** Plays Magik from hand paying 3 with other cards, leaving a [mental] card (named) for the response's cost. */
    function playMagik(state: GameState, offered: string[][] = []) {
      const given = moveToHand(state, P1, "32042");
      const [magik] = given.ids as [InstanceId];
      const mental = singles(given.state, [magik]).find(
        (id) => (iconsOf(given.state, id).mental ?? 0) + (iconsOf(given.state, id).wild ?? 0) > 0,
      )!;
      const payment = singles(given.state, [magik, mental]).slice(0, 3);
      const pick: Picker = (current) => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
        if (choice?.prompt.kind === "payForAbility") {
          const option = choice.options.find((o) => o.optionId === `hand:${mental}`);
          if (option) return [option.optionId];
        }
        if (choice?.prompt.kind === "chooseTarget") offered.push(choice.options.map((o) => o.optionId));
        return firstLegal(current);
      };
      const after = settle(runWith(WAVE6_DEPS, given.state, play(P1, magik, payment)), pick, undefined, WAVE6_DEPS);
      return { state: after, magik, mental };
    }
    const inEncounterDeck = (state: GameState, id: InstanceId) =>
      Object.values(state.encounterDecks).some((pile) => pile.deck.includes(id));

    it("an X-MEN hero's engaged non-Elite minion is shuffled into the encounter deck, and the [mental] resource is spent", () => {
      const { state, id: minion } = engageMinion(hero(game()), "01101");
      const { state: after, mental } = playMagik(state);
      expect(inEncounterDeck(after, minion)).toBe(true);
      expect(inst(after, minion).engagedWith).toBeNull();
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(playerOf(after, P1).discard).toContain(mental);
    });

    it("offers only non-Elite minions engaged with an X-MEN hero", () => {
      const { state: first, id: soldier } = engageMinion(hero(game()), "01101");
      // A second minion kind, made Elite for this test, and one engaged with a player who is not an X-MEN hero.
      const otherCode = Object.values(first.encounterDecks)
        .flatMap((pile) => pile.deck)
        .map((id) => first.instances[id]!.cardId)
        .find((code) => first.cardPool[code]!.type === "minion" && code !== "01101")!;
      const { state: second, id: elite } = engageMinion(first, String(otherCode));
      const patched: GameState = {
        ...second,
        cardPool: {
          ...second.cardPool,
          [otherCode]: { ...second.cardPool[otherCode]!, traits: [trait("ELITE")] } as never,
        },
      };
      const offered: string[][] = [];
      const { state: after } = playMagik(patched, offered);
      expect(offered[0]).toEqual([soldier]);
      expect(inEncounterDeck(after, soldier)).toBe(true);
      expect(inEncounterDeck(after, elite)).toBe(false);
      expect(cardsInPlay(after)).toContain(elite);
    });

    it("a player in alter-ego form is not an X-MEN hero: the minion stays", () => {
      const { state, id: minion } = engageMinion(game(), "01101");
      const offered: string[][] = [];
      const { state: after } = playMagik(state, offered);
      expect(offered).toEqual([]);
      expect(cardsInPlay(after)).toContain(minion);
      expect(inst(after, minion).engagedWith).toBe(P1);
    });
  });

  describe("Aggressive Energy (32047)", () => {
    const iconsOf = (state: GameState, id: InstanceId): number =>
      Object.values(
        (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons ?? {},
      ).reduce((a, b) => a + b, 0);
    /** Plays event `code` (cost `cost`) in hero form, paying with Aggressive Energy first when `spendIt`. */
    function playEvent(code: string, cost: number, spendIt: boolean) {
      const base = hero(game());
      const given = moveToHand(base, P1, code, "32047");
      const [event, energy] = given.ids as [InstanceId, InstanceId];
      const fillers = playerOf(given.state, P1)
        .hand.filter((id) => id !== event && id !== energy && iconsOf(given.state, id) === 1)
        .slice(0, cost);
      const payment = spendIt ? [energy, ...fillers.slice(0, cost - iconsOf(given.state, energy))] : fillers;
      const after = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, event, payment)),
        accepting,
        undefined,
        WAVE6_DEPS,
      );
      return { state: after, energy };
    }

    it("spent to play an Attack event, that event deals 1 additional damage", () => {
      const { state, energy } = playEvent("32037", 2, true);
      expect(inst(state, villainId(state)).damage).toBe(4); // Shadowcat Surprise: 3, +1
      expect(playerOf(state, P1).discard).toContain(energy);
    });

    it("the same event paid with other cards deals only its own 3", () => {
      const { state } = playEvent("32037", 2, false);
      expect(inst(state, villainId(state)).damage).toBe(3);
    });

    it("spent to play a non-Attack event it adds nothing: Airwalk removes its own 2 threat", () => {
      const before = mainThreat(hero(game()));
      const { state } = playEvent("32039", 1, true);
      expect(mainThreat(state)).toBe(before - 2);
      expect(inst(state, villainId(state)).damage).toBe(0);
    });
  });
});
