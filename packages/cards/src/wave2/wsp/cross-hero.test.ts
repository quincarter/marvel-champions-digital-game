import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
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
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";
import {
  answer,
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
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Wasp pack
 * (`wsp`, 13001a-13034) aspect/basic player card that has an ability script — every one whose own `aspect` is not
 * `hero:13001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Wasp deck could hold) —
 * played through the engine from a Core hero's own precon instead of Wasp's.
 *
 * Covered (14): 13011 Thor, 13012 Wasp (ally; the constant and the overpay interrupt), 13013 Into the Fray, 13014
 * Surprise Attack, 13016 Boot Camp, 13017 Lie in Wait, 13018 Ironheart, 13019 Spider-Man, 13024 The Power in All of
 * Us, 13031 Running Interference, 13032 All for One, 13033 Perseverance, 13034 Athletic Conditioning, and 13020
 * Swarm Tactics (refused: its Team-Up keyword names Ant-Man and Wasp, RRG 1.8 "Team-Up", p. 43 — no Core hero can
 * include it, so it is shown refused at deck validation rather than played).
 * Skipped: 13015 The Power of Aggression (verbatim Core 01055) and 13025 Quincarrier (verbatim Core reprint), both
 * aliased in `../reprints.ts`; 13021-13023 Energy/Genius/Strength print no ability (`abilities: []`); 13026-13030 are
 * the obligation/nemesis/encounter cards, not player aspect cards. 13031's "identity has the Avenger trait" gate
 * cannot be shown refused: every Core hero has the Avenger trait.
 *
 * Every Hero Action (13013, 13031, 13032, 13034) is also shown refused in alter-ego form (RRG 1.8 "Action", p. 5:
 * "Hero Action" is form-gated; the pack prints no plain "Action:" card).
 *
 * Seats: aggression in She-Hulk/Aggression, basic and justice in Spider-Man/Justice, leadership in Captain
 * Marvel/Leadership, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`).
 */

const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) =>
  runWith(PLAYABLE_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal, stop?: (s: GameState) => boolean) =>
  settle(state, pick, stop, PLAYABLE_DEPS);

/** Hero form, settling any form-change response (She-Hulk's asks for a target). */
const toHeroFirst = (state: GameState): GameState => settled(run(state, toHero(P1)));

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
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
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

/** Puts a copy of core minion `code` (an Rhino-scenario encounter card) in play engaged with P1. */
function withMinion(state: GameState, code: string): { state: GameState; minion: InstanceId } {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, P1), minion };
}

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

/** RRG 1.8 "Action" (p. 5): a "Hero Action" can be used only in hero form. */
function expectRefusedInAlterEgo(code: string, coreHero: string): void {
  const { state, id } = openHandFor(code, coreHero, { alterEgo: true });
  const card = cardOf(state, id);
  const cost = "cost" in card ? card.cost : 0;
  const pay = filler(state, cost, [id]);
  const result = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
  expect(result.ok).toBe(false);
  expect(playerOf(pay.state, P1).hand).toContain(id);
}

describe("Wasp pack aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("13011.thor-response: after you play Thor, deals 2 damage to the villain (3 if paid with a [physical] resource)", () => {
    const seatWith = {};
    const damageFor = (payWith: readonly string[]) => {
      const { state: opened, id: thor } = openHandFor("13011", SHE_HULK, seatWith);
      const given = moveToHand(opened, P1, ...payWith);
      const villain = villainOf(given.state);
      const after = playCard(given.state, thor, given.ids, accepting("13011.thor-response"));
      expect(playerOf(after, P1).playArea).toContain(thor);
      // Thor's own 4 cost is exactly two 2-icon resource cards.
      return inst(after, villain).damage - inst(given.state, villain).damage;
    };
    // Strength (physical) + Energy; versus Energy + Genius (no physical icon at all).
    expect(damageFor(["01090", "01088"])).toBe(3);
    expect(damageFor(["01088", "01089"])).toBe(2);
  });

  it("13012.wasp-constant: Wasp gets +1 hit point for each pym counter on her", () => {
    const { state: opened, id: wasp } = openHandFor("13012", SHE_HULK);
    const given = moveToHand(opened, P1, "01088");
    const played = playCard(given.state, wasp, given.ids);
    const patched = patchInstance(played, wasp, { counters: { ...inst(played, wasp).counters, pym: 3 } });
    expect(remainingHitPoints(patched, wasp, PLAYABLE_DEPS)).toBe(3);
  });

  it("13012.wasp-interrupt: places 1 pym counter for each [energy] resource overpaid (max 3)", () => {
    const pymAfterPaying = (...payWith: readonly string[]) => {
      const { state: opened, id: wasp } = openHandFor("13012", SHE_HULK, {});
      const given = moveToHand(opened, P1, ...payWith);
      const after = playCard(given.state, wasp, given.ids);
      return inst(after, wasp).counters.pym ?? 0;
    };
    // Wasp costs 0, so every icon of the payment is overpaid: Energy (01088) = 2 [energy].
    expect(pymAfterPaying("01088")).toBe(2);
    // Energy plus The Power of Aggression (01055, a doubled [wild] while paying for an Aggression card) = 4 [energy] overpaid, capped at 3 counters.
    expect(pymAfterPaying("01088", "01055")).toBe(3);
    // A [physical] overpayment counts nothing: Wasp has 0 printed hit points, so with no pym counter she is
    // defeated as she enters play (RRG 1.8 "Hit Points", p. 21).
    expect(pymAfterPaying("01090")).toBe(0);
  });

  // RRG 1.8 "Overkill" (p. 31) / the card's "excess damage": Sandman (01102) has 4 hit points, so 6 damage leaves 2
  // excess, removing 2 threat from the main scheme.
  it("13013.into-the-fray-action: 6 damage to a minion, 1 threat removed from the main scheme per excess damage", () => {
    const { state: opened, id } = openHandFor("13013", SHE_HULK);
    const { state: withSandman, minion } = withMinion(opened, "01102");
    const staged = patchInstance(withSandman, withSandman.mainScheme.instanceId, { threat: 6 });
    const pay = filler(staged, 3, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(playerOf(after, P1).discard).toContain(id);
    // Sandman is defeated (4 HP) and the 2 excess damage came off the main scheme.
    expect(playerOf(after, P1).playArea).not.toContain(minion);
    expect(mainThreat(after)).toBe(4);
  });

  it("13013.into-the-fray-action: a Hero Action, refused in alter-ego form", () => {
    expectRefusedInAlterEgo("13013", SHE_HULK);
  });

  it("13014.surprise-attack-response: after you change form, deals 3 damage to an enemy (4 if paid with [physical])", () => {
    const damageFor = (payWith: string) => {
      const { state: opened, id } = openHandFor("13014", SHE_HULK, { alterEgo: true });
      const given = moveToHand(opened, P1, payWith);
      const villain = villainOf(given.state);
      const changed = settled(run(given.state, toHero(P1)), (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        if (choice.prompt.kind === "payForCard") return [`hand:${given.ids[0]!}`];
        return accepting("13014.surprise-attack-response")(s);
      });
      expect(playerOf(changed, P1).discard).toContain(id);
      return inst(changed, villain).damage - inst(given.state, villain).damage;
    };
    expect(damageFor("01090")).toBe(4);
    expect(damageFor("01088")).toBe(3);
  });

  it("13016.boot-camp-constant: each ally you control gets +1 ATK", () => {
    const { state: opened, id: camp } = openHandFor("13016", SHE_HULK, { extraDeck: ["13018"] });
    const given = moveToHand(opened, P1, "13018");
    const [ironheart] = given.ids as readonly [InstanceId];
    const payAlly = filler(given.state, 2, [camp, ironheart]);
    const withAlly = playCard(payAlly.state, ironheart, payAlly.ids);
    const atkBefore = characterProfile(withAlly, ironheart, PLAYABLE_DEPS)!.atk;
    const payCamp = filler(withAlly, 3, [camp, ironheart]);
    const after = playCard(payCamp.state, camp, payCamp.ids);
    expect(playerOf(after, P1).playArea).toContain(camp);
    expect(characterProfile(after, ironheart, PLAYABLE_DEPS)!.atk).toBe(atkBefore + 1);
  });

  it("13017.lie-in-wait-response: after a minion engages you, discard it to deal 3 damage to that minion", () => {
    const { state: opened, id: wait } = openHandFor("13017", SHE_HULK);
    const pay = filler(opened, 1, [wait]);
    const armed = playCard(pay.state, wait, pay.ids, firstLegal, identityOf(pay.state));
    expect(inst(armed, wait).attachedTo).toBeTruthy();
    // Advance (no boost icons) is Rhino's boost; Shocker (01103, 3 HP, no Toughness) is then dealt to and engages P1.
    const atDeclare = settleUntil(
      run(stackEncounterDeck(armed, "01186", "01103"), endTurn()),
      "declareDefender",
      firstLegal,
      PLAYABLE_DEPS,
    );
    const after = settled(
      answer(atDeclare, ["decline"], PLAYABLE_DEPS),
      accepting("13017.lie-in-wait-response"),
      (s) => s.step.kind === "turn",
    );
    // 3 damage exactly defeats Shocker's 3 hit points: it leaves play for the encounter discard.
    const shocker = instancesOf(after, "01103")[0]!;
    expect(activeEncounterDeck(after).discard).toContain(shocker);
    expect(playerOf(after, P1).playArea).not.toContain(shocker);
    expect(playerOf(after, P1).discard).toContain(wait);
  });
});

describe("Wasp pack basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("13018.ironheart-response: after you play Ironheart from your hand, draw 1 card", () => {
    const { state: opened, id } = openHandFor("13018", SPIDER_MAN);
    const pay = filler(opened, 2, [id]);
    const handBefore = playerOf(pay.state, P1).hand.length;
    const after = playCard(pay.state, id, pay.ids, accepting("13018.ironheart-response"));
    expect(playerOf(after, P1).playArea).toContain(id);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 2 + 1);
  });

  it("13019.spider-man-response: choose THW or ATK, Spider-Man gets +2 to it until the end of the phase", () => {
    const boosted = (power: "THW" | "ATK") => {
      const { state: opened, id } = openHandFor("13019", SPIDER_MAN);
      const pay = filler(opened, 3, [id]);
      const after = playCard(pay.state, id, pay.ids, (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label?.includes(power));
        return hit ? [hit.optionId] : accepting("13019.spider-man-response")(s);
      });
      return characterProfile(after, id, PLAYABLE_DEPS)!;
    };
    const base = { thw: 1, atk: 2 };
    expect(boosted("THW")).toMatchObject({ thw: base.thw + 2, atk: base.atk });
    expect(boosted("ATK")).toMatchObject({ thw: base.thw, atk: base.atk + 2 });
  });

  it("13020.swarm-tactics-action: Team-Up (Ant-Man and Wasp) keeps it out of every Core hero's deck", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, SPIDER_MAN, "13020");
    const created = createGame(playableScenario("rhino", { seed: 11, players: [seat] }), PLAYABLE_DEPS);
    expect(created.ok).toBe(false);
  });

  it("13024.the-power-in-all-of-us-constant: generates double when paying for a Basic card only", () => {
    const { state: opened, id: power } = openHandFor("13024", SPIDER_MAN, { extraDeck: ["13018"] });
    const given = moveToHand(opened, P1, "13018");
    const [ironheart] = given.ids as readonly [InstanceId]; // Basic, cost 2
    const paid = playCard(given.state, ironheart, [power]);
    expect(playerOf(paid, P1).playArea).toContain(ironheart);
    // Justice (not Basic) cost-2 card: the single Power card generates only 1.
    const justice = [...playerOf(given.state, P1).hand, ...playerOf(given.state, P1).deck].find((i) => {
      const c = cardOf(given.state, i);
      return c.type !== "resource" && "aspect" in c && c.aspect === "justice" && "cost" in c && c.cost === 2;
    });
    expect(justice).toBeDefined();
    const toHand = moveToHand(given.state, P1, cardOf(given.state, justice!).id as string);
    const refused = applyCommand(toHand.state, play(P1, toHand.ids[0]!, [power]), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("13034.athletic-conditioning-action: discards 1 stun or confuse status card from your hero", () => {
    const { state: opened, id } = openHandFor("13034", SPIDER_MAN);
    const identity = identityOf(opened);
    const staged = patchInstance(opened, identity, {
      statuses: { ...inst(opened, identity).statuses, stunned: 1, confused: 0 },
    });
    const pay = filler(staged, 1, [id]);
    const after = playCard(pay.state, id, pay.ids);
    expect(inst(after, identity).statuses.stunned).toBe(0);
    expect(playerOf(after, P1).discard).toContain(id);
  });

  it("13034.athletic-conditioning-action: a Hero Action, refused in alter-ego form", () => {
    expectRefusedInAlterEgo("13034", SPIDER_MAN);
  });
});

describe("Wasp pack justice card, from Spider-Man (Justice)'s own deck", () => {
  it("13031.running-interference-action: removes 2 threat plus the villain's stage number (max 3) from the main scheme", () => {
    const { state: opened, id } = openHandFor("13031", SPIDER_MAN);
    const staged = patchInstance(opened, opened.mainScheme.instanceId, { threat: 10 });
    const pay = filler(staged, 2, [id]);
    const after = playCard(pay.state, id, pay.ids);
    // Rhino is stage 1 in the standard scenario: 2 + 1.
    expect(mainThreat(after)).toBe(7);
  });

  it("13031.running-interference-action: a Hero Action, refused in alter-ego form", () => {
    expectRefusedInAlterEgo("13031", SPIDER_MAN);
  });
});

describe("Wasp pack leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("13032.all-for-one-action: 3 damage, +1 for each Avenger character you exhaust", () => {
    const { state: opened, id } = openHandFor("13032", CAP_MARVEL);
    const identity = identityOf(opened);
    const villain = villainOf(opened);
    const pay = filler(opened, 2, [id]);
    // Choose the hero (an Avenger) as the one character to exhaust.
    const after = playCard(pay.state, id, pay.ids, (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.options.some((o) => o.optionId === identity)) return [identity];
      return firstLegal(s);
    });
    expect(inst(after, identity).exhausted).toBe(true);
    expect(inst(after, villain).damage - inst(opened, villain).damage).toBe(4);
  });

  it("13032.all-for-one-action: a Hero Action, refused in alter-ego form", () => {
    expectRefusedInAlterEgo("13032", CAP_MARVEL);
  });
});

describe("Wasp pack protection card, from Black Panther (Protection)'s own deck", () => {
  it("13033.perseverance-response: after you change form, gives your hero a tough status card", () => {
    const { state: opened, id } = openHandFor("13033", BLACK_PANTHER, { alterEgo: true });
    const identity = identityOf(opened);
    expect(inst(opened, identity).statuses.tough).toBe(0);
    const pay = filler(opened, 1, [id]);
    const after = settled(run(pay.state, toHero(P1)), (s) =>
      s.pendingChoice?.prompt.kind === "payForCard"
        ? [`hand:${pay.ids[0]!}`]
        : accepting("13033.perseverance-response")(s),
    );
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, identity).statuses.tough).toBe(1);
  });
});
