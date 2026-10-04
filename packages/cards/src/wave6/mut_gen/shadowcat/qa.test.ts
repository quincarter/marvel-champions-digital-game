import { MUT_GEN_STARTER_DECKS, CORE_CARDS, cardId, type DeckContents } from "@mc/content";
import {
  activeVillain,
  createGame,
  replay,
  validateDeck,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../../testing/driver.js";
import {
  applyOk,
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
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { WAVE6_CARDS } from "../../cards.js";
import { WAVE6_DEPS, wave6Scenario, wave6StarterDeckSetup, type Wave6ScenarioOptions } from "../../index.js";
import { shadowcatGame } from "./support.js";

/**
 * Wave 6 rules QA, Shadowcat (`docs/phase7-wave6-qa-colossus-shadowcat.md`). Two parts.
 *
 * 1. Rulings that touch a card of Shadowcat's kit, her nemesis set (White Queen, Hellfire Club) or the box's shared
 *    precon cards. Already pinned exactly by another test, so not copied here:
 *    - FAQ "Powerful Punch (#14)" (RRG 1.8 p. 63), the Solid half (she punches, flips to Phased, defends taking nothing,
 *      flips back): `e2e.test.ts` "Powerful Punch (FAQ #14, RRG p. 63) ...". The Phased half is below.
 *    - FAQ "White Queen (#56)" (p. 63): `obligation-nemesis.test.ts` "a thwart spends the confused card and she gives
 *      another at once" and "when she leaves play the confused card stays".
 *    - Ruling January 26, 2026 (6) #2 ("limits apply to cards ... persist across flips"), Phase Control's once per round:
 *      `identity.test.ts` "is limited to once per round ...".
 *    - Q49 (Permanently Phased's own When Revealed flip resolves despite its "cannot change mass form", RRG 1.8 "Reveal",
 *      p. 38): `obligation-nemesis.test.ts` "When Revealed: the mass form upgrade flips from Solid to Phased".
 *    - FAQ "Mutant Protectors (#17)" (p. 63) and "Magik" (p. 64): `../precon-player-cards.test.ts` (known `it.fails`
 *      and `it.todo`, not Shadowcat's own).
 *    - RRG "Form, Change Form" (p. 21): an additional form change never spends the hero/alter-ego flip:
 *      `identity.test.ts` "her flips never spend the hero/alter-ego once-per-round change".
 *    - Q15 = B / RRG "Permanent" (p. 32), "set aside before step 1": `identity.test.ts` "32030b.setup" and
 *      `custom-deck.test.ts` (requiredIdentitySet and validateDeck carry Solid).
 *    No erratum on p. 65 to 69 names a Shadowcat card, no post-1.7 ruling names Shadowcat, Kitty Pryde, Solid or Phased
 *    (a ruling of March 19, 2026 (1) fixes Phased Out, a Vision card, not Phase Strike).
 * 2. Whole games with Shadowcat's precon, 2 players standard (with Colossus, the box's other hero) and 1 hero expert,
 *    played by the greedy driver and replayed deep-equal, each containing her signature mass-form changes.
 */

const SEED = 2026;
const hero = (state: GameState): InstanceId => identityOf(state, P1);
const massForm = (state: GameState): InstanceId => instancesOf(state, "32031a")[0]!;
const isPhased = (state: GameState): boolean => inst(state, massForm(state)).flipped;
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** One command, then every prompt answered with `pick`; the events of the whole chain. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  const events: GameEvent[] = [];
  let current = state;
  const first = applyOk(current, command, WAVE6_DEPS);
  current = first.state;
  events.push(...first.events);
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 200) throw new Error("choices did not settle");
    const choice = current.pendingChoice;
    const next = applyOk(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      WAVE6_DEPS,
    );
    current = next.state;
    events.push(...next.events);
  }
  return { state: current, events };
}

/** Accepts the named optional triggers, pays `pay` hand cards for a card, and defends with the hero when asked. */
const choosing =
  (accept: readonly string[], pay = 0): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") {
      const defender = choice.options.find((o) => o.optionId === identityOf(state, choice.playerId));
      return [defender ? defender.optionId : "decline"];
    }
    if (choice.prompt.kind === "chooseTriggers") {
      const hits = choice.options.filter((o) => accept.some((a) => o.optionId.includes(a))).map((o) => o.optionId);
      return hits.length > 0 ? hits : firstLegal(state);
    }
    if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility")
      return choice.options.slice(0, pay).map((o) => o.optionId);
    return firstLegal(state);
  };

/** A villain that hits hard enough for a defense to cost hit points. */
const strongVillain = (state: GameState): GameState => {
  const villain = state.cardPool[state.instances[villainOf(state)]!.cardId]!;
  if (villain.type !== "villain") throw new Error("not a villain");
  return {
    ...state,
    cardPool: {
      ...state.cardPool,
      [villain.id]: {
        ...villain,
        sides: villain.sides.map((side) => ({ ...side, stages: side.stages.map((s) => ({ ...s, atk: 9 })) })),
      } as unknown as typeof villain,
    },
  };
};

const formEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" &&
    e.phase === "resolved" &&
    e.event.kind === "formChanged" &&
    e.event.change === "additional"
      ? [e.event.formName]
      : [],
  );

/** Takes `code` out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

describe("rulings", () => {
  describe("FAQ 'Powerful Punch (#14)' (RRG 1.8 p. 63), the Phased half", () => {
    // "As soon as she finishes resolving the attack-labeled effect, she is considered to have attacked and can flip her
    // mass form as soon as the damage is dealt (she must do so if she is in Phased mass form). The villain then continues
    // its attack, and Shadowcat is now considered defending that attack. If she is in her Phased mass form, she will not
    // take any damage." Started Phased, the forced flip to Solid comes first, so she is Solid when she defends and takes
    // the damage; the same card, started Solid and left Solid (the optional flip declined), is the control.
    // Powerful Punch is a Protection card, so this deck is deliberately not a legal one (`requireLegalDecks` off).
    function punchGame(phased: boolean): { state: GameState; punch: InstanceId } {
      const config = wave6Scenario("rhino", { players: [{ starterDeckId: "shadowcat-aggression" }], seed: SEED });
      const setup = wave6StarterDeckSetup("shadowcat-aggression");
      const swapped = [...setup.deck];
      swapped.splice(swapped.indexOf("32046" as never), 1, "32014" as never);
      const created = createGame(
        { ...config, requireLegalDecks: false, players: [{ ...config.players[0]!, deck: swapped }] },
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      let state = created.state;
      for (let guard = 0; state.step.phase !== "player" && state.pendingChoice; guard++) {
        const choice = state.pendingChoice;
        state = applyOk(
          state,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: firstLegal(state),
          },
          WAVE6_DEPS,
        ).state;
      }
      state = strongVillain(state);
      if (phased) state = drive(state, use(P1, hero(state), "32030b.kitty-pryde-constant")).state;
      state = drive(state, toHero(P1)).state;
      const given = moveToHand(state, P1, "32014");
      return { state: stackEncounterDeck(given.state, "01186", "01186"), punch: given.ids[0]! };
    }
    const punchedPhase = (phased: boolean, accept: readonly string[]) => {
      const { state, punch } = punchGame(phased);
      expect(isPhased(state)).toBe(phased);
      const result = drive(
        state,
        { type: "endTurn", playerId: P1 },
        choosing(["32014.powerful-punch-constant", ...accept], 2),
      );
      return { ...result, punch, before: state };
    };

    it("started Phased: the punch's attack flips her to Solid (forced) before the villain's damage, so she takes it", () => {
      const { state, events, punch, before } = punchedPhase(true, []);
      expect(playerOf(state, P1).discard).toContain(punch);
      expect(inst(state, villainOf(state)).damage).toBeGreaterThanOrEqual(4);
      expect(formEvents(events)[0]).toBe("Solid");
      const flip = events.findIndex(
        (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "formChanged",
      );
      const hit = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === hero(before));
      expect(flip).toBeGreaterThanOrEqual(0);
      expect(hit).toBeGreaterThan(flip);
      expect(inst(state, hero(before)).damage).toBeGreaterThan(0);
    });

    it("control, started Solid with the optional flip declined: she defends as Solid and takes the damage too", () => {
      const { state, before } = punchedPhase(false, []);
      expect(inst(state, villainOf(state)).damage).toBeGreaterThanOrEqual(4);
      expect(isPhased(state)).toBe(false);
      expect(inst(state, hero(before)).damage).toBeGreaterThan(0);
    });
  });

  describe("RRG 1.8 'Permanent' (p. 32): Solid / Phased (32031, Permanent) is not a valid target for another set's discard", () => {
    // "Permanent cards are not valid targets for card effects that would cause the permanent card to leave play ... If a
    // permanent card would be targeted by such an effect (for example 'discard the lowest-cost support you control'), that
    // effect instead targets the non-permanent card that fits its criteria." Standard treachery 01188 (a Core card):
    // "When Revealed: Discard an upgrade or support you control. If no cards were discarded this way, this card gains surge."
    const reveal = (withUpgrade: boolean) => {
      const base = drive(shadowcatGame("rhino", { seed: SEED }), toHero(P1)).state;
      const upgraded = withUpgrade ? attach(base, "32034", hero(base)) : { state: base, id: null };
      const staged = stackEncounterDeck(upgraded.state, "01186", "01188");
      const after = drive(staged, { type: "endTurn", playerId: P1 }).state;
      const deck = Object.values(after.encounterDecks)[0]!.deck.length;
      return { after, upgrade: upgraded.id, deck };
    };

    it("with only the mass form to discard, it stays in play and 01188 gains surge", () => {
      const { after, deck } = reveal(false);
      const form = massForm(after);
      expect(inst(after, hero(after)).attachments).toContain(form);
      expect(playerOf(after, P1).discard).not.toContain(form);
      // Surge revealed one more card than the control, where an upgrade was discarded instead.
      expect(deck).toBeLessThan(reveal(true).deck);
    });

    it("with another upgrade attached, that upgrade is discarded and the mass form stays", () => {
      const { after, upgrade } = reveal(true);
      expect(playerOf(after, P1).discard).toContain(upgrade);
      expect(inst(after, hero(after)).attachments).toContain(massForm(after));
    });
  });

  describe("MC32 rulebook p. 3 'Additional Forms' and RRG 1.8 'Form, Change Form' (p. 21): a mass form change is a form change for card effects", () => {
    // "it does count as changing forms for the purpose of triggering card effects such as Ready to Rumble."
    // Ready to Rumble (32051): "Hero Response: After you change form, discard this card -> ready your hero."
    const withRumble = () => {
      const base = drive(shadowcatGame("rhino", { seed: SEED }), toHero(P1)).state;
      const given = moveToHand(base, P1, "32051");
      const [rumble] = given.ids as [InstanceId];
      const played = drive(given.state, play(P1, rumble, payWith(given.state, P1, 1, [rumble])), choosing([], 1)).state;
      return { state: played, rumble };
    };
    const attack = (state: GameState): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(state),
      targetInstanceId: villainOf(state),
    });

    it("her attack's flip to Phased offers Ready to Rumble, and accepting readies the exhausted hero", () => {
      const { state, rumble } = withRumble();
      const result = drive(state, attack(state), choosing(["32031a.solid-response", "32051.ready-to-rumble-response"]));
      expect(isPhased(result.state)).toBe(true);
      expect(inst(result.state, hero(state)).exhausted).toBe(false);
      expect(playerOf(result.state, P1).discard).toContain(rumble);
    });

    it("control: with the flip declined (no form change), the attack leaves her exhausted and the card in play", () => {
      const { state, rumble } = withRumble();
      const result = drive(state, attack(state), choosing(["32051.ready-to-rumble-response"]));
      expect(isPhased(result.state)).toBe(false);
      expect(inst(result.state, hero(state)).exhausted).toBe(true);
      expect(playerOf(result.state, P1).discard).not.toContain(rumble);
    });
  });

  describe("RRG 1.8 Appendix I 'Player Decks' (p. 50): permanent cards are not counted in the deck size", () => {
    // "A player's deck consists of a minimum of 40 cards and a maximum of 50 cards. The identity card and any cards with
    // the permanent keyword are not counted as part of this number." Her precon lists Solid / Phased (permanent) among 41.
    const precon = (): DeckContents => {
      const deck = MUT_GEN_STARTER_DECKS.find((d) => d.id === "shadowcat-aggression")!;
      return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
    };
    const pool = [...WAVE6_CARDS, ...CORE_CARDS];

    it("the precon (40 counted cards plus Solid) is legal, and dropping one counted card is a deck_size problem", () => {
      expect(validateDeck(precon(), pool)).toEqual({ ok: true });
      // One copy of Aggressive Energy (32047, an aspect card, not part of her identity set).
      const short: DeckContents = {
        ...precon(),
        cards: precon()
          .cards.map((l) => (l.cardId === "32047" ? { ...l, quantity: l.quantity - 1 } : l))
          .filter((l) => l.quantity > 0),
      };
      const verdict = validateDeck(short, pool);
      expect(verdict.ok).toBe(false);
      if (verdict.ok) return;
      expect(verdict.problems.map((p) => p.code)).toEqual(["deck_size"]);
      expect(verdict.problems[0]?.message).toContain("39");
    });
  });
});

const DUO = [{ starterDeckId: "shadowcat-aggression" }, { starterDeckId: "colossus-protection" }] as const;
const SOLO = [{ starterDeckId: "shadowcat-aggression" }] as const;

const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Colossus)", options: { players: DUO } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];

const eventsOf = (result: DriverResult): readonly GameEvent[] => {
  const again = replay(result.session.log, WAVE6_DEPS);
  expect(again.ok).toBe(true);
  if (!again.ok) throw new Error("replay failed");
  expect(again.state).toEqual(result.session.state);
  return again.events;
};

describe.each(VARIANTS)("Shadowcat vs Rhino ($label)", ({ options }) => {
  it("plays to an outcome and replays deep-equal, her mass form flipping to Phased and back to Solid", () => {
    // The signature mechanic as scripted: Solid / Phased changed to Phased (Solid's Response, Phase Control or Quick
    // Shift) and back to Solid (Phased's Forced Response). Seeds are the first match of a fixed range, so a run always
    // finds the same game. Played from setup, no surgery.
    let found: { result: DriverResult; events: readonly GameEvent[] } | null = null;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const created = createGame(wave6Scenario("rhino", { ...options, seed }), WAVE6_DEPS);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const result = playToOutcome(created.state, WAVE6_DEPS);
      if (!result.outcome) continue;
      const played = replay(result.session.log, WAVE6_DEPS);
      if (!played.ok) throw new Error("replay failed");
      const forms = formEvents(played.events);
      const toPhased = forms.indexOf("Phased");
      if (toPhased >= 0 && forms.slice(toPhased + 1).includes("Solid")) found = { result, events: played.events };
    }
    if (!found) throw new Error("no seed of 1..40 flipped her mass form to Phased and back");
    expect(found.result.outcome).not.toBeNull();
    expect(eventsOf(found.result)).toEqual(found.events);
    expect(cardId("32031a")).toBeDefined();
  }, 600_000);
});
