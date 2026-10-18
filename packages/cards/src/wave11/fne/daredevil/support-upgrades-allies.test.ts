import { FNE_STARTER_DECKS, PLAYABLE_CARDS, trait } from "@mc/content";
import {
  applyCommand,
  createGame,
  separateDeckOf,
  traitsOf,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, moveToDiscard, playFromHand, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `fne/daredevil/support-upgrades-allies` (docs/phase7-wave11.md section 8.4 line 4) from the printed starter
 * deck `fne-daredevil-justice` against Core's Rhino. Cards are staged into play by surgery (as the wave's other
 * modules do); every ability is then used through the engine's own commands. Owner question 2 = A (section 4.1):
 * Focus the Senses may take a Sense upgrade onto itself, where it leaves with it (January 11, 2026 R1).
 */
const ELEKTRA = "60007";
const FOCUS = "60012";
const FOGGY = "60013";
const KAREN = "60014";
const NELSON_MURDOCK = "60015";
const MAGGIE = "60016";
const BILLY_CLUB = "60017";
const MAN_WITHOUT_FEAR = "60018";
const REFS = [
  "60007.elektra-forced-interrupt",
  "60012.focus-the-senses-constant",
  "60012.when-defeated",
  "60013.foggy-nelson-action",
  "60014.karen-page-action",
  "60015.nelson-and-murdock-response",
  "60016.sister-maggie-constant",
  "60016.sister-maggie-response",
  "60017.daredevils-billy-club-constant",
  "60017.daredevils-billy-club-action",
  "60018.the-man-without-fear-action",
];
const MINION = "m-sandman" as InstanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

function newGame(seed = 1): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const alterEgoGame = (): GameState => newGame();
const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });
const senseDeck = (s: GameState) => separateDeckOf(s, P1, "Sense").deck;
const hand = (s: GameState) => s.players.find((p) => p.playerId === P1)!.hand;
const player = (s: GameState) => s.players.find((p) => p.playerId === P1)!;

/** Runs a command and answers every prompt with `pick`. */
const drive = (state: GameState, command: Command, pick: Picker = firstLegal): GameState =>
  settle(runWith(WAVE11_DEPS, state, command), pick, undefined, WAVE11_DEPS);
const useAbility = (state: GameState, id: InstanceId, ability: string, pick: Picker = firstLegal): GameState =>
  drive(state, use(P1, id, ability), pick);
const attackWith = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  drive(state, { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }, pick);
const thwartWith = (state: GameState, thwarter: InstanceId, scheme: InstanceId, pick: Picker = firstLegal) =>
  drive(state, { type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme }, pick);
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE11_DEPS).ok;

/** Accepts every optional trigger, takes the wanted cards or labelled options among the pending ones, else the first legal answer. */
const choosing =
  (...wanted: readonly (InstanceId | string)[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    const found = choice.options.filter((o) =>
      wanted.some(
        (w) =>
          (o.ref.kind === "card" && o.ref.instanceId === w) ||
          (typeof (o as { label?: unknown }).label === "string" && (o as { label: string }).label.includes(w)),
      ),
    );
    return found.length > 0 ? found.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(s);
  };

const optionCards = (s: GameState): InstanceId[] =>
  (s.pendingChoice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as InstanceId] : []));

/** Stages a Sense upgrade (60002) attached to `host`, by surgery. */
function withSenseUpgrade(state: GameState, host: InstanceId, id: string, code = "60002"): GameState {
  const upgrade = {
    instanceId: id as InstanceId,
    cardId: code,
    ownerId: P1,
    controllerId: P1,
    home: { kind: "playArea", playerId: P1 },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: host,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as never;
  const withInstance = { ...state, instances: { ...state.instances, [id]: upgrade } };
  return patchInstance(withInstance, host, {
    attachments: [...inst(withInstance, host).attachments, id as InstanceId],
  });
}

/** Focus the Senses in play (a player side scheme sits in the villain area) with `threat` on it. */
function withFocus(state: GameState, threat: number): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, FOCUS);
  const id = given.ids[0]!;
  const placed: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
    villainArea: [...given.state.villainArea, id],
  };
  return { id, state: patchInstance(placed, id, { controllerId: P1, faceup: true, threat }) };
}

describe("wave 11 fne/daredevil/support-upgrades-allies", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts all eleven refs of 60007 and 60012 to 60018, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });

  describe("60007.elektra-forced-interrupt", () => {
    it("hero form: Daredevil takes the consequential damage of Elektra's attack instead of her", () => {
      const staged = stagedInPlay(engageMinion(heroGame(), "01102", MINION), ELEKTRA);
      const after = attackWith(staged.state, staged.id, MINION);
      expect(inst(after, MINION).damage).toBe(2);
      expect(inst(after, staged.id).damage).toBe(0);
      expect(inst(after, identityOf(after)).damage).toBe(1);
    });

    it("alter-ego form: Elektra takes her own consequential damage (the interrupt is the hero form's)", () => {
      const staged = stagedInPlay(engageMinion(alterEgoGame(), "01102", MINION), ELEKTRA);
      const after = attackWith(staged.state, staged.id, MINION);
      expect(inst(after, staged.id).damage).toBe(1);
      expect(inst(after, identityOf(after)).damage).toBe(0);
    });
  });

  describe("60012.focus-the-senses-constant", () => {
    it("lets Daredevil's basic thwart remove threat", () => {
      const { state, id } = withFocus(heroGame(), 4);
      expect(inst(thwartWith(state, identityOf(state), id), id).threat).toBe(2);
    });

    it("lets Matt Murdock's Deposition and Superior Taste (a thwart by his identity) remove threat", () => {
      const { state, id } = withFocus(alterEgoGame(), 4);
      const { state: afterEvent } = playFromHand(WAVE11_DEPS, state, "60009", 1, choosing(id));
      expect(inst(afterEvent, id).threat).toBe(2);

      const hero = withFocus(heroGame(), 6);
      const taste = withSenseUpgrade(hero.state, hero.id, "taste", "60006");
      const afterTaste = thwartWith(taste, identityOf(taste), hero.id, choosing());
      // The basic thwart removes 2 (6 to 4), then the accepted response removes 2 more.
      expect(inst(afterTaste, hero.id).threat).toBe(2);
    });

    it("refuses another character's thwart (Elektra, an ally) and Foggy Nelson's removal", () => {
      const { state, id } = withFocus(heroGame(), 4);
      const elektra = stagedInPlay(state, ELEKTRA);
      expect(
        rejected(elektra.state, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: elektra.id,
          schemeInstanceId: id,
        }),
      ).toBe(true);

      const foggy = stagedInPlay(withFocus(alterEgoGame(), 4).state, FOGGY);
      const quiet = patchInstance(foggy.state, foggy.state.mainScheme.instanceId, { threat: 0 });
      // The main scheme has no threat and Focus the Senses may not be thwarted by him: no legal target at all.
      expect(rejected(quiet, use(P1, foggy.id, "60013.foggy-nelson-action"))).toBe(true);
    });
  });

  describe("60013.foggy-nelson-action", () => {
    it("removes 2 threat from a scheme, in alter-ego form only, exhausting Foggy", () => {
      const staged = stagedInPlay(alterEgoGame(), FOGGY);
      const start = patchInstance(staged.state, staged.state.mainScheme.instanceId, { threat: 9 });
      const after = useAbility(start, staged.id, "60013.foggy-nelson-action");
      expect(mainThreat(after)).toBe(7);
      expect(inst(after, staged.id).exhausted).toBe(true);

      const hero = stagedInPlay(heroGame(), FOGGY);
      expect(rejected(hero.state, use(P1, hero.id, "60013.foggy-nelson-action"))).toBe(true);
    });
  });

  describe("60014.karen-page-action", () => {
    it("shuffles a Daredevil card from the discard pile into the deck, and draws 1 in alter-ego form", () => {
      const staged = stagedInPlay(alterEgoGame(), KAREN);
      const discarded = moveToDiscard(staged.state, P1, "60008");
      const handBefore = hand(discarded.state).length;
      const after = useAbility(discarded.state, staged.id, "60014.karen-page-action");
      expect(player(after).discard).not.toContain(discarded.id);
      expect(player(after).deck.includes(discarded.id) || hand(after).includes(discarded.id)).toBe(true);
      expect(hand(after)).toHaveLength(handBefore + 1);
      expect(inst(after, staged.id).exhausted).toBe(true);
    });

    it("does not draw in hero form", () => {
      const staged = stagedInPlay(heroGame(), KAREN);
      const discarded = moveToDiscard(staged.state, P1, "60008");
      const handBefore = hand(discarded.state).length;
      const after = useAbility(discarded.state, staged.id, "60014.karen-page-action");
      expect(hand(after)).toHaveLength(handBefore);
      expect(player(after).deck).toContain(discarded.id);
    });

    it("offers a Daredevil card but not a Justice card of no hero set (60025) in the discard pile", () => {
      const staged = stagedInPlay(alterEgoGame(), KAREN);
      const other = moveToDiscard(staged.state, P1, "60025");
      const own = moveToDiscard(other.state, P1, "60008");
      let offered: InstanceId[] = [];
      useAbility(own.state, staged.id, "60014.karen-page-action", (s) => {
        offered = optionCards(s);
        return firstLegal(s);
      });
      expect(offered).toContain(own.id);
      expect(offered).not.toContain(other.id);
    });
  });

  describe("60015.nelson-and-murdock-response", () => {
    // A Core side scheme with 2 threat, defeated by Foggy Nelson's removal of 2 (Foggy is an Attorney support).
    const sideScheme = (): { state: GameState; scheme: InstanceId; foggy: InstanceId; nelson: InstanceId } => {
      const foggy = stagedInPlay(alterEgoGame(), FOGGY);
      const nelson = stagedInPlay(foggy.state, NELSON_MURDOCK);
      const scheme = encounterCardInVillainArea(nelson.state, "01107", 2);
      return { state: scheme.state, scheme: scheme.id, foggy: foggy.id, nelson: nelson.id };
    };

    it("an Attorney support that defeats a side scheme lets you confuse an enemy", () => {
      const { state, scheme, foggy } = sideScheme();
      const after = useAbility(state, foggy, "60013.foggy-nelson-action", choosing(scheme, villainOf(state)));
      expect(inst(after, scheme).threat).toBe(0);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
    });

    it("hears an event Matt Murdock plays: Deposition in alter-ego form defeats a side scheme (RRG 1.8 p. 18, p. 49)", () => {
      const { state, scheme } = sideScheme();
      const { state: after } = playFromHand(WAVE11_DEPS, state, "60009", 1, choosing(scheme));
      expect(inst(after, scheme).threat).toBe(0);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
    });

    it("does not hear Daredevil's event: Living Lie Detector in hero form (his hero face is no Attorney)", () => {
      const foggy = stagedInPlay(heroGame(), NELSON_MURDOCK);
      const scheme = encounterCardInVillainArea(foggy.state, "01107", 2);
      const { state: after } = playFromHand(WAVE11_DEPS, scheme.state, "60010", 1, choosing(scheme.id));
      expect(inst(after, scheme.id).threat).toBe(0);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(0);
    });

    it("a player side scheme is a side scheme: Matt Murdock defeating Focus the Senses answers", () => {
      const nelson = stagedInPlay(alterEgoGame(), NELSON_MURDOCK);
      const { state, id } = withFocus(nelson.state, 2);
      const { state: after } = playFromHand(WAVE11_DEPS, state, "60009", 1, choosing(id));
      expect(after.villainArea).not.toContain(id);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
    });

    it("does not answer a removal that leaves the side scheme with threat", () => {
      const { state, scheme, foggy } = sideScheme();
      const more = patchInstance(state, scheme, { threat: 3 });
      const after = useAbility(more, foggy, "60013.foggy-nelson-action", choosing(scheme));
      expect(inst(after, scheme).threat).toBe(1);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(0);
    });
  });

  describe("60016.sister-maggie", () => {
    it("Matt Murdock gets +3 REC (3 + 3 heals 6 of 8)", () => {
      const staged = stagedInPlay(alterEgoGame(), MAGGIE);
      const hurt = patchInstance(staged.state, identityOf(staged.state), { damage: 8 });
      const after = drive(hurt, { type: "basicRecover", playerId: P1 });
      expect(inst(after, identityOf(after)).damage).toBe(2);
    });

    it("after you recover, discards a status card from your identity of your choosing", () => {
      const staged = stagedInPlay(alterEgoGame(), MAGGIE);
      const marked = patchInstance(staged.state, identityOf(staged.state), {
        damage: 3,
        statuses: { stunned: 1, confused: 1, tough: 0 },
      });
      const after = drive(marked, { type: "basicRecover", playerId: P1 }, choosing("confused"));
      expect(inst(after, identityOf(after)).statuses).toEqual({ stunned: 1, confused: 0, tough: 0 });
    });
  });

  describe("60017.daredevils-billy-club", () => {
    const withClub = () => stagedInPlay(engageMinion(heroGame(), "01102", MINION), BILLY_CLUB, { attach: true });

    it("Daredevil gets +1 ATK: his basic attack deals 3", () => {
      const club = withClub();
      const after = attackWith(club.state, identityOf(club.state), MINION);
      expect(inst(after, MINION).damage).toBe(3);
    });

    it("Action: returning the card to hand deals 1 damage to an enemy", () => {
      const club = withClub();
      const after = useAbility(
        club.state,
        club.id,
        "60017.daredevils-billy-club-action",
        choosing("Deal 1 damage", MINION),
      );
      expect(hand(after)).toContain(club.id);
      expect(inst(after, MINION).damage).toBe(1);
    });

    it("Action: or Daredevil gains the Aerial trait until the end of the round", () => {
      const club = withClub();
      const after = useAbility(club.state, club.id, "60017.daredevils-billy-club-action", choosing("Aerial"));
      expect(hand(after)).toContain(club.id);
      expect(traitsOf(after, identityOf(after), WAVE11_DEPS)).toContain(trait("AERIAL"));
    });
  });

  describe("60018.the-man-without-fear-action", () => {
    const withTitle = () => stagedInPlay(heroGame(), MAN_WITHOUT_FEAR, { attach: true });

    it("exhausts and deals 1 damage to Daredevil, then readies him", () => {
      const title = withTitle();
      const tired = patchInstance(title.state, identityOf(title.state), { exhausted: true });
      const after = useAbility(tired, title.id, "60018.the-man-without-fear-action", choosing("Ready"));
      expect(inst(after, title.id).exhausted).toBe(true);
      expect(inst(after, identityOf(after)).damage).toBe(1);
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
    });

    it("or plays any upgrade from the Sense deck for 0, leaving the rest of the deck in order", () => {
      const title = withTitle();
      const before = senseDeck(title.state);
      const fourth = before[3]!;
      const after = useAbility(
        title.state,
        title.id,
        "60018.the-man-without-fear-action",
        choosing("Play any", fourth),
      );
      expect(senseDeck(after)).toEqual(before.filter((i) => i !== fourth));
      expect(inst(after, fourth).attachedTo).not.toBeNull();
      expect(inst(after, identityOf(after)).damage).toBe(1);
      expect(hand(after)).toHaveLength(hand(title.state).length);
    });
  });

  describe("60012.when-defeated", () => {
    /** Focus the Senses at 2 threat, a minion carrying a Sense upgrade; Daredevil's basic thwart (2) defeats it. */
    const scene = () => {
      const engaged = engageMinion(heroGame(), "01102", MINION);
      const focus = withFocus(withSenseUpgrade(engaged, MINION, "sense-on-minion"), 2);
      return { ...focus, upgrade: "sense-on-minion" as InstanceId };
    };

    it("moves a Sense upgrade onto Focus the Senses itself (question 2 = A): it leaves with it, to the Sense deck's bottom", () => {
      const { state, id, upgrade } = scene();
      const before = senseDeck(state);
      const after = thwartWith(state, identityOf(state), id, choosing(upgrade, id));
      expect(after.villainArea).not.toContain(id);
      expect(senseDeck(after)).toEqual([...before, upgrade]);
      expect(inst(after, upgrade).attachedTo).toBeNull();
    });

    it("moves a Sense upgrade to another card it can attach to, never back onto its current host", () => {
      const { state, id, upgrade } = scene();
      let offered: InstanceId[] = [];
      const after = thwartWith(state, identityOf(state), id, (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTarget") offered = optionCards(s);
        return choosing(upgrade, villainOf(state))(s);
      });
      expect(offered).not.toContain(MINION);
      expect(offered).toContain(id);
      expect(inst(after, upgrade).attachedTo).toBe(villainOf(state));
      expect(senseDeck(after)).toEqual(senseDeck(state));
    });

    it("may move none, and may fetch any number of Sense upgrades from the Sense deck without shuffling", () => {
      const { state, id } = scene();
      const before = senseDeck(state);
      const wanted = [before[1]!, before[3]!];
      const after = thwartWith(state, identityOf(state), id, (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseCards") {
          const fromDeck = optionCards(s).filter((c) => wanted.includes(c));
          return choice.options
            .filter((o) => o.ref.kind === "card" && fromDeck.includes(o.ref.instanceId as InstanceId))
            .map((o) => o.optionId);
        }
        return firstLegal(s);
      });
      expect(senseDeck(after)).toEqual(before.filter((i) => !wanted.includes(i)));
      for (const w of wanted) expect(inst(after, w).attachedTo).not.toBeNull();
      expect(inst(after, "sense-on-minion" as InstanceId).attachedTo).toBe(MINION);
    });
  });
});
