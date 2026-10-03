import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  allyLimitFor,
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { phoenixGame } from "../../phoenix/phoenix/support.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Cyclops's
 * aspect and basic cards (`cyclops` 33011-33026, every one whose aspect is not `hero:33001a`) played from a Core
 * hero's deck instead of `cyclops-leadership`: the card's own aspect's Core precon (Captain Marvel for Leadership,
 * She-Hulk Aggression, Black Panther Protection, Spider-Man Justice) and a basic card from Spider-Man or Captain
 * Marvel. A Core identity has no X-MEN or MUTANT trait, so the X-MEN-gated cards assert what their text says for such
 * a deck: they work on the X-MEN ally itself (Beast, the one Leadership X-MEN ally a Core Leadership deck can add) or
 * are refused/not offered.
 *
 * Psychic Rapport 33023 is the Phoenix pack's card (aliased in `../precon-player-cards.ts`). It gets a
 * deck-legality check and a played-from-Phoenix's-deck test; 33024-33026 are plain resources (no ability).
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
const SHE_HULK = "core-she-hulk-aggression";
const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";

const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const codeOf = (state: GameState, id: InstanceId) => String(state.instances[id]!.cardId);

/** Accepts the named optional triggers; for any other prompt picks the first option `wantCard` accepts, else declines. */
const choosing =
  (wanted: readonly string[], seen: string[] = [], wantCard?: (state: GameState, id: string) => boolean): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    for (const option of options) seen.push(option.optionId);
    const hits = options.filter((o) => wanted.some((w) => o.optionId.includes(w)));
    if (hits.length > 0) return hits.map((o) => o.optionId);
    const card = wantCard ? options.find((o) => wantCard(state, o.optionId)) : undefined;
    return card ? [card.optionId] : firstLegal(state);
  };

/** A game from `coreHero`'s deck with `cardCode` (one copy) plus one Beast (33011, the X-MEN ally a Core Leadership
 * deck can add), past setup, in the player phase. */
function openedWithBeast(cardCode: string, coreHero = CAPTAIN_MARVEL): GameState {
  const built = buildCrossHeroDeck(WAVE6_CARDS, coreHero, cardCode);
  const created = createGame(game.buildScenario([{ ...built, deck: [...built.deck, cardId("33011")] }]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Whether playing `card` attached to `host` is a legal target of a legal play. */
const canAttach = (state: GameState, card: InstanceId, host: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  if (actions.kind !== "turn") return false;
  return actions.legal.some(
    (a) => a.action.kind === "playCard" && a.action.instanceId === card && (a.targets ?? []).includes(host),
  );
};

describe("Cyclops's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["33011", CAPTAIN_MARVEL],
      ["33012", SHE_HULK],
      ["33013", BLACK_PANTHER],
      ["33014", SPIDER_MAN],
      ["33015", CAPTAIN_MARVEL],
      ["33016", CAPTAIN_MARVEL],
      ["33017", CAPTAIN_MARVEL],
      ["33018", CAPTAIN_MARVEL],
      ["33019", SPIDER_MAN],
      ["33020", SPIDER_MAN],
      ["33021", SPIDER_MAN],
      ["33022", SPIDER_MAN],
      ["33024", SPIDER_MAN],
      ["33025", SPIDER_MAN],
      ["33026", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(
        deck.deck.filter((id) => id === code),
        code,
      ).toHaveLength(1);
      const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
      expect(created.ok, code).toBe(true);
    }
  });

  it("33023 Psychic Rapport (Team-Up: Cyclops and Phoenix) is refused in a Core hero's deck", () => {
    const deck = buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33023");
    const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("illegal_deck");
      expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
    }
  });

  describe("33011.beast-response", () => {
    it("plays as an ally and fetches a resource card from the deck or discard pile to the hand", () => {
      const seen: string[] = [];
      const isResource = (state: GameState, id: string) =>
        state.instances[id as InstanceId] !== undefined &&
        state.cardPool[state.instances[id as InstanceId]!.cardId]!.type === "resource";
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33011", game, {
        coreHero: CAPTAIN_MARVEL,
        pick: choosing(["33011.beast-response"], seen, isResource),
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(seen.some((id) => id.includes("33011.beast-response"))).toBe(true);
      // The choice offered only resource cards, and its pick went to the hand.
      const offered = seen.filter((id) => state.instances[id as InstanceId]);
      expect(offered.length).toBeGreaterThan(0);
      for (const id of offered) expect(isResource(state, id)).toBe(true);
    });
  });

  describe("33013 Rockslide (retaliate 1)", () => {
    it("plays as an ally from a Protection deck", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33013", game, { coreHero: BLACK_PANTHER });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(codeOf(state, cardInstanceId)).toBe("33013");
    });
  });

  describe("33014.blindfold-response", () => {
    it("looks at the top 5 encounter cards, discards the chosen one and puts the rest back in order", () => {
      const created = createGame(
        game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33014")]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      const [c1, c2, c3, c4, c5, ...rest] = activeEncounterDeck(opened).deck;
      const { state } = playFromHand(
        WAVE6_DEPS,
        opened,
        "33014",
        3,
        choosing(["33014.blindfold-response"], [], (_s, id) => id === c3),
      );
      const encounter = activeEncounterDeck(state);
      expect(encounter.deck).toEqual([c1, c2, c4, c5, ...rest]);
      expect(encounter.discard).toContain(c3);
    });
  });

  describe("33015.danger-room-training-constant", () => {
    it("attaches to an X-MEN ally for +1 THW, +1 ATK and +1 hit point; the Core hero is not a legal host", () => {
      const opened = openedWithBeast("33015");
      const { state, id: beast } = playFromHand(WAVE6_DEPS, opened, "33011", 4);
      const before = profile(state, beast);
      const given = moveToHand(state, P1, "33015");
      const [training] = given.ids as [InstanceId];
      expect(canAttach(given.state, training, beast)).toBe(true);
      expect(canAttach(given.state, training, identityOf(given.state, P1))).toBe(false);
      const after = given.state;
      const played = settle(
        applyOk(after, play(P1, training, payWith(after, P1, 1, [training]), { attachToInstanceId: beast })),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const now = profile(played, beast);
      expect([now.thw, now.atk, now.maxHp]).toEqual([before.thw + 1, before.atk + 1, before.maxHp + 1]);
      const refused = applyCommand(
        after,
        play(P1, training, payWith(after, P1, 1, [training]), { attachToInstanceId: identityOf(after, P1) }),
        WAVE6_DEPS,
      );
      expect(refused.ok).toBe(false);
    });
  });

  describe("33019.angel-constant", () => {
    it("costs its full 3 for a Core hero (no MUTANT or X-MEN identity), so 2 resources are refused", () => {
      const created = createGame(
        game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33019")]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      const given = moveToHand(opened, P1, "33019");
      const [angel] = given.ids as [InstanceId];
      const cheap = applyCommand(given.state, play(P1, angel, payWith(given.state, P1, 2, [angel])), WAVE6_DEPS);
      expect(cheap.ok).toBe(false);
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33019", game, { coreHero: SPIDER_MAN, cost: 3 });
      expect(inPlay(state, cardInstanceId)).toBe(true);
    });
  });

  describe("33020 Utopia", () => {
    it("33020.utopia-constant: raises the ally limit by 1 while each ally is X-MEN (none, then Beast), not for a Core ally", () => {
      const opened = withForm(openedWithBeast("33020"), { heroForm: 0 });
      expect(allyLimitFor(opened, WAVE6_DEPS, P1)).toBe(3);
      const { state: withUtopia } = playFromHand(WAVE6_DEPS, opened, "33020", 2);
      expect(allyLimitFor(withUtopia, WAVE6_DEPS, P1)).toBe(4);
      const { state: withBeast } = playFromHand(WAVE6_DEPS, withUtopia, "33011", 4);
      expect(allyLimitFor(withBeast, WAVE6_DEPS, P1)).toBe(4);
    });

    it("33020.utopia-response: after Beast (X-MEN) enters play, Utopia exhausts to ready an X-MEN character", () => {
      const opened = withForm(openedWithBeast("33020"), { heroForm: 0 });
      const { state: withUtopia, id: utopia } = playFromHand(WAVE6_DEPS, opened, "33020", 2);
      const seen: string[] = [];
      const { state: after, id: beast } = playFromHand(
        WAVE6_DEPS,
        patchExhausted(withUtopia),
        "33011",
        4,
        choosing(["33020.utopia-response"], seen),
      );
      expect(seen.some((id) => id.includes("33020.utopia-response"))).toBe(true);
      expect(inst(after, utopia).exhausted).toBe(true);
      expect(inPlay(after, beast)).toBe(true);
    });
  });

  describe("33021.danger-room-response", () => {
    it("is an Alter-Ego Response for a MUTANT alter-ego: a Core hero's alter-ego is not offered it", () => {
      const opened = openedWithBeast("33021");
      expect(playerOf(opened, P1).identity.form).toBe("alterEgo");
      const { state: withRoom, id: room } = playFromHand(WAVE6_DEPS, opened, "33021", 2);
      expect(inPlay(withRoom, room)).toBe(true);
      const seen: string[] = [];
      const { state: after, id: beast } = playFromHand(WAVE6_DEPS, withRoom, "33011", 4, choosing([], seen));
      expect(seen.some((id) => id.includes("33021.danger-room-response"))).toBe(false);
      expect(inst(after, room).exhausted).toBe(false);
      expect(inst(after, beast).attachments).toEqual([]);
    });
  });

  describe("Teamwork 33017, Effective Leadership 33018 and Game Time 33022 (cyclops/precon-player-cards.ts)", () => {
    /** Captain Marvel's precon with one copy of `code` plus Beast (33011) and a Danger Room Training (33015), past
     * setup, in hero form, with Beast in play (cost 4 paid from the hand). */
    function openedFor(code: string): GameState {
      const built = buildCrossHeroDeck(WAVE6_CARDS, CAPTAIN_MARVEL, code);
      const deck = [...built.deck, cardId("33011"), cardId("33015")];
      const created = createGame(game.buildScenario([{ ...built, deck }]), WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      return withForm(opened, { heroForm: 0 });
    }
    function withBeastInPlay(code: string): { state: GameState; beast: InstanceId } {
      const { state, id } = playFromHand(WAVE6_DEPS, openedFor(code), "33011", 4);
      return { state, beast: id };
    }
    const atWork = (state: GameState, cmd: Parameters<typeof applyCommand>[1], pick: Picker) =>
      settle(applyOk(state, cmd), pick, undefined, WAVE6_DEPS);

    it("33017 Teamwork: exhausts an ally to add its ATK to the hero's basic attack; declined or with no ready ally it adds nothing", () => {
      const { state: base, beast } = withBeastInPlay("33017");
      const { state, ids } = moveToHand(base, P1, "33017");
      const hero = identityOf(state, P1);
      const villain = state.villains[0]!.instanceId;
      const attack = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero,
        targetInstanceId: villain,
      } as const;
      const seen: string[] = [];
      const after = atWork(state, attack, choosing(["33017.teamwork-constant"], seen));
      expect(seen.some((id) => id.includes("33017.teamwork-constant"))).toBe(true);
      expect(inst(after, beast).exhausted).toBe(true);
      const dealt = inst(after, villain).damage - inst(state, villain).damage;
      expect(dealt).toBe(profile(state, hero).atk + profile(state, beast).atk);
      expect(playerOf(after, P1).discard).toContain(ids[0]);
      // Declined: only the hero's own ATK; and no ready ally: not offered.
      const declined = atWork(state, attack, firstLegal);
      expect(inst(declined, villain).damage - inst(state, villain).damage).toBe(profile(state, hero).atk);
      const tired = patchInstance(state, beast, { exhausted: true });
      const none: string[] = [];
      atWork(tired, attack, choosing(["33017.teamwork-constant"], none));
      expect(none.some((id) => id.includes("33017.teamwork-constant"))).toBe(false);
    });

    it("33018 Effective Leadership: spent to play an ally, that ally gets +1 THW and +1 ATK; not when spent for an upgrade", () => {
      const base = openedFor("33018");
      const lead = moveToHand(base, P1, "33018");
      const beastCard = moveToHand(lead.state, P1, "33011");
      const [leadId] = lead.ids as [InstanceId];
      const [allyId] = beastCard.ids as [InstanceId];
      const others = payWith(beastCard.state, P1, 4, [leadId, allyId]);
      const plain = atWork(beastCard.state, play(P1, allyId, others), firstLegal);
      const printed = profile(plain, allyId);
      expect(printed.atk).toBe(2);
      const pay = [leadId, ...others.slice(0, 3)];
      const seen: string[] = [];
      const played = atWork(
        beastCard.state,
        play(P1, allyId, pay),
        choosing(["33018.effective-leadership-interrupt"], seen),
      );
      expect(seen.some((id) => id.includes("33018.effective-leadership-interrupt"))).toBe(true);
      const boosted = profile(played, allyId);
      expect([boosted.thw, boosted.atk]).toEqual([printed.thw + 1, printed.atk + 1]);

      // Spent for an upgrade (Danger Room Training on a Beast already in play): not offered.
      const training = moveToHand(plain, P1, "33015");
      const [trainingId] = training.ids as [InstanceId];
      const noAlly: string[] = [];
      atWork(
        training.state,
        play(P1, trainingId, [leadId], { attachToInstanceId: allyId }),
        choosing(["33018.effective-leadership-interrupt"], noAlly),
      );
      expect(noAlly.some((id) => id.includes("33018.effective-leadership-interrupt"))).toBe(false);
    });

    it("33022 Game Time: readies an ally with a TRAINING upgrade attached and heals 1 damage from it; an ally without one is not a choice", () => {
      const { state: base, beast } = withBeastInPlay("33022");
      const training = moveToHand(base, P1, "33015");
      const [trainingId] = training.ids as [InstanceId];
      const attached = atWork(
        training.state,
        play(P1, trainingId, payWith(training.state, P1, 1, [trainingId]), { attachToInstanceId: beast }),
        firstLegal,
      );
      const hurt = patchInstance(patchInstance(attached, beast, { damage: 2 }), beast, { exhausted: true });
      const given = moveToHand(hurt, P1, "33022");
      const [gameTime] = given.ids as [InstanceId];
      const after = atWork(given.state, play(P1, gameTime, []), firstLegal);
      expect(inst(after, beast).exhausted).toBe(false);
      expect(inst(after, beast).damage).toBe(1);

      // Without the TRAINING upgrade there is no legal target, so the event is not playable.
      const bare = moveToHand(patchInstance(base, beast, { damage: 2, exhausted: true }), P1, "33022");
      const [bareId] = bare.ids as [InstanceId];
      const actions = legalActions(bare.state, P1, WAVE6_DEPS);
      expect(
        actions.kind === "turn" &&
          actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === bareId),
      ).toBe(false);
    });
  });

  describe("33012.dust-interrupt", () => {
    it("a Core Aggression hero plays Dust; when she attacks a minion she attacks each minion in play and takes 1 + 1 consequential damage", () => {
      const { state: played, cardInstanceId: dust } = playFromAnotherHerosDeck("33012", game, { coreHero: SHE_HULK });
      expect(inPlay(played, dust)).toBe(true);
      const { state: one, id: first } = engageMinion(played, "01101", P1);
      const { state, id: second } = engageMinion(one, "01101", P1);
      const seen: string[] = [];
      const after = settle(
        applyOk(state, { type: "basicAttack", playerId: P1, attackerInstanceId: dust, targetInstanceId: first }),
        choosing(["33012.dust-interrupt"], seen),
        undefined,
        WAVE6_DEPS,
      );
      expect(seen.some((id) => id.includes("33012.dust-interrupt"))).toBe(true);
      expect(inst(after, first).damage).toBe(1);
      expect(inst(after, second).damage).toBe(1);
      expect(inst(after, dust).damage).toBe(2);
    });
  });

  describe("33016.coordinated-attack-constant", () => {
    it("played from a Leadership deck onto a minion: an ally attacking it takes 1 less consequential damage, even with no damage dealt", () => {
      const opened = openedWithBeast("33016");
      const { state: withBeast, id: beast } = playFromHand(WAVE6_DEPS, opened, "33011", 4);
      const { state: engaged, id: host } = engageMinion(withBeast, "01101", P1);
      const given = moveToHand(engaged, P1, "33016");
      const [card] = given.ids as [InstanceId];
      expect(canAttach(given.state, card, host)).toBe(true);
      const attached = settle(
        applyOk(given.state, play(P1, card, payWith(given.state, P1, 0, [card]), { attachToInstanceId: host })),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(attached, card).attachedTo).toBe(host);
      const consequential = attached.cardPool[attached.instances[beast]!.cardId]!;
      const printed = consequential.type === "ally" ? consequential.consequentialDamage.attack : 0;
      expect(printed).toBe(1);
      const tough = patchInstance(attached, host, { statuses: { ...inst(attached, host).statuses, tough: 1 } });
      const after = settle(
        applyOk(tough, { type: "basicAttack", playerId: P1, attackerInstanceId: beast, targetInstanceId: host }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, host).damage).toBe(0);
      expect(inst(after, beast).damage).toBe(printed - 1);
    });
  });

  describe("33023.psychic-rapport-action (the Phoenix pack's registry aliases it from 34023)", () => {
    /** Phoenix's precon with one unneeded deck card relabeled as the Cyclops-pack printing, played from hand. */
    const cast = (counters: number, pick: Picker) => {
      let state = withForm(phoenixGame("rhino", { seed: 1 }), { heroForm: 0 });
      const force = instancesOf(state, "34002a")[0]!;
      state = patchInstance(state, force, { counters: { power: counters } });
      state = patchInstance(state, identityOf(state, P1), { exhausted: true });
      const spare = playerOf(state, P1).deck.find((i) => String(state.instances[i]!.cardId) === "34016")!;
      state = patchInstance(state, spare, { cardId: cardId("33023") });
      // Team-Up (Cyclops and Phoenix): the Cyclops ally of her precon put straight into play.
      const owner = playerOf(state, P1);
      const cyclops = [...owner.hand, ...owner.deck].find((i) => String(state.instances[i]!.cardId) === "34003")!;
      state = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                hand: p.hand.filter((i) => i !== cyclops),
                deck: p.deck.filter((i) => i !== cyclops),
                playArea: [...p.playArea, cyclops],
              }
            : p,
        ),
        instances: { ...state.instances, [cyclops]: { ...state.instances[cyclops]!, faceup: true, controllerId: P1 } },
      };
      const given = moveToHand(state, P1, "33023");
      const card = given.ids[0] as InstanceId;
      const played = settle(
        applyOk(given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
        pick,
        undefined,
        WAVE6_DEPS,
      );
      return { state: played, force, identity: identityOf(played, P1) };
    };
    const choosing =
      (text: string): Picker =>
      (s) => {
        const hit = s.pendingChoice?.options.find((o) => o.label.includes(text));
        return hit ? [hit.optionId] : firstLegal(s);
      };

    it("readies Phoenix, then places 2 power counters on Phoenix Force", () => {
      const { state, force, identity } = cast(2, choosing("Place 2 power counters"));
      expect(inst(state, identity).exhausted).toBe(false);
      expect(inst(state, force).counters.power).toBe(4);
    });
  });
});

function applyOk(state: GameState, command: Parameters<typeof applyCommand>[1]): GameState {
  const result = applyCommand(state, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

/** The hero exhausted (so a "ready" effect has something to do); the same state otherwise. */
function patchExhausted(state: GameState): GameState {
  const hero = identityOf(state, P1);
  return { ...state, instances: { ...state.instances, [hero]: { ...inst(state, hero), exhausted: true } } };
}
