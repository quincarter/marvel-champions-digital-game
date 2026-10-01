import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  mainSchemeValue,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { forceMinionIntoPlay } from "./testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Thor pack
 * (`thor`, 06001a-06034) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:06001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Thor deck could hold) —
 * played through the engine from a Core hero's own precon instead of Thor's (`thor-aggression`).
 *
 * Covered (13): 06011 Hercules, 06012 Valkyrie, 06014 Get Over Here!, 06015 Mean Swing, 06017 Hall of Heroes (both
 * abilities), 06018 Battle Fury, 06019 Jarnbjorn, 06020 Heimdall, 06021 Invulnerability, 06031 Under Surveillance,
 * 06032 Teamwork, 06033 Second Wind, 06034 Enhanced Physique.
 * Skipped: 06013 Chase Them Down (verbatim Core 01052), 06016 The Power of Aggression (verbatim Core 01055) and 06025
 * Avengers Mansion (verbatim Core 01091), all aliased in `../reprints.ts`; 06022-06024 Energy/Genius/Strength print
 * no ability (`abilities: []`); 06026-06030 are the obligation/encounter cards, not player aspect cards.
 *
 * Seats: aggression cards in She-Hulk/Aggression, justice and basic in Spider-Man/Justice, leadership in Captain
 * Marvel/Leadership, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`).
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";

/** Leaves any pending choice settled with the villain/first option (She-Hulk's own form-change response, `01019a`,
 * leaves a target choice pending), then changes P1 into hero form. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra copies of other cards to seat in the deck (legal in the hero's aspect). */
  readonly extraDeck?: readonly string[];
  /** A second seat (P2), for a minion engaged with someone else. */
  readonly otherSeat?: string;
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
  const players = options.otherSeat ? [seated, playableStarterDeckSetup(options.otherSeat)] : [seated];
  const created = createGame(buildScenario(players), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` non-resource cards passing `ok` into P1's hand (never `exclude`) and returns their ids — single-value
 * payment cards, so a payment's size is exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
  ok: (card: AnyCard) => boolean = () => true,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource" || !ok(card)) continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  // `moveToHand` takes the first hand-or-deck copy of each code that it has not already returned.
  const probe = moveToHand(state, P1, ...codes);
  const ids = probe.ids.filter((id) => !exclude.includes(id));
  return { state: probe.state, ids };
}

const energyIcon = (card: AnyCard): boolean => "resourceIcons" in card && (card.resourceIcons.energy ?? 0) > 0;
const mentalIcon = (card: AnyCard): boolean => "resourceIcons" in card && (card.resourceIcons.mental ?? 0) > 0;
const noWildOrIcon = (icon: "energy" | "mental") => (card: AnyCard) =>
  !(icon === "energy" ? energyIcon(card) : mentalIcon(card));

/** Accepts the named optional response/interrupt (by ability id), and pays/declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Plays `id` paying with exactly `payment`, settling every prompt with `pick`. */
const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Puts a copy of core minion `code` (an Rhino-scenario encounter card) in play engaged with `player`. */
function withMinion(state: GameState, code: string, player = P1): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, player), minion };
}

const basicAttack = (state: GameState, target: InstanceId, pick: Picker = firstLegal): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: target,
    }),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

const atkOf = (state: GameState): number => characterProfile(state, identityOf(state), PLAYABLE_DEPS)!.atk;

describe("Thor's aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("06011.hercules-constant: costs 1 less per minion engaged with you, from hand", () => {
    const { state: opened, id: hercules } = openHandFor("06011", SHE_HULK);
    const { state: engaged } = withMinion(opened, "01101"); // 1 engaged Hydra Mercenary: printed 6 becomes 5.
    const { state, ids } = filler(engaged, 5, [hercules]);
    const underpaid = applyCommand(state, play(P1, hercules, ids.slice(0, 4)), PLAYABLE_DEPS);
    expect(underpaid.ok).toBe(false);
    const after = playCard(state, hercules, ids.slice(0, 5));
    expect(playerOf(after, P1).playArea).toContain(hercules);
  });

  it("06012.valkyrie-response: deals 3 damage to a minion when paid with [energy], else 2", () => {
    const { state: opened, id: valkyrie } = openHandFor("06012", SHE_HULK);
    const { state: staged, minion } = withMinion(opened, "01102"); // Sandman, 4 HP
    const before = inst(staged, minion).damage;
    const withEnergy = filler(staged, 1, [valkyrie], energyIcon);
    const rest = filler(withEnergy.state, 2, [valkyrie, ...withEnergy.ids], noWildOrIcon("energy"));
    const paidEnergy = playCard(
      rest.state,
      valkyrie,
      [...withEnergy.ids, ...rest.ids],
      accepting("06012.valkyrie-response"),
    );
    expect(inst(paidEnergy, minion).damage).toBe(before + 3);

    const noEnergy = filler(staged, 3, [valkyrie], noWildOrIcon("energy"));
    const paidOther = playCard(noEnergy.state, valkyrie, noEnergy.ids, accepting("06012.valkyrie-response"));
    expect(inst(paidOther, minion).damage).toBe(before + 2);
  });

  it("06014.get-over-here-action: deals 1 damage to a minion; without the Aerial trait it does not engage it", () => {
    // The minion is engaged with P2, so "engage that enemy" would visibly move it to P1 if the script wrongly fired.
    const { state: opened, id } = openHandFor("06014", SHE_HULK, { otherSeat: CAP_MARVEL });
    const { state, minion } = withMinion(opened, "01102", "p2" as never);
    expect(inst(state, minion).engagedWith).toBe("p2");
    const before = inst(state, minion).damage;
    const after = playCard(state, id, []);
    expect(inst(after, minion).damage).toBe(before + 1);
    expect(inst(after, minion).engagedWith).toBe("p2");
  });

  it("06015.mean-swing-interrupt: exhausting a Weapon upgrade on your hero gives +3 ATK to a basic attack", () => {
    const { state: opened, id: meanSwing } = openHandFor("06015", SHE_HULK, { extraDeck: ["06019"] });
    const given = moveToHand(opened, P1, "06019");
    const [jarnbjorn] = given.ids as readonly [InstanceId];
    const pay = filler(given.state, 1, [meanSwing, jarnbjorn]);
    const armed = playCard(pay.state, jarnbjorn, pay.ids);
    expect(inst(armed, jarnbjorn).attachedTo).toBe(identityOf(armed));
    const villain = armed.villains[0]!.instanceId;
    const before = inst(armed, villain).damage;
    const after = basicAttack(armed, villain, accepting("06015.mean-swing-interrupt"));
    expect(inst(after, jarnbjorn).exhausted).toBe(true);
    expect(inst(after, villain).damage).toBe(before + atkOf(armed) + 3);
  });

  it("06017.hall-of-heroes-response: places 1 glory counter after you defeat a minion", () => {
    const { state: opened, id: hall } = openHandFor("06017", SHE_HULK);
    const pay = filler(opened, 2, [hall]);
    const inPlay = playCard(pay.state, hall, pay.ids);
    const { state, minion } = withMinion(inPlay, "01101");
    const primed = patchInstance(state, minion, { damage: 999 });
    const after = basicAttack(primed, minion, accepting("06017.hall-of-heroes-response"));
    expect(cardsInPlay(after)).not.toContain(minion);
    expect(inst(after, hall).counters.glory).toBe(1);
  });

  it("06017.hall-of-heroes-action: Alter-Ego Action, exhaust and remove 3 glory counters to draw 3", () => {
    const { state: opened, id: hall } = openHandFor("06017", SHE_HULK, { alterEgo: true });
    const pay = filler(opened, 2, [hall]);
    const inPlay = playCard(pay.state, hall, pay.ids);
    const patched = patchInstance(inPlay, hall, { counters: { glory: 3 } });
    const handBefore = playerOf(patched, P1).hand.length;
    const after = settle(
      runWith(PLAYABLE_DEPS, patched, use(P1, hall, "06017.hall-of-heroes-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3);
    expect(inst(after, hall).counters.glory ?? 0).toBe(0);
    expect(inst(after, hall).exhausted).toBe(true);
  });

  it("06018.battle-fury-response: after your hero defeats a minion, 1 damage to your hero and discard → ready your hero", () => {
    const { state: opened, id: fury } = openHandFor("06018", SHE_HULK);
    const pay = filler(opened, 1, [fury]);
    const identity = identityOf(pay.state);
    const armed = playCard(pay.state, fury, pay.ids, firstLegal, identity);
    expect(inst(armed, fury).attachedTo).toBe(identity);
    const { state, minion } = withMinion(armed, "01101");
    const primed = patchInstance(state, minion, { damage: 999 });
    const damageBefore = inst(primed, identity).damage;
    const after = basicAttack(primed, minion, accepting("06018.battle-fury-response"));
    expect(inst(after, identity).damage).toBe(damageBefore + 1);
    expect(playerOf(after, P1).discard).toContain(fury);
    expect(inst(after, identity).exhausted).toBe(false); // the attack exhausted her; Battle Fury readied her again.
  });

  /** Accepts Jarnbjorn's response, then pays its "spend a [physical] resource" cost with a hand card carrying one. */
  const payingPhysical: Picker = (st) => {
    const choice = st.pendingChoice;
    if (choice?.prompt.kind === "payForAbility") {
      const physical = choice.options.find((o) => {
        const card = BY_ID.get(st.instances[o.optionId.replace("hand:", "") as InstanceId]?.cardId as string);
        const icons =
          card && ("resourceIcons" in card ? card.resourceIcons : "producesIcons" in card ? card.producesIcons : {});
        return !!icons && ((icons as { physical?: number }).physical ?? 0) > 0;
      });
      return physical ? [physical.optionId] : firstLegal(st);
    }
    return accepting("06019.jarnbjorn-response")(st);
  };

  it("06019.jarnbjorn-response: after your hero attacks, spend a [physical] resource → 2 damage to an enemy", () => {
    const { state: opened, id: jarnbjorn } = openHandFor("06019", SHE_HULK);
    const pay = filler(opened, 1, [jarnbjorn]);
    const played = playCard(pay.state, jarnbjorn, pay.ids);
    expect(inst(played, jarnbjorn).attachedTo).toBe(identityOf(played));
    // A [physical] card in hand to spend (the opening hand may hold none).
    const armed = filler(
      played,
      1,
      [jarnbjorn],
      (card) => "resourceIcons" in card && (card.resourceIcons.physical ?? 0) > 0,
    ).state;
    const villain = armed.villains[0]!.instanceId;
    const before = inst(armed, villain).damage;
    const after = basicAttack(armed, villain, payingPhysical);
    expect(inst(after, villain).damage).toBe(before + atkOf(armed) + 2);
  });
});

describe("Thor's basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("06020.heimdall-response: looks at the top 3 encounter cards, discards 1, puts the others back", () => {
    const { state: opened, id: heimdall } = openHandFor("06020", SPIDER_MAN);
    const top = activeEncounterDeck(opened).deck.slice(0, 3);
    const deckBefore = activeEncounterDeck(opened).deck.length;
    const discardBefore = activeEncounterDeck(opened).discard.length;
    const pay = filler(opened, 5, [heimdall]);
    const after = playCard(pay.state, heimdall, pay.ids, accepting("06020.heimdall-response"));
    expect(cardsInPlay(after)).toContain(heimdall);
    const piles = activeEncounterDeck(after);
    expect(piles.deck.length).toBe(deckBefore - 1);
    expect(piles.discard.length).toBe(discardBefore + 1);
    const discarded = top.filter((id) => piles.discard.includes(id));
    expect(discarded).toHaveLength(1);
    const kept = top.filter((id) => !discarded.includes(id));
    expect([...piles.deck.slice(0, 2)].sort()).toEqual([...kept].sort());
  });

  it("06021.invulnerability-action: gives your hero a tough status card", () => {
    const { state: opened, id } = openHandFor("06021", SPIDER_MAN);
    const identity = identityOf(opened);
    expect(inst(opened, identity).statuses.tough).toBe(0);
    const pay = filler(opened, 3, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, identity).statuses.tough).toBe(1);
  });

  it("06034.enhanced-physique-resource: enters with 3 physical counters; its Hero Resource generates [physical]", () => {
    const { state: opened, id: physique } = openHandFor("06034", SPIDER_MAN);
    const pay = filler(opened, 2, [physique]);
    const inPlay = playCard(pay.state, physique, pay.ids);
    expect(inst(inPlay, physique).counters.physical).toBe(3);
    // Web-Shooter (01008, cost 1) paid only by the resource ability, no hand cards.
    const given = moveToHand(inPlay, P1, "01008");
    const [webShooter] = given.ids as readonly [InstanceId];
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        given.state,
        play(P1, webShooter, [], { abilities: [resourceAbility(physique, "06034.enhanced-physique-resource")] }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(webShooter);
    expect(inst(after, physique).counters.physical).toBe(2);
    expect(inst(after, physique).exhausted).toBe(true);
  });
});

describe("Thor's justice card, from Spider-Man (Justice)'s own deck", () => {
  it("06031.under-surveillance-constant-2: attaches to the main scheme and raises its target threat by 4", () => {
    const { state: opened, id } = openHandFor("06031", SPIDER_MAN);
    const scheme = opened.mainScheme;
    const targetBefore = mainSchemeValue(opened, "targetThreat", PLAYABLE_DEPS, scheme);
    const pay = filler(opened, 2, [id]);
    const after = playCard(pay.state, id, pay.ids, firstLegal, scheme.instanceId);
    expect(inst(after, id).attachedTo).toBe(scheme.instanceId);
    expect(mainSchemeValue(after, "targetThreat", PLAYABLE_DEPS, after.mainScheme)).toBe(targetBefore + 4);
  });
});

describe("Thor's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("06032.teamwork-constant: exhausting an ally adds its ATK to your hero's basic attack, and its THW to a basic thwart", () => {
    const { state: opened, id: teamwork } = openHandFor("06032", CAP_MARVEL);
    // Maria Hill-style ally from the precon: the cheapest ally in the deck with a nonzero ATK and THW.
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const card = cardOf(opened, id);
      return card.type === "ally" && num(card.atk) > 0 && num(card.thw) > 0 && card.cost <= 3;
    });
    if (!allyId) throw new Error("no cheap ally in the Captain Marvel deck");
    const ally = cardOf(opened, allyId);
    if (ally.type !== "ally") throw new Error("not an ally");
    const given = moveToHand(opened, P1, ally.id as string);
    const [allyInstance] = given.ids as readonly [InstanceId];
    const pay = filler(given.state, ally.cost, [teamwork, allyInstance]);
    const armed = playCard(pay.state, allyInstance, pay.ids);
    expect(cardsInPlay(armed)).toContain(allyInstance);
    const identity = identityOf(armed);
    const profile = characterProfile(armed, identity, PLAYABLE_DEPS)!;

    const villain = armed.villains[0]!.instanceId;
    const damageBefore = inst(armed, villain).damage;
    const attacked = basicAttack(armed, villain, accepting("06032.teamwork-constant"));
    expect(inst(attacked, allyInstance).exhausted).toBe(true);
    expect(inst(attacked, villain).damage).toBe(damageBefore + profile.atk + num(ally.atk));

    const scheme = armed.mainScheme.instanceId;
    const threatened = patchInstance(armed, scheme, { threat: 20 });
    const thwarted = settle(
      runWith(PLAYABLE_DEPS, threatened, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      accepting("06032.teamwork-constant"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(thwarted, allyInstance).exhausted).toBe(true);
    expect(inst(thwarted, scheme).threat).toBe(20 - profile.thw - num(ally.thw));
  });
});

describe("Thor's protection card, from Black Panther (Protection)'s own deck", () => {
  it("06033.second-wind-action: heals 4 damage from an identity, 5 if paid with a [mental] resource", () => {
    const { state: opened, id } = openHandFor("06033", BLACK_PANTHER);
    const identity = identityOf(opened);
    const hurt = patchInstance(opened, identity, { damage: 8 });

    const plain = filler(hurt, 3, [id], noWildOrIcon("mental"));
    const healed4 = playCard(plain.state, id, plain.ids);
    expect(inst(healed4, identity).damage).toBe(8 - 4);

    const withMental = filler(hurt, 1, [id], mentalIcon);
    const others = filler(withMental.state, 2, [id, ...withMental.ids], noWildOrIcon("mental"));
    const healed5 = playCard(others.state, id, [...withMental.ids, ...others.ids]);
    expect(inst(healed5, identity).damage).toBe(8 - 5);
  });
});
