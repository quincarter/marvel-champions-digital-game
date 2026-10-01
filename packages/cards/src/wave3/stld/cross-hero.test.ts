import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import { driveEvents } from "../../testing/staging.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
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
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Star-Lord
 * pack (`stld`, 17001a-17031) aspect/basic player card that has an ability script — every one whose own `aspect` is
 * not `hero:17001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Star-Lord deck could
 * hold) — played through the engine from a Core hero's own precon instead of Star-Lord's.
 *
 * Covered (14): 17011 Adam Warlock (all four printed-resource branches), 17012 Beta Ray Bill, 17013 Yondu, 17014 Air
 * Supremacy, 17015 Blaze of Glory, 17017 Target Practice, 17019 Laser Blaster, 17020 Cosmo, 17021 C.I.T.T., 17022
 * Knowhere (refused: "Play only if your identity has the guardian trait", no Core hero has it), 17023 Pulse Grenade,
 * and 17028 Dive Bomb / 17029 Agile Flight / 17030 Ever Vigilant (each refused: "Play only if your identity has the
 * aerial trait", and no Core hero has the aerial trait).
 * Skipped: 17016 Get Ready (verbatim Core 01069), 17018 The Power of Leadership (verbatim Core 01072) and 17031
 * Enhanced Awareness (verbatim Cap 03034), all aliased in `../reprints.ts`; 17024-17027 are the obligation, side
 * scheme, nemesis minion and treachery (not player aspect cards). The pack prints no Team-Up card, so there is no
 * "Core deck refuses a Team-Up card" assertion to make (RRG 1.8 "Team-Up", p. 43). The three aerial-gated events'
 * positive effect needs an aerial identity; no Core hero is one, so it is covered by Star-Lord's own kit test
 * (`star-lord-kit.test.ts`, Jet Boots grants aerial) and only the refusal is asserted here.
 *
 * Form gates (RRG 1.8 "Action", p. 5): the pack prints no plain "Action:" card of its own (Get Ready is the only
 * one, a reprint); every printed "Hero Action" (17014, 17015, 17021, 17023) is also shown refused in alter-ego form.
 * Responses "after [it] attacks" (17011, 17012) are fired by the ally's own attack from a Core hero's seat.
 *
 * Seats: leadership cards in Captain Marvel/Leadership, basic cards in Spider-Man/Justice, aggression in
 * She-Hulk/Aggression, justice in Spider-Man/Justice, protection in Black Panther/Protection. Guardian-dependent
 * cards (Blaze of Glory, Target Practice, Laser Blaster, C.I.T.T.) use Yondu/Cosmo, whose own printed Guardian trait
 * is what they need (Star-Lord's "allies are guardians" constant is not in play from a Core hero's deck).
 */

const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const SHE_HULK = "core-she-hulk-aggression";
const BLACK_PANTHER = "core-black-panther-protection";

const NO_BOOST = "01186"; // Advance: 0 boost icons.
const TWO_BOOST = "01108"; // Crowd Control: 2 boost icons (Pulse Grenade fixture).

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) =>
  runWith(PLAYABLE_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal, stop?: (s: GameState) => boolean) =>
  settle(state, pick, stop, PLAYABLE_DEPS);

interface OpenOptions {
  readonly alterEgo?: boolean;
  /** Extra cards to seat in the deck (legal in the hero's aspect). */
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
  const created = createGame(playableScenario("rhino", { seed: 11, players: [seated] }), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : settled(run(opening, toHero(P1)));
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` non-resource cards into P1's hand (never `exclude`) and returns their ids: a payment's size is then
 * exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource") continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  return { state: probe.state, ids: probe.ids.filter((id) => !exclude.includes(id)) };
}

/** Accepts the named optional response/interrupt/option (by id), and pays/declines everything else. */
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

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState => settled(run(state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})), pick);

/** Moves `code` to hand, pays its printed `cost` with single-value filler cards, and plays it (optionally attached). */
function playByCode(
  state: GameState,
  code: string,
  exclude: readonly InstanceId[] = [],
  attachTo?: InstanceId,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const card = BY_ID.get(code)!;
  const pay = filler(given.state, "cost" in card ? card.cost : 0, [...exclude, id]);
  return { state: playCard(pay.state, id, pay.ids, pick, attachTo), id };
}

const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** Puts a copy of core minion `code` (a Rhino-scenario encounter card) in play engaged with P1. */
function withMinion(state: GameState, code: string): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, P1), minion };
}

const attackCmd = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as const;

/** RRG 1.8 "Action" (p. 5): a "Hero Action" can be used only in hero form. */
function expectEventRefusedInAlterEgo(code: string, coreHero: string, extraDeck: readonly string[] = []): void {
  const { state, id } = openHandFor(code, coreHero, { alterEgo: true, extraDeck });
  const card = cardOf(state, id);
  const pay = filler(state, "cost" in card ? card.cost : 0, [id]);
  const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
  expect(result.ok ? null : result.error.code).toBe("wrong_form");
  expect(playerOf(pay.state, P1).hand).toContain(id);
}

/** An in-play card's `abilityId` Hero Action must be refused while P1 is in alter-ego form (RRG 1.8 "Action", p. 5). */
function expectUseRefusedInAlterEgo(code: string, abilityId: string, coreHero: string, attach: boolean): void {
  const { state: opened, id } = openHandFor(code, coreHero, { alterEgo: true, extraDeck: ["17020"] });
  const cosmo = playByCode(opened, "17020", [id]);
  const pay = filler(
    cosmo.state,
    "cost" in cardOf(cosmo.state, id) ? (cardOf(cosmo.state, id) as { cost: number }).cost : 0,
    [id, cosmo.id],
  );
  const placed = playCard(pay.state, id, pay.ids, firstLegal, attach ? identityOf(pay.state) : undefined);
  expect(playerOf(placed, P1).playArea.concat(inst(placed, id).attachedTo ? [id] : [])).toContain(id);
  const staged = patchInstance(placed, cosmo.id, { exhausted: true });
  const spare = filler(staged, 2, [id, cosmo.id]);
  const result = applyCommand(
    spare.state,
    use(
      P1,
      id,
      abilityId,
      spare.ids.map((fromHand) => ({ fromHand })),
    ),
    PLAYABLE_DEPS,
  );
  expect(result.ok ? null : result.error.code).toBe("wrong_form");
}

describe("Star-Lord pack leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("17011.adam-warlock-response: after Adam attacks or thwarts, discards a random card and applies its printed resource's branch", () => {
    const adamWithOnly = (hand: string) => {
      const { state: opened, id: adam } = openHandFor("17011", CAP_MARVEL);
      const pay = filler(opened, 3, [adam]);
      const inPlay = playCard(pay.state, adam, pay.ids);
      expect(playerOf(inPlay, P1).playArea).toContain(adam);
      const given = moveToHand(inPlay, P1, hand);
      const only = given.ids[0]!;
      const state: GameState = {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [only], discard: [...p.discard, ...p.hand.filter((i) => i !== only)] } : p,
        ),
      };
      return { state: patchInstance(state, state.mainScheme.instanceId, { threat: 10 }), adam, only };
    };
    const attacked = (state: GameState, adam: InstanceId, pick: Picker) =>
      settled(run(state, attackCmd(adam, villainOf(state))), pick);

    // [physical]: Strength (01090) -> remove 3 threat from a scheme.
    const phys = adamWithOnly("01090");
    const physAfter = attacked(phys.state, phys.adam, accepting("17011.adam-warlock-response"));
    expect(playerOf(physAfter, P1).discard).toContain(phys.only);
    expect(mainThreat(physAfter)).toBe(7);

    // [energy]: Energy (01088) -> heal 3 damage from an identity.
    const en = adamWithOnly("01088");
    const hurt = patchInstance(en.state, identityOf(en.state), { damage: 5 });
    const enAfter = attacked(hurt, en.adam, accepting("17011.adam-warlock-response"));
    expect(inst(enAfter, identityOf(enAfter)).damage).toBe(2);

    // [mental]: Genius (01089) -> deal 3 damage to an enemy (a thwart, so the only damage on the villain is the 3).
    const men = adamWithOnly("01089");
    const villain = villainOf(men.state);
    const thwarted = settled(
      run(men.state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: men.adam,
        schemeInstanceId: men.state.mainScheme.instanceId,
      }),
      accepting("17011.adam-warlock-response"),
    );
    expect(inst(thwarted, villain).damage).toBe(inst(men.state, villain).damage + 3);

    // [wild]: The Power of Leadership (01072) -> choose one of the three; the first offered is "remove 3 threat".
    const wild = adamWithOnly("01072");
    const wildAfter = attacked(wild.state, wild.adam, accepting("17011.adam-warlock-response", "scheme"));
    expect(playerOf(wildAfter, P1).discard).toContain(wild.only);
    expect(mainThreat(wildAfter)).toBe(7);
  });

  it("17012.beta-ray-bill-response: after he attacks and defeats a minion, removes 2 threat from the main scheme", () => {
    const { state: opened, id } = openHandFor("17012", CAP_MARVEL);
    const bill = playCard(opened, id, filler(opened, 5, [id]).ids);
    expect(playerOf(bill, P1).playArea).toContain(id);
    // Shocker (01103, 3 HP, no Toughness) is exactly defeated by Beta Ray Bill's printed ATK 3.
    const { state: withShocker, minion } = withMinion(bill, "01103");
    const staged = patchInstance(withShocker, withShocker.mainScheme.instanceId, { threat: 10 });
    const after = settled(run(staged, attackCmd(id, minion)), accepting("17012.beta-ray-bill-response"));
    expect(playerOf(after, P1).playArea).not.toContain(minion);
    expect(mainThreat(after)).toBe(8);
  });

  it("17013.yondu-constant: Yondu's attacks gain ranged", () => {
    const { state: opened, id } = openHandFor("17013", CAP_MARVEL);
    const yondu = playCard(opened, id, filler(opened, 4, [id]).ids);
    expect(playerOf(yondu, P1).playArea).toContain(id);
    expect(hasKeyword(yondu, id, "ranged", PLAYABLE_DEPS)).toBe(true);
    // Not the identity: only Yondu's own attacks (RRG 1.8 "Ranged"): the hero side has no ranged.
    expect(hasKeyword(yondu, identityOf(yondu), "ranged", PLAYABLE_DEPS)).toBe(false);
  });

  it("17014.air-supremacy-action: deals 3 damage to up to X enemies, X = aerial characters you control", () => {
    const { state: opened, id } = openHandFor("17014", CAP_MARVEL, { extraDeck: ["17011"] });
    // Adam Warlock (Aerial) is the one aerial character: X = 1.
    const adam = playByCode(opened, "17011", [id]);
    const villain = villainOf(adam.state);
    const pay = filler(adam.state, 2, [id, adam.id]);
    const after = playCard(pay.state, id, pay.ids, (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === villain) ? [villain] : firstLegal(s),
    );
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, villain).damage - inst(adam.state, villain).damage).toBe(3);
  });

  it("17014.air-supremacy-action: a Hero Action, refused in alter-ego form", () => {
    expectEventRefusedInAlterEgo("17014", CAP_MARVEL);
  });

  it("17015.blaze-of-glory-action: guardian characters get +2 THW/+2 ATK this phase, then take 1 damage at its end", () => {
    const { state: opened, id } = openHandFor("17015", CAP_MARVEL, { extraDeck: ["17013"] });
    const yondu = playByCode(opened, "17013", [id]);
    const before = characterProfile(yondu.state, yondu.id, PLAYABLE_DEPS)!;
    const identityBefore = characterProfile(yondu.state, identityOf(yondu.state), PLAYABLE_DEPS)!;
    const pay = filler(yondu.state, 2, [id, yondu.id]);
    const played = playCard(pay.state, id, pay.ids);
    expect(playerOf(played, P1).discard).toContain(id);
    const boosted = characterProfile(played, yondu.id, PLAYABLE_DEPS)!;
    expect(boosted.thw).toBe(before.thw + 2);
    expect(boosted.atk).toBe(before.atk + 2);
    // Captain Marvel is not a guardian, so she gets nothing.
    expect(characterProfile(played, identityOf(played), PLAYABLE_DEPS)).toMatchObject({
      thw: identityBefore.thw,
      atk: identityBefore.atk,
    });
    expect(inst(played, yondu.id).damage).toBe(0);
    // End of the phase: 1 damage to each guardian character (Yondu).
    const ended = settled(run(stackEncounterDeck(played, NO_BOOST), endTurn()), firstLegal);
    expect(inst(ended, yondu.id).damage).toBe(1);
  });

  it("17015.blaze-of-glory-action: a Hero Action, refused in alter-ego form", () => {
    expectEventRefusedInAlterEgo("17015", CAP_MARVEL, ["17013"]);
  });

  it("17017.target-practice-interrupt: an ally with a weapon attachment upgrade gets +2 ATK for its attack, discarding Target Practice", () => {
    const { state: opened, id: practice } = openHandFor("17017", CAP_MARVEL, { extraDeck: ["17013", "17019"] });
    const yondu = playByCode(opened, "17013", [practice]);
    const blaster = playByCode(yondu.state, "17019", [practice, yondu.id], yondu.id);
    const ready = playCard(blaster.state, practice, []);
    expect(playerOf(ready, P1).playArea).toContain(practice);
    const printedAtk = characterProfile(ready, yondu.id, PLAYABLE_DEPS)!.atk;
    const villain = villainOf(ready);
    const after = settled(run(ready, attackCmd(yondu.id, villain)), accepting("17017.target-practice-interrupt"));
    expect(inst(after, villain).damage - inst(ready, villain).damage).toBe(printedAtk + 2);
    expect(playerOf(after, P1).discard).toContain(practice);
  });

  it("17017.target-practice-interrupt: not offered for an ally with no weapon attached", () => {
    const { state: opened, id: practice } = openHandFor("17017", CAP_MARVEL, { extraDeck: ["17013"] });
    const yondu = playByCode(opened, "17013", [practice]);
    const ready = playCard(yondu.state, practice, []);
    const villain = villainOf(ready);
    const after = settled(run(ready, attackCmd(yondu.id, villain)), accepting("17017.target-practice-interrupt"));
    expect(playerOf(after, P1).playArea).toContain(practice);
    expect(inst(after, villain).damage - inst(ready, villain).damage).toBe(
      characterProfile(ready, yondu.id, PLAYABLE_DEPS)!.atk,
    );
  });

  it("17019.laser-blaster-constant: attached guardian ally gets +1 ATK and its attacks gain overkill", () => {
    const { state: opened, id } = openHandFor("17019", CAP_MARVEL, { extraDeck: ["17013"] });
    const yondu = playByCode(opened, "17013", [id]);
    const printedAtk = characterProfile(yondu.state, yondu.id, PLAYABLE_DEPS)!.atk;
    const pay = filler(yondu.state, 1, [id, yondu.id]);
    const attached = playCard(pay.state, id, pay.ids, firstLegal, yondu.id);
    expect(inst(attached, id).attachedTo).toBe(yondu.id);
    expect(characterProfile(attached, yondu.id, PLAYABLE_DEPS)!.atk).toBe(printedAtk + 1);
    // Shocker (3 HP) pre-damaged to 1 remaining: Yondu's ATK 2 leaves 1 excess, which overkill spills to the villain.
    const { state: withShocker, minion } = withMinion(attached, "01103");
    const primed = patchInstance(withShocker, minion, { damage: 2 });
    const { events } = driveEvents(PLAYABLE_DEPS, primed, attackCmd(yondu.id, minion));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "overkillSpilled",
        fromInstanceId: minion,
        toInstanceId: villainOf(primed),
        amount: 1,
      }),
    );
  });
});

describe("Star-Lord pack basic cards, from Spider-Man (Justice)'s own deck", () => {
  /** Cosmo in play, with the top of P1's deck a card of printed `type`, and the type Cosmo names being `named`. */
  const cosmoAttack = (topType: string, named: string): { state: GameState; cosmo: InstanceId } => {
    const { state: opened, id } = openHandFor("17020", SPIDER_MAN);
    const cosmo = playCard(opened, id, filler(opened, 2, [id]).ids);
    expect(playerOf(cosmo, P1).playArea).toContain(id);
    const top = [...playerOf(cosmo, P1).deck].find((i) => cardOf(cosmo, i).type === topType);
    expect(top).toBeDefined();
    const stacked = putOnTopOfDeck(cosmo, P1, cardOf(cosmo, top!).id as string).state;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":17020.cosmo-interrupt"));
        return hit ? [hit.optionId] : firstLegal(s);
      }
      if (choice.prompt.kind === "choosePlayer") return [P1];
      if (choice.prompt.kind === "chooseOption") {
        const hit = choice.options.find((o) => o.label === "A player's deck" || o.label === named);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };
    return { state: settled(run(stacked, attackCmd(id, villainOf(stacked))), pick), cosmo: id };
  };

  it("17020.cosmo-interrupt: naming the discarded card's type spares Cosmo his consequential damage; a wrong name does not", () => {
    // The top card is an event: naming "event" matches (no consequential damage), naming "upgrade" does not (1 damage).
    const right = cosmoAttack("event", "event");
    expect(inst(right.state, right.cosmo).damage).toBe(0);
    const wrong = cosmoAttack("event", "upgrade");
    expect(inst(wrong.state, wrong.cosmo).damage).toBe(1);
  });

  it("17021.citt-action: exhausts and spends 2 resources to ready a guardian character", () => {
    const { state: opened, id } = openHandFor("17021", SPIDER_MAN, { extraDeck: ["17020"] });
    const cosmo = playByCode(opened, "17020", [id]);
    const citt = playCard(cosmo.state, id, filler(cosmo.state, 2, [id, cosmo.id]).ids);
    const tired = patchInstance(citt, cosmo.id, { exhausted: true });
    const paid = filler(tired, 2, [id, cosmo.id]);
    const used = settled(
      run(
        paid.state,
        use(
          P1,
          id,
          "17021.citt-action",
          paid.ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(used, cosmo.id).exhausted).toBe(false);
    expect(inst(used, id).exhausted).toBe(true);
  });

  it("17021.citt-action: a Hero Action, refused in alter-ego form", () => {
    expectUseRefusedInAlterEgo("17021", "17021.citt-action", SPIDER_MAN, false);
  });

  it("17022.knowhere-constant: Play only if your identity has the guardian trait: refused for Spider-Man", () => {
    const { state, id } = openHandFor("17022", SPIDER_MAN);
    const pay = filler(state, 2, [id]);
    const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(result.ok ? null : result.error.code).toBe("no_valid_target");
    expect(playerOf(pay.state, P1).hand).toContain(id);
  });

  it("17023.pulse-grenade-action: discards it, mills 2 encounter cards, deals 1 damage per boost icon discarded", () => {
    const { state: opened, id } = openHandFor("17023", SPIDER_MAN);
    const pay = filler(opened, 2, [id]);
    const placed = playCard(pay.state, id, pay.ids, firstLegal, identityOf(pay.state));
    expect(inst(placed, id).attachedTo).toBeTruthy();
    const villain = villainOf(placed);
    const stacked = stackEncounterDeck(placed, TWO_BOOST, NO_BOOST); // 2 + 0 icons over the 2 discarded cards
    const used = settled(run(stacked, use(P1, id, "17023.pulse-grenade-action")), (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === villain) ? [villain] : firstLegal(s),
    );
    expect(inst(used, villain).damage - inst(placed, villain).damage).toBe(2);
    expect(playerOf(used, P1).discard).toContain(id);
  });

  it("17023.pulse-grenade-action: a Hero Action, refused in alter-ego form", () => {
    expectUseRefusedInAlterEgo("17023", "17023.pulse-grenade-action", SPIDER_MAN, true);
  });
});

describe("Star-Lord pack aerial-gated events, from Core heroes (none has the aerial trait)", () => {
  // "Play only if your identity has the aerial trait" (card text; RRG 1.8 "Play Restrictions"): no Core identity
  // (Spider-Man, Captain Marvel, She-Hulk, Black Panther) is Aerial, so the play is refused with the card still in hand.
  const expectRefused = (code: string, coreHero: string) => {
    const { state, id } = openHandFor(code, coreHero);
    const card = cardOf(state, id);
    const pay = filler(state, "cost" in card ? card.cost : 0, [id]);
    const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(result.ok ? null : result.error.code).toBe("no_valid_target");
    expect(playerOf(pay.state, P1).hand).toContain(id);
  };

  it("17028.dive-bomb-action: refused from She-Hulk (Aggression), no aerial identity", () => {
    expectRefused("17028", SHE_HULK);
  });

  it("17029.agile-flight-action: refused from Spider-Man (Justice), no aerial identity", () => {
    expectRefused("17029", SPIDER_MAN);
  });

  it("17030.ever-vigilant-action: refused from Black Panther (Protection), no aerial identity", () => {
    expectRefused("17030", BLACK_PANTHER);
  });
});
