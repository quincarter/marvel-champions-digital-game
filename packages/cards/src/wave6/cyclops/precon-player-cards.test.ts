import { activeVillain, characterProfile, legalActions, type GameState, type InstanceId } from "@mc/engine";
import type { AbilityDefinition } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand, withDamage, withForm } from "../../testing/staging.js";
import { WAVE6_DEPS } from "../index.js";
import { cyclopsGame } from "./cyclops/support.js";
import { CYCLOPS_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * Teamwork 33017, Effective Leadership 33018 and Game Time 33022 (`cyclops/precon-player-cards.ts`), played from
 * Cyclops's own precon. The same cards from a Core hero's deck are in `cyclops/cross-hero.test.ts`.
 */
const REFS = [
  "33017.teamwork-constant",
  "33018.effective-leadership-interrupt",
  "33022.game-time-action",
  "33023.psychic-rapport-action",
];

/** Cyclops in hero form with a stocked hand, so cards of any cost can be paid for. */
function hero(): GameState {
  const base = withForm(cyclopsGame("rhino", { seed: 3 }), { heroForm: 0 });
  const owner = playerOf(base, P1);
  const take = owner.deck.slice(0, 8);
  return {
    ...base,
    players: base.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(8) } : p,
    ),
  };
}

const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const villainOf = (state: GameState) => activeVillain(state).instanceId;
const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);

/** Accepts the optional trigger(s) named; any other prompt is settled with the first legal option. */
const accepting =
  (seen: string[], ...wanted: readonly string[]): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    for (const o of options) seen.push(o.optionId);
    const hits = options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, state.pendingChoice?.maxSelections ?? 1) : firstLegal(state);
  };

/** Attaches a copy of `code` to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): GameState {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] });
}

const settled = (state: GameState, command: Parameters<typeof runWith>[2], pick: Picker = firstLegal) =>
  settle(runWith(WAVE6_DEPS, state, command), pick, undefined, WAVE6_DEPS);

describe("Cyclops's aspect and basic events", () => {
  it("every ref is a valid ability definition", () => {
    for (const ref of REFS) {
      const definition = (CYCLOPS_PRECON_PLAYER_CARDS as Record<string, AbilityDefinition>)[ref];
      expect(definition, ref).toBeDefined();
      expect(validateDefinition(definition!), ref).toEqual([]);
    }
    expect(Object.keys(CYCLOPS_PRECON_PLAYER_CARDS).sort()).toEqual([...REFS].sort());
  });

  describe("33017.teamwork-constant", () => {
    const withAlly = () => {
      const { state, id: ally } = playFromHand(WAVE6_DEPS, hero(), "33011", 4);
      return { state: moveToHand(state, P1, "33017").state, ally };
    };
    const basicAttack = (state: GameState, pick: Picker) =>
      settled(
        state,
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(state, P1),
          targetInstanceId: villainOf(state),
        },
        pick,
      );

    it("exhausts an ally to add its ATK (not its THW) to the hero's basic attack", () => {
      const { state, ally } = withAlly();
      const villain = villainOf(state);
      const base = profile(state, identityOf(state, P1)).atk;
      const allyAtk = profile(state, ally).atk;
      const seen: string[] = [];
      const after = basicAttack(state, accepting(seen, "33017.teamwork-constant"));
      expect(seen.some((id) => id.includes("33017.teamwork-constant"))).toBe(true);
      expect(inst(after, ally).exhausted).toBe(true);
      expect(inst(after, villain).damage - inst(state, villain).damage).toBe(base + allyAtk);
      // The bonus is for this use only.
      expect(profile(after, identityOf(after, P1)).atk).toBe(base);
    });

    it("adds the ally's THW to a basic thwart", () => {
      const { state, ally } = withAlly();
      const scheme = state.mainScheme.instanceId;
      const threatened = patchInstance(state, scheme, { threat: 20 });
      const thw = profile(state, identityOf(state, P1)).thw;
      const allyThw = profile(state, ally).thw;
      const after = settled(
        threatened,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(state, P1), schemeInstanceId: scheme },
        accepting([], "33017.teamwork-constant"),
      );
      expect(inst(after, ally).exhausted).toBe(true);
      expect(inst(after, scheme).threat).toBe(20 - thw - allyThw);
    });

    it("declining adds nothing and leaves the ally ready", () => {
      const { state, ally } = withAlly();
      const villain = villainOf(state);
      const base = profile(state, identityOf(state, P1)).atk;
      const after = basicAttack(state, firstLegal);
      expect(inst(after, ally).exhausted).toBe(false);
      expect(inst(after, villain).damage - inst(state, villain).damage).toBe(base);
    });

    it("is not offered with only an exhausted ally, or with no ally", () => {
      const { state, ally } = withAlly();
      for (const staged of [patchInstance(state, ally, { exhausted: true }), moveToHand(hero(), P1, "33017").state]) {
        const seen: string[] = [];
        basicAttack(staged, accepting(seen, "33017.teamwork-constant"));
        expect(seen.some((id) => id.includes("33017.teamwork-constant"))).toBe(false);
      }
    });
  });

  describe("33018.effective-leadership-interrupt", () => {
    /** Plays Beast (cost 4) paying with Effective Leadership plus 3 other cards. */
    function playBeastSpending(state: GameState, pick: Picker): { state: GameState; id: InstanceId } {
      const leadership = moveToHand(state, P1, "33018");
      const beast = moveToHand(leadership.state, P1, "33011");
      const [lead] = leadership.ids as [InstanceId];
      const [id] = beast.ids as [InstanceId];
      const others = payWith(beast.state, P1, 3, [lead, id]);
      const after = settled(beast.state, play(P1, id, [lead, ...others]), pick);
      return { state: after, id };
    }

    it("gives the ally it is spent to play +1 THW and +1 ATK until the end of the phase, then it wears off", () => {
      const start = hero();
      const printed = moveToHand(start, P1, "33011");
      const { state: plain } = playFromHand(WAVE6_DEPS, start, "33011", 4);
      const plainBeast = playerOf(plain, P1).playArea.find(
        (i) => plain.instances[i]!.cardId === printed.state.instances[printed.ids[0]!]!.cardId,
      )!;
      const base = profile(plain, plainBeast);

      const seen: string[] = [];
      const { state, id } = playBeastSpending(start, accepting(seen, "33018.effective-leadership-interrupt"));
      expect(seen.some((s) => s.includes("33018.effective-leadership-interrupt"))).toBe(true);
      expect(inPlay(state, id)).toBe(true);
      const boosted = profile(state, id);
      expect([boosted.thw, boosted.atk, boosted.maxHp]).toEqual([base.thw + 1, base.atk + 1, base.maxHp]);

      const later = settled(state, endTurn(P1));
      expect(later.step.phase).toBe("player");
      expect(later.round).toBeGreaterThan(state.round);
      const after = profile(later, id);
      expect([after.thw, after.atk]).toEqual([base.thw, base.atk]);
    });

    it("declining the interrupt gives no bonus", () => {
      const { state: plain, id: plainBeast } = playFromHand(WAVE6_DEPS, hero(), "33011", 4);
      const base = profile(plain, plainBeast);
      const { state, id } = playBeastSpending(hero(), firstLegal);
      expect([profile(state, id).thw, profile(state, id).atk]).toEqual([base.thw, base.atk]);
    });

    it("is not offered when spent to play a card that is not an ally", () => {
      const start = hero();
      const leadership = moveToHand(start, P1, "33018");
      const upgrade = moveToHand(leadership.state, P1, "33015");
      const [lead] = leadership.ids as [InstanceId];
      const [training] = upgrade.ids as [InstanceId];
      const ally = playFromHand(WAVE6_DEPS, upgrade.state, "33011", 4);
      const seen: string[] = [];
      settled(
        ally.state,
        play(P1, training, [lead], { attachToInstanceId: ally.id }),
        accepting(seen, "33018.effective-leadership-interrupt"),
      );
      expect(seen.some((s) => s.includes("33018.effective-leadership-interrupt"))).toBe(false);
    });
  });

  describe("33022.game-time-action", () => {
    it("readies an ally with a TRAINING upgrade attached and heals 1 damage from it", () => {
      const { state: played, id: beast } = playFromHand(WAVE6_DEPS, hero(), "33011", 4);
      const trained = attach(played, "33015", beast);
      const hurt = patchInstance(withDamage(trained, beast, 2), beast, { exhausted: true });
      const { state } = playFromHand(WAVE6_DEPS, hurt, "33022", 0);
      expect(inst(state, beast).exhausted).toBe(false);
      expect(inst(state, beast).damage).toBe(1);
    });

    it("cannot choose an ally without a TRAINING upgrade, nor Cyclops himself", () => {
      const { state: played, id: beast } = playFromHand(WAVE6_DEPS, hero(), "33011", 4);
      const { state: other, id: angel } = playFromHand(WAVE6_DEPS, played, "33019", 2);
      const trained = attach(other, "33015", beast);
      const hurt = patchInstance(
        patchInstance(withDamage(withDamage(trained, angel, 2), identityOf(trained, P1), 2), angel, {
          exhausted: true,
        }),
        beast,
        { exhausted: true },
      );
      const seen: string[] = [];
      const given = moveToHand(hurt, P1, "33022");
      const [game] = given.ids as [InstanceId];
      const after = settled(given.state, play(P1, game, []), accepting(seen, beast));
      expect(seen).toContain(beast);
      expect(seen).not.toContain(angel);
      expect(seen).not.toContain(identityOf(trained, P1));
      expect(inst(after, beast).exhausted).toBe(false);
      expect(inst(after, angel).exhausted).toBe(true);
      expect(inst(after, angel).damage).toBe(2);
    });

    it("is not playable when no ally has a TRAINING upgrade attached", () => {
      const { state: played } = playFromHand(WAVE6_DEPS, hero(), "33011", 4);
      const given = moveToHand(played, P1, "33022");
      const [game] = given.ids as [InstanceId];
      const actions = legalActions(given.state, P1, WAVE6_DEPS);
      const offered =
        actions.kind === "turn" &&
        actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === game);
      expect(offered).toBe(false);
    });
  });
});
