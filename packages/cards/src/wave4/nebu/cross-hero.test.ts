import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { engageMinion } from "../../wave3/drax/support.js";
import { WAVE4_DEPS } from "../index.js";
import { wave4Scenario } from "../setup.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Nebula pack
 * (`nebu`, 22001a-22035) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:22001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Nebula deck could hold) —
 * played through the engine from a Core hero's own precon instead of Nebula's.
 *
 * Covered: justice 22011 Eros, 22012 Wraith, 22013 Venom, 22014 Justice Served, 22015 One Way or Another, 22016
 * Determination, 22017 The Power of Justice, 22018 Brains Over Brawn, 22019 Heroic Intuition (all Spider-Man); basic
 * 22020 Cosmo, 22022 Daughters of Thanos (Team-Up (Gamora and Nebula), RRG 1.8 "Team-Up" p. 43: deck validation refuses
 * it in any Core deck, so it can never be played from one; asserted refused), 22023 First Aid (Spider-Man); aggression 22032 Energy Spear (She-Hulk, on Cosmo, the one
 * guardian ally a Core deck can hold); leadership 22033 Guardians of the Galaxy (Captain Marvel; no Core character is
 * a guardian, so its conditional draw never fires without Honorary Guardian staged on the hero; with it, the draw fires); protection 22034 Defensive Training (Black Panther). Refused for
 * the guardian gate no Core identity meets (`requiresIdentityTrait`; every Core hero face is Avenger/..., none
 * Guardian): 22021 Knowhere and 22035 Honorary Guardian.
 * Printed ability forms checked against the card data: Eros / Cosmo / Knowhere / Venom plain Response, Interrupt and
 * constant; Wraith "Hero Interrupt" (not offered in alter-ego form), Determination "Hero Response" (not offered in
 * alter-ego form), First Aid plain "Action" (usable in
 * alter-ego form), Defensive Training "Alter-Ego Action" (usable in alter-ego, refused in hero form).
 * Skipped: 22024-22026 Energy, Genius, Strength (resources with no ability script); 22002-22010 and 22027-22031 are
 * Nebula's identity-specific, obligation, nemesis and encounter cards, not aspect/basic cards. The pack's reprints
 * (22017 The Power of Justice, 22019 Heroic Intuition, 22020 Cosmo, 22021 Knowhere, 22023 First Aid) are scripted
 * under their own ids (`PACK_OWN_ABILITIES`, `../reprints.ts`), so they are tested here, not skipped.
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  wave4Scenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";
const SHOCKER = "01103"; // ATK 2, HP 3, no keywords

const settleP = (state: GameState, pick: Picker, until?: (s: GameState) => boolean) =>
  settle(state, pick, until, WAVE4_DEPS);

const toHeroFirst = (state: GameState): GameState => settleP(runWith(WAVE4_DEPS, state, toHero(P1)), firstLegal);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Seat the deck with `requireLegalDecks: false` (an off-aspect or identity-specific extra card, e.g. Gamora). */
  readonly relaxLegality?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect or basic). */
  readonly extraDeck?: readonly string[];
}

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: OpenOptions = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const config = buildScenario([seated]);
  const created = createGame(options.relaxLegality ? { ...config, requireLegalDecks: false } : config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settleP(created.state, firstLegal, (s) => s.step.phase === "player");
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

const iconsOf = (card: AnyCard): Record<string, number> =>
  "resourceIcons" in card ? (card.resourceIcons as Record<string, number>) : {};
const singleIcon = (card: AnyCard): boolean => Object.values(iconsOf(card)).reduce((a, b) => a + (b ?? 0), 0) === 1;

/** Moves `n` single-icon non-resource cards into P1's hand (never `exclude`; `only`, when given, narrows to those
 * whose single icon is that one) and returns their ids — single-value payment cards, so a payment's size is exactly
 * its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  only?: string,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  // moveToHand resolves by card code, so a filler sharing a code with an excluded card could resolve to that card.
  const excludedCodes = new Set(exclude.map((id) => state.instances[id]?.cardId as string));
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || excludedCodes.has(card.id as string) || card.type === "resource" || !singleIcon(card)) continue;
    if (only && !(iconsOf(card)[only]! >= 1)) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  const ids = probe.ids.filter((id) => !exclude.includes(id));
  return { state: probe.state, ids };
}

/** Accepts the named optional response/interrupt (by ability id), pays a `payForCard` prompt with whatever hand
 * cards it offers up to the printed cost, picks every offered target (up to the maximum) at a `chooseTarget`
 * prompt, and declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    if (hits.length > 0) return hits.slice(0, choice.maxSelections);
    if (choice.prompt.kind === "chooseTarget")
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    return firstLegal(state);
  };

const targeting =
  (target: string, base: Picker = firstLegal): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseTarget" ? [target] : base(state);

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState =>
  settleP(runWith(WAVE4_DEPS, state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})), pick);

const refused = (state: GameState, id: InstanceId, payment: readonly InstanceId[], attachTo?: InstanceId): boolean =>
  !applyCommand(state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {}), WAVE4_DEPS).ok;

/** Moves `code` to hand and plays it, paying its printed cost with single-icon fillers. */
function playCode(state: GameState, code: string, exclude: readonly InstanceId[] = [], pick: Picker = firstLegal) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as readonly [InstanceId];
  const pay = filler(given.state, costOf(code), [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick), id };
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settleP(
    runWith(WAVE4_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: target,
    }),
    pick,
  );

const basicThwart = (state: GameState, thwarter: InstanceId, scheme: InstanceId, pick: Picker = firstLegal) =>
  settleP(
    runWith(WAVE4_DEPS, state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: thwarter,
      schemeInstanceId: scheme,
    } as never),
    pick,
  );

/** Ends P1's turn so the villain phase runs (an Advance, boost card stacked as `boostCode`). */
function villainPhase(state: GameState, pick: Picker = firstLegal, boostCode = "01186"): GameState {
  return settleP(runWith(WAVE4_DEPS, stackEncounterDeck(state, boostCode), endTurn(P1)), pick);
}

describe("Nebula justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("22011.eros-response: confuses a minion for each [mental] resource spent paying for him, none for other icons", () => {
    const { state: opened, id: eros } = openHandFor("22011", SPIDER_MAN);
    const staged = engageMinion(engageMinion(opened, SHOCKER, "eros-a"), SHOCKER, "eros-b");
    const mental = filler(staged, costOf("22011"), [eros], "mental");
    const after = playCard(mental.state, eros, mental.ids, accepting("22011.eros-response"));
    expect(cardsInPlay(after)).toContain(eros);
    expect(inst(after, "eros-a" as InstanceId).statuses.confused).toBe(1);
    expect(inst(after, "eros-b" as InstanceId).statuses.confused).toBe(1);
    // Control: paid with [physical] resources only, no minion is confused.
    const physical = filler(staged, costOf("22011"), [eros], "physical");
    const control = playCard(physical.state, eros, physical.ids, accepting("22011.eros-response"));
    expect(inst(control, "eros-a" as InstanceId).statuses.confused).toBe(0);
    expect(inst(control, "eros-b" as InstanceId).statuses.confused).toBe(0);
  });

  it("22012.wraith-interrupt: Hero Interrupt, when a boost card is turned faceup, exhaust and 1 damage to Wraith", () => {
    const { state: opened, id: wraith } = openHandFor("22012", SPIDER_MAN);
    const pay = filler(opened, costOf("22012"), [wraith]);
    const inPlay = playCard(pay.state, wraith, pay.ids);
    const after = villainPhase(inPlay, accepting("22012.wraith-interrupt"));
    expect(inst(after, wraith).exhausted).toBe(true);
    expect(inst(after, wraith).damage).toBe(1);
    // Control: declining leaves Wraith untouched.
    const control = villainPhase(inPlay, firstLegal);
    expect(inst(control, wraith).damage).toBe(0);
  });

  it("22012.wraith-interrupt: a Hero Interrupt is not offered in alter-ego form", () => {
    const { state: opened, id: wraith } = openHandFor("22012", SPIDER_MAN, { alterEgo: true });
    expect(playerOf(opened, P1).identity.form).toBe("alterEgo");
    const pay = filler(opened, costOf("22012"), [wraith]);
    const inPlay = playCard(pay.state, wraith, pay.ids);
    const after = villainPhase(inPlay, accepting("22012.wraith-interrupt"));
    expect(inst(after, wraith).damage).toBe(0);
    expect(inst(after, wraith).exhausted).toBe(false);
  });

  it("22013.venom-constant: reduces his consequential damage by 1 only while there is no threat on the main scheme", () => {
    const { state: opened, id: venom } = openHandFor("22013", SPIDER_MAN);
    const pay = filler(opened, costOf("22013"), [venom]);
    const inPlay = playCard(pay.state, venom, pay.ids);
    const villain = activeVillain(inPlay).instanceId;
    const scheme = inPlay.mainScheme.instanceId;
    const noThreat = basicAttack(patchInstance(inPlay, scheme, { threat: 0 }), venom, villain);
    expect(inst(noThreat, venom).damage).toBe(1); // printed consequential damage 2, reduced by 1
    const withThreat = basicAttack(patchInstance(inPlay, scheme, { threat: 3 }), venom, villain);
    expect(inst(withThreat, venom).damage).toBe(2);
  });

  it("22014.justice-served-response: Hero Response, after you remove the last threat from a scheme, discard it and ready your hero", () => {
    const { state: opened, id: card } = openHandFor("22014", SPIDER_MAN);
    const pay = filler(opened, costOf("22014"), [card]);
    const inPlay = playCard(pay.state, card, pay.ids);
    const hero = identityOf(inPlay);
    const thw = characterProfile(inPlay, hero, WAVE4_DEPS)!.thw;
    const scheme = inPlay.mainScheme.instanceId;
    const last = patchInstance(inPlay, scheme, { threat: thw });
    const after = basicThwart(last, hero, scheme, accepting("22014.justice-served-response"));
    expect(inst(after, scheme).threat).toBe(0);
    expect(playerOf(after, P1).discard).toContain(card);
    expect(inst(after, hero).exhausted).toBe(false);
    // Control: threat remains after the thwart, so the hero stays exhausted and the upgrade stays.
    const notLast = basicThwart(
      patchInstance(inPlay, scheme, { threat: thw + 2 }),
      hero,
      scheme,
      accepting("22014.justice-served-response"),
    );
    expect(inst(notLast, hero).exhausted).toBe(true);
    expect(cardsInPlay(notLast)).toContain(card);
  });

  it("22015.one-way-or-another-action: Hero Action, search the encounter deck for a side scheme, reveal it, draw 3; max 1 per round", () => {
    const { state: opened, id: first } = openHandFor("22015", SPIDER_MAN, { extraDeck: ["22015"] });
    const both = moveToHand(opened, P1, "22015", "22015");
    const second = both.ids.find((id) => id !== first)!;
    const deck = activeEncounterDeck(both.state);
    const sideScheme = [...deck.deck].map((id) => cardOf(both.state, id)).find((c) => c.type === "side_scheme");
    expect(sideScheme).toBeDefined(); // Rhino's encounter deck carries side schemes (Bomb Scare / Breakin' & Takin')
    const handBefore = playerOf(both.state, P1).hand.length;
    const takeOne: Picker = (st) =>
      st.pendingChoice?.prompt.kind === "chooseCards"
        ? st.pendingChoice.options.slice(0, 1).map((o) => o.optionId)
        : firstLegal(st);
    const after = playCard(both.state, first, [], takeOne);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 + 3);
    // The searched side scheme is revealed into the villain area (one more side scheme than before).
    const sideSchemesIn = (st: GameState) => st.villainArea.filter((x) => cardOf(st, x).type === "side_scheme").length;
    expect(sideSchemesIn(after)).toBe(sideSchemesIn(both.state) + 1);
    expect(refused(after, second, [])).toBe(true); // "Max 1 per round"
  });

  it("22015.one-way-or-another-action: a Hero Action event is refused in alter-ego form", () => {
    const { state, id } = openHandFor("22015", SPIDER_MAN, { alterEgo: true });
    expect(refused(state, id, [])).toBe(true);
  });

  it("22016.determination-response: Hero Response, after you spend it, remove 1 threat from the main scheme", () => {
    const { state: opened, id: determination } = openHandFor("22016", SPIDER_MAN);
    const scheme = opened.mainScheme.instanceId;
    const staged = patchInstance(opened, scheme, { threat: 5 });
    const ally = [...playerOf(staged, P1).deck, ...playerOf(staged, P1).hand].find((id) => {
      const c = cardOf(staged, id);
      return c.type === "ally" && costOf(c.id as string) >= 1 && costOf(c.id as string) <= 3;
    })!;
    const allyCode = cardOf(staged, ally).id as string;
    const given = moveToHand(staged, P1, allyCode);
    const cost = costOf(allyCode);
    const pay = filler(given.state, cost - 1, [determination, given.ids[0]!]);
    const after = playCard(
      pay.state,
      given.ids[0]!,
      [determination, ...pay.ids],
      accepting("22016.determination-response"),
    );
    expect(inst(after, scheme).threat).toBe(4);
  });

  it("22016.determination-response: a Hero Response is not offered in alter-ego form", () => {
    const { state: opened, id: determination } = openHandFor("22016", SPIDER_MAN, { alterEgo: true });
    const scheme = opened.mainScheme.instanceId;
    const staged = patchInstance(opened, scheme, { threat: 5 });
    const ally = [...playerOf(staged, P1).deck, ...playerOf(staged, P1).hand].find((id) => {
      const c = cardOf(staged, id);
      return c.type === "ally" && costOf(c.id as string) >= 1 && costOf(c.id as string) <= 3;
    })!;
    const allyCode = cardOf(staged, ally).id as string;
    const given = moveToHand(staged, P1, allyCode);
    const pay = filler(given.state, costOf(allyCode) - 1, [determination, given.ids[0]!]);
    const after = playCard(
      pay.state,
      given.ids[0]!,
      [determination, ...pay.ids],
      accepting("22016.determination-response"),
    );
    expect(inst(after, scheme).threat).toBe(5);
  });

  it("22017.the-power-of-justice-constant: doubles the resources it generates while paying for a Justice card only", () => {
    const { state: opened, id: power } = openHandFor("22017", SPIDER_MAN, { extraDeck: ["22019", "22020"] });
    const given = moveToHand(opened, P1, "22019", "22020"); // Heroic Intuition (justice, cost 2), Cosmo (basic, cost 2)
    const [intuition, cosmo] = given.ids as [InstanceId, InstanceId];
    const paid = playCard(given.state, intuition, [power]);
    expect(playerOf(paid, P1).discard).toContain(power);
    expect(cardsInPlay(paid)).toContain(intuition);
    expect(refused(given.state, cosmo, [power])).toBe(true); // a basic card gets no doubling: 1 resource < cost 2
  });

  it("22018.brains-over-brawn-response: Hero Response (attack), after your hero's basic thwart, damage an enemy equal to your hero's THW", () => {
    const { state: opened, id: brains } = openHandFor("22018", SPIDER_MAN);
    const hero = identityOf(opened);
    const thw = characterProfile(opened, hero, WAVE4_DEPS)!.thw;
    const scheme = opened.mainScheme.instanceId;
    const staged = patchInstance(opened, scheme, { threat: thw + 5 });
    const villain = activeVillain(staged).instanceId;
    const damageBefore = inst(staged, villain).damage;
    const after = basicThwart(staged, hero, scheme, accepting("22018.brains-over-brawn-response", villain as string));
    expect(inst(after, villain).damage).toBe(damageBefore + thw);
    expect(playerOf(after, P1).discard).toContain(brains);
  });

  it("22019.heroic-intuition-constant: your hero gets +1 THW", () => {
    const { state: opened, id } = openHandFor("22019", SPIDER_MAN);
    const hero = identityOf(opened);
    const before = characterProfile(opened, hero, WAVE4_DEPS)!.thw;
    const pay = filler(opened, costOf("22019"), [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(characterProfile(after, hero, WAVE4_DEPS)!.thw).toBe(before + 1);
  });
});

describe("Nebula basic cards, from Spider-Man (Justice)'s own deck", () => {
  /** Cosmo's own "name a card type" tree: accept the interrupt, choose a player's deck, name `category`. */
  const naming =
    (category: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":22020.cosmo-interrupt"));
        return hit ? [hit.optionId] : firstLegal(state);
      }
      if (choice.prompt.kind === "choosePlayer") return [P1];
      if (choice.prompt.kind === "chooseOption") {
        const hit = choice.options.find((o) => o.label === "A player's deck" || o.label === category);
        if (hit) return [hit.optionId];
      }
      return firstLegal(state);
    };

  it("22020.cosmo-interrupt: naming the discarded card's type prevents his consequential damage; the wrong type does not", () => {
    const { state: opened, id: cosmo } = openHandFor("22020", SPIDER_MAN);
    const pay = filler(opened, costOf("22020"), [cosmo]);
    const inPlay = playCard(pay.state, cosmo, pay.ids);
    const villain = activeVillain(inPlay).instanceId;
    const owner = playerOf(inPlay, P1);
    const event = [...owner.deck].map((id) => cardOf(inPlay, id)).find((c) => c.type === "event")!;
    const stacked = putOnTopOfDeck(inPlay, P1, event.id as string).state;
    const right = basicAttack(stacked, cosmo, villain, naming("event"));
    expect(inst(right, cosmo).damage).toBe(0);
    const wrong = basicAttack(stacked, cosmo, villain, naming("ally"));
    expect(inst(wrong, cosmo).damage).toBe(1); // printed consequential damage (attack 1)
  });

  it("22022.daughters-of-thanos-action: Team-Up (Gamora and Nebula) card cannot be in a Core hero's deck", () => {
    // RRG 1.8 "Team-Up" (p. 43): only a deck whose identity is one of the named characters may include it, so no Core
    // deck can hold or play it; deck validation refuses the seat.
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "22022");
    const created = createGame(buildScenario([seat]), WAVE4_DEPS);
    expect(created.ok).toBe(false);
  });

  it("22023.first-aid-action: a plain Action, usable in alter-ego form; heal 2 damage from any character", () => {
    for (const alterEgo of [false, true]) {
      const { state: opened, id } = openHandFor("23023".replace("23", "22"), SPIDER_MAN, { alterEgo });
      const identity = identityOf(opened);
      const damaged = patchInstance(opened, identity, { damage: 3 });
      const pay = filler(damaged, costOf("22023"), [id]);
      const after = playCard(pay.state, id, pay.ids, targeting(identity as string));
      expect(inst(after, identity).damage).toBe(1);
    }
  });

  it("22021.knowhere / 22035.honorary-guardian: refused in a Core hero's deck (Play only if your identity has the guardian trait)", () => {
    for (const code of ["22021", "22035"]) {
      for (const alterEgo of [false, true]) {
        const { state, id } = openHandFor(code, SPIDER_MAN, { alterEgo });
        const pay = filler(state, costOf(code), [id]);
        const identity = identityOf(pay.state);
        expect(refused(pay.state, id, pay.ids, code === "22035" ? identity : undefined)).toBe(true);
      }
    }
  });
});

describe("Nebula aggression and leadership cards", () => {
  it("22032.energy-spear-constant: attached guardian ally gets +2 ATK and gains piercing; not attachable to a hero", () => {
    const { state: opened, id: spear } = openHandFor("22032", SHE_HULK, { extraDeck: ["22020"] });
    const { state: withCosmo, id: cosmo } = playCode(opened, "22020", [spear]);
    const before = characterProfile(withCosmo, cosmo, WAVE4_DEPS)!.atk;
    expect(hasKeyword(withCosmo, cosmo, "piercing", WAVE4_DEPS)).toBe(false);
    const pay = filler(withCosmo, costOf("22032"), [spear, cosmo]);
    expect(refused(pay.state, spear, pay.ids, identityOf(pay.state))).toBe(true); // "Attach to a guardian ally"
    const after = playCard(pay.state, spear, pay.ids, firstLegal, cosmo);
    expect(characterProfile(after, cosmo, WAVE4_DEPS)!.atk).toBe(before + 2);
    expect(hasKeyword(after, cosmo, "piercing", WAVE4_DEPS)).toBe(true);
  });

  it("22033.guardians-of-the-galaxy-constant: with every character a guardian, drawing 1 after an upgrade is played on an ally", () => {
    // Printed: "If each of your characters has the guardian trait, this card gains: Response: After you play an upgrade
    // on an ally, draw 1 card." No Core hero is a guardian, so Honorary Guardian (22035: "gains the guardian trait") is
    // seated on the hero by surgery (its own play gate, "your identity has the guardian trait", is covered above).
    const { state: opened, id: team } = openHandFor("22033", CAP_MARVEL, {
      extraDeck: ["22002", "22035"],
      relaxLegality: true,
    });
    const pay = filler(opened, costOf("22033"), [team]);
    const withTeam = playCard(pay.state, team, pay.ids);
    const gamora = playCode(withTeam, "22002", [team]);
    const hero = identityOf(gamora.state);
    const honorary = moveToHand(gamora.state, P1, "22035");
    const [badge] = honorary.ids as [InstanceId];
    const seated: GameState = {
      ...honorary.state,
      players: honorary.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== badge), playArea: [...p.playArea, badge] } : p,
      ),
      instances: {
        ...honorary.state.instances,
        [badge]: { ...honorary.state.instances[badge]!, controllerId: P1, faceup: true, attachedTo: hero },
        [hero]: {
          ...honorary.state.instances[hero]!,
          attachments: [...honorary.state.instances[hero]!.attachments, badge],
        },
      },
    };
    const given = moveToHand(seated, P1, "01074"); // Inspired (leadership upgrade, attaches to an ally)
    const [inspired] = given.ids as [InstanceId];
    const pay2 = filler(given.state, costOf("01074"), [inspired]);
    const handBefore = playerOf(pay2.state, P1).hand.length;
    const after = playCard(
      pay2.state,
      inspired,
      pay2.ids,
      accepting("22033.guardians-of-the-galaxy-constant"),
      gamora.id,
    );
    expect(inst(after, inspired).attachedTo).toBe(gamora.id);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - pay2.ids.length + 1);
  });

  it("22033.guardians-of-the-galaxy-constant: draws on an ally upgrade only if each of your characters is a guardian (no Core hero is)", () => {
    const { state: opened, id: team } = openHandFor("22033", CAP_MARVEL);
    const pay = filler(opened, costOf("22033"), [team]);
    const withTeam = playCard(pay.state, team, pay.ids);
    expect(cardsInPlay(withTeam)).toContain(team);
    const owner = playerOf(withTeam, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const c = cardOf(withTeam, id);
      return c.type === "ally" && costOf(c.id as string) <= 3;
    })!;
    const { state: withAlly, id: ally } = playCode(withTeam, cardOf(withTeam, allyId).id as string, [team]);
    const given = moveToHand(withAlly, P1, "01074"); // Inspired (leadership upgrade, attaches to an ally)
    const [inspired] = given.ids as [InstanceId];
    const pay2 = filler(given.state, costOf("01074"), [inspired]);
    const handBefore = playerOf(pay2.state, P1).hand.length;
    const after = playCard(pay2.state, inspired, pay2.ids, accepting("22033.guardians-of-the-galaxy-constant"), ally);
    expect(inst(after, inspired).attachedTo).toBe(ally);
    // The hero is not a guardian, so the granted Response never draws: -1 upgrade, -payment only.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - pay2.ids.length);
  });
});

describe("Nebula protection cards, from Black Panther (Protection)'s own deck", () => {
  it("22034.defensive-training-action: Alter-Ego Action, exhaust + remove a training counter → shuffle a Protection event from discard into your deck", () => {
    const { state: opened, id } = openHandFor("22034", BLACK_PANTHER, { alterEgo: true });
    expect(playerOf(opened, P1).identity.form).toBe("alterEgo");
    const pay = filler(opened, costOf("22034"), [id]);
    const inPlay = playCard(pay.state, id, pay.ids);
    expect(inst(inPlay, id).counters.training).toBe(2); // Uses (2 training counters)
    const owner = playerOf(inPlay, P1);
    const event = owner.deck.find((i) => {
      const c = cardOf(inPlay, i);
      return c.type === "event" && "aspect" in c && c.aspect === "protection";
    })!;
    const withEvent: GameState = {
      ...inPlay,
      players: inPlay.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== event), discard: [...p.discard, event] } : p,
      ),
    };
    const deckBefore = playerOf(withEvent, P1).deck.length;
    const after = settleP(runWith(WAVE4_DEPS, withEvent, use(P1, id, "22034.defensive-training-action")), firstLegal);
    expect(inst(after, id).exhausted).toBe(true);
    expect(inst(after, id).counters.training).toBe(1);
    expect(playerOf(after, P1).discard).not.toContain(event);
    expect(playerOf(after, P1).deck).toContain(event);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore + 1);
  });

  it("22034.defensive-training-action: an Alter-Ego Action is refused in hero form", () => {
    const { state: opened, id } = openHandFor("22034", BLACK_PANTHER);
    expect(playerOf(opened, P1).identity.form).toBe("hero");
    const pay = filler(opened, costOf("22034"), [id]);
    const inPlay = playCard(pay.state, id, pay.ids);
    const attempt = applyCommand(inPlay, use(P1, id, "22034.defensive-training-action"), WAVE4_DEPS);
    expect(attempt.ok).toBe(false);
  });
});
