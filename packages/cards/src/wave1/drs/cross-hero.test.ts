import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerSetup,
  remainingHitPoints,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  answer,
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
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Doctor
 * Strange pack (`drs`, 09001a-09039) aspect/basic player card that has an ability script — every one whose own
 * `aspect` is not `hero:09001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Doctor
 * Strange deck could hold) — played through the engine from a Core hero's own precon instead of Doctor Strange's.
 *
 * Covered (12): 09012 Brother Voodoo, 09013 Clea, 09014 Iron Fist (both abilities), 09015 Desperate Defense, 09016
 * Momentum Shift, 09019 The Night Nurse, 09020 Unflappable, 09021 Warning, 09026 The Sorcerer Supreme (refused: the
 * Core hero lacks the Mystic trait), 09037 Skilled Strike, 09038 Foiled!, 09039 Iron Man.
 * Skipped: 09017 The Power of Protection (verbatim Core 01079), 09018 Med Team (verbatim Core 01080) and 09025
 * Avengers Mansion (verbatim Core 01091), all aliased in `../reprints.ts`; 09022-09024 Energy/Genius/Strength print
 * no ability (`abilities: []`); 09027-09031 are the obligation/nemesis/encounter cards and 09032-09036 are
 * Invocation cards (`separateDeck`), not player aspect cards.
 *
 * Seats: protection in Black Panther/Protection, basic and justice in Spider-Man/Justice, aggression in
 * She-Hulk/Aggression, leadership in Captain Marvel/Leadership (`CORE_HERO_FOR_ASPECT`).
 */

const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";
const SHE_HULK = "core-she-hulk-aggression";
const CAP_MARVEL = "core-captain-marvel-leadership";

/** Advance (01186): no boost icons, only 1 threat — a neutral boost/deal card. Crowd Control (01108): 2 boost icons,
 * no boost ability. Hard to Keep Down (01104): a 0-icon minion filler. */
const ADVANCE = "01186";
const CROWD_CONTROL = "01108";

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) =>
  runWith(PLAYABLE_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal, stop?: (s: GameState) => boolean) =>
  settle(state, pick, stop, PLAYABLE_DEPS);

/** Hero form, settling any form-change response (She-Hulk's asks for a target). */
const toHeroFirst = (state: GameState): GameState => settled(run(state, toHero(P1)));

/** Opening state with `code` in P1's hand, seated in `coreHero`'s own precon (`buildCrossHeroDeck`). */
function openHandFor(
  code: string,
  coreHero: string,
  options: { readonly heroForm?: boolean; readonly extraDeck?: readonly string[] } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => c as never)] }
    : seat;
  const created = createGame(playableScenario("rhino", { seed: 11, players: [seated] }), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.heroForm === false ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` single-value non-resource cards into P1's hand (never `exclude`) and returns their ids: a payment's
 * size is then exactly its value (docs/phase7-wave1-scripting.md "Test conventions"). */
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

/** Accepts the named optional response/interrupt (by ability id), and declines/pays-first everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, 1).map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState => settled(run(state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})), pick);

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settled(
    run(state, { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }),
    pick,
  );

/** Ends the turn with the encounter deck stacked [`boost`, ...rest] and settles up to P1's defender declaration. */
const atDeclare = (state: GameState, ...stack: readonly string[]): GameState =>
  settleUntil(run(stackEncounterDeck(state, ...stack), endTurn()), "declareDefender", firstLegal, PLAYABLE_DEPS);

/** Plays out one defended villain attack to the end of the player's next turn (or the boost card's discard),
 * accepting the named optional ability by id. Returns damage taken by the hero and whether the card was discarded. */
function defendOnce(
  state: GameState,
  ability: string,
  card: InstanceId,
  defender: InstanceId | "decline",
  accept: boolean,
  stack: readonly string[],
) {
  const identity = identityOf(state);
  const defending = answer(atDeclare(state, ...stack), [defender === "decline" ? "decline" : defender], PLAYABLE_DEPS);
  const before = inst(defending, identity).damage;
  const after = settled(defending, accept ? accepting(ability) : firstLegal, (s) => s.step.kind === "turn");
  return { after, taken: inst(after, identity).damage - before, discarded: playerOf(after, P1).discard.includes(card) };
}

describe("Doctor Strange's protection cards, from Black Panther (Protection)'s own deck", () => {
  it("09012.brother-voodoo-response: after he enters play, adds an event from the top 5 of the deck to your hand", () => {
    const { state: opened, id: voodoo } = openHandFor("09012", BLACK_PANTHER);
    const owner = playerOf(opened, P1);
    const eventId = owner.deck.find((id) => cardOf(opened, id).type === "event")!;
    const stacked = putOnTopOfDeck(opened, P1, cardOf(opened, eventId).id as string).state;
    const pay = filler(stacked, 3, [voodoo]);
    const after = playCard(pay.state, voodoo, pay.ids, accepting("09012.brother-voodoo-response"));
    expect(playerOf(after, P1).playArea).toContain(voodoo);
    const handAfter = playerOf(after, P1).hand;
    const gained = handAfter.filter((id) => !playerOf(pay.state, P1).hand.includes(id));
    expect(gained).toHaveLength(1);
    expect(cardOf(after, gained[0]!).type).toBe("event");
  });

  it("09013.clea-interrupt: when she is defeated, she is shuffled into her owner's deck, not discarded", () => {
    const { state: opened, id: clea } = openHandFor("09013", BLACK_PANTHER);
    const pay = filler(opened, 2, [clea]);
    const withClea = playCard(pay.state, clea, pay.ids);
    expect(playerOf(withClea, P1).playArea).toContain(clea);
    // Clea has no printed DEF: Rhino's 2 ATK (Advance boost, no icons) is exactly her 2 hit points.
    const declared = answer(atDeclare(withClea, ADVANCE), [clea], PLAYABLE_DEPS);
    const after = settled(declared, accepting("09013.clea-interrupt"), (s) => s.step.kind === "turn");
    expect(playerOf(after, P1).deck).toContain(clea);
    expect(playerOf(after, P1).discard).not.toContain(clea);
    expect(playerOf(after, P1).playArea).not.toContain(clea);
  });

  it("09014.iron-fist-constant: enters play with 2 mystic counters", () => {
    const { state: opened, id: fist } = openHandFor("09014", BLACK_PANTHER);
    const pay = filler(opened, 4, [fist]);
    const after = playCard(pay.state, fist, pay.ids);
    expect(inst(after, fist).counters.mystic).toBe(2);
  });

  it("09014.iron-fist-interrupt: when he attacks, remove a mystic counter to stun the enemy and deal 1 damage", () => {
    const { state: opened, id: fist } = openHandFor("09014", BLACK_PANTHER);
    const pay = filler(opened, 4, [fist]);
    const withFist = playCard(pay.state, fist, pay.ids);
    const villain = villainOf(withFist);
    const hp = remainingHitPoints(withFist, villain)!;
    const after = basicAttack(withFist, fist, villain, accepting("09014.iron-fist-interrupt"));
    expect(inst(after, fist).counters.mystic).toBe(1);
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
    // Iron Fist's printed ATK 2 plus the interrupt's 1 damage.
    expect(hp - remainingHitPoints(after, villain)!).toBe(3);
  });

  it("09015.desperate-defense-interrupt: +2 DEF for that attack, and your hero readies if it took no damage", () => {
    const { state: opened, id: dd } = openHandFor("09015", BLACK_PANTHER);
    const identity = identityOf(opened);
    // The hero is a boosted 2-icon attack away from taking damage; stack no help beyond the boost card.
    const declined = defendOnce(opened, "09015.desperate-defense-interrupt", dd, identity, false, [CROWD_CONTROL]);
    const accepted = defendOnce(opened, "09015.desperate-defense-interrupt", dd, identity, true, [CROWD_CONTROL]);
    expect(declined.taken).toBeGreaterThan(0);
    expect(declined.discarded).toBe(false);
    expect(accepted.discarded).toBe(true);
    expect(accepted.taken).toBe(Math.max(0, declined.taken - 2));
    if (accepted.taken === 0) expect(inst(accepted.after, identity).exhausted).toBe(false);
  });

  it("09016.momentum-shift-action: heals 2 damage from your hero to deal 2 damage to an enemy", () => {
    const { state: opened, id: shift } = openHandFor("09016", BLACK_PANTHER);
    const identity = identityOf(opened);
    const hurt = patchInstance(opened, identity, { damage: 2 });
    const villain = villainOf(hurt);
    const hp = remainingHitPoints(hurt, villain)!;
    const pay = filler(hurt, 2, [shift]);
    const after = playCard(pay.state, shift, pay.ids);
    expect(inst(after, identity).damage).toBe(0);
    expect(remainingHitPoints(after, villain)).toBe(hp - 2);
  });

  it("09019.the-night-nurse-action: heals 1 damage from a hero and discards a status card from it", () => {
    const { state: opened, id: nurse } = openHandFor("09019", BLACK_PANTHER);
    const pay = filler(opened, 1, [nurse]);
    const withNurse = playCard(pay.state, nurse, pay.ids);
    const identity = identityOf(withNurse);
    expect(inst(withNurse, nurse).counters.medical).toBe(3);
    const staged = patchInstance(withNurse, identity, {
      damage: 1,
      statuses: { ...inst(withNurse, identity).statuses, confused: 1 },
    });
    const after = settled(run(staged, use(P1, nurse, "09019.the-night-nurse-action")), (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" ? [identity] : firstLegal(s),
    );
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, identity).statuses.confused).toBe(0);
    expect(inst(after, nurse).counters.medical).toBe(2);
    expect(inst(after, nurse).exhausted).toBe(true);
  });

  it("09020.unflappable-response: after you defend and take no damage, exhaust it to draw 1 card", () => {
    const { state: opened, id: unflappable } = openHandFor("09020", BLACK_PANTHER);
    const pay = filler(opened, 1, [unflappable]);
    const withCard = playCard(pay.state, unflappable, pay.ids);
    const identity = identityOf(withCard);
    // Advance boost (0 icons): Rhino's 2 ATK against the hero's own DEF deals no damage; the extra Advance and
    // Hard to Keep Down keep the following per-player reveal harmless.
    const defending = answer(atDeclare(withCard, ADVANCE, ADVANCE, "01104"), [identity], PLAYABLE_DEPS);
    const handBefore = playerOf(defending, P1).hand.length;
    const atResponse = settleUntil(defending, "chooseTriggers", firstLegal, PLAYABLE_DEPS);
    const option = `${unflappable}:09020.unflappable-response`;
    expect(atResponse.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    const after = answer(atResponse, [option], PLAYABLE_DEPS);
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, unflappable).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });
});

describe("Doctor Strange's basic and justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("09021.warning-interrupt: reduces the damage a hero would take by 1", () => {
    const { state: opened, id: warning } = openHandFor("09021", SPIDER_MAN);
    // Undefended, so Rhino's 2 ATK + 2 boost icons all land on the hero (no DEF to absorb Warning's reduction).
    const declined = defendOnce(opened, "09021.warning-interrupt", warning, "decline", false, [CROWD_CONTROL]);
    const accepted = defendOnce(opened, "09021.warning-interrupt", warning, "decline", true, [CROWD_CONTROL]);
    expect(declined.taken).toBeGreaterThan(0);
    expect(accepted.discarded).toBe(true);
    expect(accepted.taken).toBe(declined.taken - 1);
  });

  it("09026.the-sorcerer-supreme-constant: 'Play only if you have the Mystic trait' refuses a non-Mystic hero", () => {
    const { state, id } = openHandFor("09026", SPIDER_MAN);
    const identityCard = cardOf(state, identityOf(state));
    expect(identityCard.type).toBe("hero_identity");
    if (identityCard.type === "hero_identity") {
      expect(identityCard.alterEgo.traits.map(String)).not.toContain("MYSTIC");
      expect(identityCard.hero.traits.map(String)).not.toContain("MYSTIC");
    }
    const pay = filler(state, 2, [id]);
    const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(result.ok).toBe(false);
    expect(playerOf(pay.state, P1).hand).toContain(id);
  });

  it("09038.foiled-interrupt: cancels a faceup boost card's icons during a scheme activation", () => {
    // Alter-ego form: Rhino schemes. Crowd Control (2 icons) is the boost card; Advance is the dealt card.
    const schemeOnce = (accept: boolean) => {
      const { state: opened, id: foiled } = openHandFor("09038", SPIDER_MAN, { heroForm: false });
      const before = inst(opened, opened.mainScheme.instanceId).threat;
      const after = settled(
        run(stackEncounterDeck(opened, CROWD_CONTROL, ADVANCE), endTurn()),
        accept ? accepting("09038.foiled-interrupt") : firstLegal,
        (s) => s.step.phase === "player" && !s.pendingChoice,
      );
      return {
        added: inst(after, after.mainScheme.instanceId).threat - before,
        discarded: playerOf(after, P1).discard.includes(foiled),
      };
    };
    const declined = schemeOnce(false);
    const accepted = schemeOnce(true);
    expect(accepted.discarded).toBe(true);
    expect(declined.added - accepted.added).toBe(2);
  });
});

describe("Doctor Strange's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  it("09037.skilled-strike-interrupt: your hero's basic attack gets +2 ATK", () => {
    const { state: opened, id: strike } = openHandFor("09037", SHE_HULK);
    const identity = identityOf(opened);
    const villain = villainOf(opened);
    const atk = characterProfile(opened, identity, PLAYABLE_DEPS)!.atk;
    const hp = remainingHitPoints(opened, villain)!;
    const after = basicAttack(opened, identity, villain, accepting("09037.skilled-strike-interrupt"));
    expect(playerOf(after, P1).discard).toContain(strike);
    expect(hp - remainingHitPoints(after, villain)!).toBe(atk + 2);
  });
});

describe("Doctor Strange's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("09039.iron-man-constant: each upgrade played on Iron Man costs 1 less", () => {
    // Gun-Metal-style generic ally upgrade: 23035 (basic, "Attach to an ally", printed cost 1).
    const { state: opened, id: ironMan } = openHandFor("09039", CAP_MARVEL, { extraDeck: ["23035"] });
    const { state: given, ids } = moveToHand(opened, P1, "23035");
    const upgrade = ids[0]!;
    const pay = filler(given, 4, [ironMan, upgrade]);
    // Without Iron Man in play the same upgrade at printed cost 1 cannot be paid with nothing.
    const refused = applyCommand(pay.state, play(P1, upgrade, []), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);
    const withIronMan = playCard(pay.state, ironMan, pay.ids);
    expect(playerOf(withIronMan, P1).playArea).toContain(ironMan);
    // Printed cost 1, 0 with Iron Man's discount: playable with no payment at all.
    const attached = playCard(withIronMan, upgrade, [], firstLegal, ironMan);
    expect(inst(attached, upgrade).attachedTo).toBe(ironMan);
  });
});
