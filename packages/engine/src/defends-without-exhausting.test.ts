/**
 * docs/phase7-wave9.md §3.47: `RuleSpec defendsWithoutExhausting`, "Hero Response: After the villain phase begins,
 * discard Draw Their Fire → Falcon does not exhaust to defend until the end of the phase" (`falcon` 53011), with
 * synthetic cards.
 *
 * Sources: RRG 1.8 "Defend, Defense" (p. 15): "A hero can use their basic defense power to defend against an enemy
 * attack. A hero must exhaust to use this power. The amount of damage dealt by the attack is reduced by the hero's DEF
 * value"; "A card ability that allows a hero to be declared as a defender without exhausting can be used on an
 * exhausted hero" (and the same for an ally); "An ally can exhaust to defend against an enemy attack. Damage from the
 * attack is dealt to that ally"; "Status Cards" (p. 41): stunned replaces an attack and confused a thwart;
 * "Lasting Effects" (p. 26): a lasting effect expires as its timing point is reached.
 *
 * The table: the hero has DEF 2 and 10 hit points. Every boost card has 0 boost icons. The villain attacks for 4, the
 * engaged minion (Thug) for 3, and the minion dealt as the encounter card (Striker, quickstrike) for 2. So a villain
 * phase is three attacks on the hero: defended they deal 2, 1 and 0; undefended 4, 3 and 2.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { defendPreview } from "./defend-preview.js";
import { type GameSession, replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import { legalDefenders } from "./resolve/enemy-activation.js";
import { defendsWithoutExhausting } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;
const YOUR_HERO = { categories: ["hero"], controller: "you" } as const;
const YOUR_ALLIES = { categories: ["ally"], controller: "you" } as const;
const noExhaust = (
  character: RuleSpec & { kind: "defendsWithoutExhausting" } extends { character: infer Q } ? Q : never,
) => ({ kind: "defendsWithoutExhausting", character }) as const;

/** Draw Their Fire's shape: "Hero Response: After the villain phase begins, discard this card → …". */
const DRAW_FIRE = stubAbility(
  "draw-fire.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      form: "hero",
      on: { on: "phaseBeginning", eventIs: { phase: "villain" } },
    },
    cost: { discardSelf: true },
    effects: [{ kind: "applyRuleUntil", rule: noExhaust(YOUR_HERO), until: "endOfPhase" }],
  }),
);
/** "Your hero does not exhaust to defend." as a constant. */
const STANCE = stubAbility(
  "stance.constant",
  def({ trigger: { kind: "constant", rules: [noExhaust(YOUR_HERO)] }, effects: [] }),
);
/** "Forced Response: After your hero defends, discard this card." beside the constant: the rule ends mid-phase. */
const STANCE_ENDS = stubAbility(
  "stance-ends.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "defended", targetIs: YOUR_HERO } },
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "discard" }],
  }),
);
/** "Your allies do not exhaust to defend." */
const DRILL = stubAbility(
  "drill.constant",
  def({ trigger: { kind: "constant", rules: [noExhaust(YOUR_ALLIES)] }, effects: [] }),
);
/** "Forced Response: After your hero defends, place 1 defended counter here." */
const AFTER_DEFEND = stubAbility(
  "after-defend.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "defended", targetIs: YOUR_HERO } },
    effects: [{ kind: "addCounters", target: self, counterType: "defended", amount: one }],
  }),
);
/** "Forced Response: After you use your hero's basic defense, place 1 power counter here." */
const AFTER_POWER = stubAbility(
  "after-power.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "basicPowerUsed", playerIs: "controller" } },
    effects: [{ kind: "addCounters", target: self, counterType: "power", amount: one }],
  }),
);

const FIRE = stubSupport({ id: "fire", cost: 0, abilities: [DRAW_FIRE.ref] });
const STANCE_CARD = stubSupport({ id: "stance", cost: 0, abilities: [STANCE.ref] });
const BRIEF_STANCE = stubSupport({ id: "brief-stance", cost: 0, abilities: [STANCE.ref, STANCE_ENDS.ref] });
const DRILL_CARD = stubSupport({ id: "drill", cost: 0, abilities: [DRILL.ref] });
const LEDGER = stubSupport({ id: "ledger", cost: 0, abilities: [AFTER_DEFEND.ref, AFTER_POWER.ref] });
const GUARD = stubAlly({ id: "guard-ally", cost: 0, atk: 1, thw: 1, hp: 9 });
const THUG = stubMinion({ id: "thug", atk: 3, sch: 0, hp: 9, boostIcons: 0 });
const STRIKER = stubMinion({
  id: "striker",
  atk: 2,
  sch: 0,
  hp: 9,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(50), atk: 4, sch: 0 }] });

const deps: EngineDeps = depsOf(DRAW_FIRE, STANCE, STANCE_ENDS, DRILL, AFTER_DEFEND, AFTER_POWER);
const CARDS = [FIRE, STANCE_CARD, BRIEF_STANCE, DRILL_CARD, LEDGER, GUARD, THUG, STRIKER, BLANK];

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly ledger: InstanceId;
  /** The instance of each support or ally asked for, by card id. */
  readonly ids: Readonly<Record<string, InstanceId>>;
}
/**
 * The first player's turn, hero form, the Thug engaged, the Striker second from the top of the encounter deck (after the
 * villain's one boost card; a minion's attack takes none), the ledger and the named cards in play.
 */
function table(...inPlay: readonly { readonly id: string }[]): Table {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: BOSS,
    encounter: [THUG.id, STRIKER.id, ...copiesOf(BLANK.id, 30)],
    deck: CARDS.filter((c) => c.type === "support" || c.type === "ally").map((c) => c.id),
  });
  state = minionEngagedWith(state, THUG.id).state;
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const striker = piles.deck.find((id) => state.instances[id]?.cardId === STRIKER.id)!;
  const rest = piles.deck.filter((id) => id !== striker);
  state = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...piles, deck: [...rest.slice(0, 1), striker, ...rest.slice(1)] },
    },
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const ids: Record<string, InstanceId> = {};
  for (const card of [LEDGER, ...inPlay]) {
    const placed = playerCardIntoPlay(state, card.id as never);
    state = placed.state;
    ids[card.id] = placed.id;
  }
  return { state, hero: mustPlayer(state, P1).identity.instanceId, ledger: ids[LEDGER.id]!, ids };
}

interface Plan {
  /** Accept Draw Their Fire's response when it is offered. */
  readonly drawFire?: boolean;
  /** Who is declared at each Declare Defender step, in order; a step past the list, or `null`, declines. */
  readonly defenders: readonly (InstanceId | null)[];
  /** Runs once, as the first Declare Defender prompt opens (test surgery inside the villain phase). */
  readonly atFirstDeclare?: (state: GameState) => GameState;
}
interface Outcome {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** The characters offered at each Declare Defender step, and whether each was exhausted when offered. */
  readonly offered: readonly (readonly { readonly id: InstanceId; readonly exhausted: boolean }[])[];
  /** `defendPreview` at each step, for the hero's option: what it exhausts, the DEF it subtracts. */
  readonly previews: readonly ({
    readonly exhausts: readonly InstanceId[];
    readonly defenseReduction: number;
  } | null)[];
}
/**
 * Ends P1's turn and plays the villain phase through to the next player phase, answering as planned. Each stretch of
 * the log replays to the same state (a new session starts after the surgery, when there is one).
 */
function villainPhase(t: Table, plan: Plan): Outcome {
  let session: GameSession = startSession(t.state);
  const events: GameEvent[] = [];
  const offered: { id: InstanceId; exhausted: boolean }[][] = [];
  const previews: Outcome["previews"][number][] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const checkReplay = (): void => {
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  };
  let declared = 0;
  let operated = false;
  apply({ type: "endTurn", playerId: P1 });
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error("the villain phase did not settle");
    if (session.state.step.phase === "player" && session.state.round > t.state.round) break;
    const choice = session.state.pendingChoice;
    let selected: readonly string[];
    if (choice.prompt.kind === "declareDefender") {
      if (!operated && plan.atFirstDeclare) {
        operated = true;
        checkReplay();
        session = startSession(plan.atFirstDeclare(session.state));
        continue;
      }
      const state = session.state;
      offered.push(
        choice.options.flatMap((o) =>
          o.ref.kind === "card"
            ? [{ id: o.ref.instanceId, exhausted: mustInstance(state, o.ref.instanceId).exhausted }]
            : [],
        ),
      );
      const preview = defendPreview(state, deps)?.find((option) => option.defenderInstanceId === t.hero);
      previews.push(preview ? { exhausts: preview.exhausts, defenseReduction: preview.defenseReduction } : null);
      const wanted = plan.defenders[declared++] ?? null;
      selected = wanted && choice.options.some((o) => o.optionId === wanted) ? [wanted] : ["decline"];
    } else if (choice.prompt.kind === "chooseTriggers") {
      selected = choice.options
        .filter((o) => plan.drawFire === true && o.optionId.endsWith(DRAW_FIRE.ref.id))
        .map((o) => o.optionId);
    } else {
      selected = defaultPick(session.state);
    }
    apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected });
  }
  checkReplay();
  return { state: session.state, events, offered, previews };
}
const counter = (state: GameState, id: InstanceId, name: string): number => mustInstance(state, id).counters[name] ?? 0;
const exhausted = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).exhausted;
const declarations = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "defenderDeclared"
      ? [{ defender: e.defenderInstanceId, withoutExhausting: e.withoutExhausting === true }]
      : [],
  );
const exhaustions = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((e) => e.type === "cardExhausted" && e.instanceId === id).length;
const exhaust =
  (id: InstanceId) =>
  (state: GameState): GameState => ({
    ...state,
    instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
  });

describe("§3.47 `defendsWithoutExhausting`: a character that does not exhaust to defend", () => {
  it("without the rule a hero defends once: 2 damage through DEF 2, exhausted, then 3 + 2 undefended", () => {
    const t = table();
    const out = villainPhase(t, { defenders: [t.hero, t.hero, t.hero] });
    // Offered at the first step only: exhausted, the hero is not a legal defender of the next two attacks.
    expect(out.offered.map((step) => step.map((o) => o.id))).toEqual([[t.hero]]);
    expect(out.previews).toEqual([{ exhausts: [t.hero], defenseReduction: 2 }]);
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 3 + 2);
    expect(declarations(out.events)).toEqual([{ defender: t.hero, withoutExhausting: false }]);
    expect(exhaustions(out.events, t.hero)).toBe(1);
    expect(counter(out.state, t.ledger, "defended")).toBe(1);
  });

  it("with it the hero defends all three attacks with DEF 2 (2 + 1 + 0 damage) and is ready throughout", () => {
    const t = table(FIRE);
    const out = villainPhase(t, { drawFire: true, defenders: [t.hero, t.hero, t.hero] });
    expect(locateCard(out.state, t.ids[FIRE.id]!)).toMatchObject({ kind: "discard" });
    expect(out.offered).toEqual([
      [{ id: t.hero, exhausted: false }],
      [{ id: t.hero, exhausted: false }],
      [{ id: t.hero, exhausted: false }],
    ]);
    // The preview: declaring the hero exhausts nothing, and DEF 2 still comes off.
    expect(out.previews).toEqual([
      { exhausts: [], defenseReduction: 2 },
      { exhausts: [], defenseReduction: 2 },
      { exhausts: [], defenseReduction: 2 },
    ]);
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 1 + 0);
    expect(declarations(out.events)).toEqual([
      { defender: t.hero, withoutExhausting: true },
      { defender: t.hero, withoutExhausting: true },
      { defender: t.hero, withoutExhausting: true },
    ]);
    expect(exhaustions(out.events, t.hero)).toBe(0);
    expect(exhausted(out.state, t.hero)).toBe(false);
    // "After you defend" and "after you use a basic power" resolve for each defense, as for any basic defense.
    expect(counter(out.state, t.ledger, "defended")).toBe(3);
    expect(counter(out.state, t.ledger, "power")).toBe(3);
  });

  it("the response is declined: the hero exhausts to defend as usual", () => {
    const t = table(FIRE);
    const out = villainPhase(t, { defenders: [t.hero, t.hero, t.hero] });
    expect(locateCard(out.state, t.ids[FIRE.id]!)).toMatchObject({ kind: "playArea" });
    expect(out.offered).toHaveLength(1);
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 3 + 2);
  });

  it("it may decline an attack and defend a later one: 4 undefended, then 1 and 0", () => {
    const t = table(FIRE);
    const out = villainPhase(t, { drawFire: true, defenders: [null, t.hero, t.hero] });
    expect(mustInstance(out.state, t.hero).damage).toBe(4 + 1 + 0);
    expect(counter(out.state, t.ledger, "defended")).toBe(2);
  });

  it("an exhausted hero defends under it, and stays exhausted", () => {
    const t = table(FIRE);
    const out = villainPhase(t, {
      drawFire: true,
      defenders: [t.hero, t.hero, t.hero],
      atFirstDeclare: exhaust(t.hero),
    });
    expect(out.offered).toEqual([
      [{ id: t.hero, exhausted: true }],
      [{ id: t.hero, exhausted: true }],
      [{ id: t.hero, exhausted: true }],
    ]);
    expect(out.previews[0]).toEqual({ exhausts: [], defenseReduction: 2 });
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 1 + 0);
    expect(exhaustions(out.events, t.hero)).toBe(0);
    expect(exhausted(out.state, t.hero)).toBe(true);
    // Without the rule an exhausted hero is offered no defense at all.
    const plain = table();
    expect(legalDefenders(exhaust(plain.hero)(plain.state), P1, deps)).toEqual([]);
    const stance = table(STANCE_CARD);
    expect(legalDefenders(exhaust(stance.hero)(stance.state), P1, deps)).toEqual([stance.hero]);
  });

  it("a stunned and confused hero defends under it as any hero does, and keeps both status cards", () => {
    const t = table(FIRE);
    const statuses = { stunned: 1, confused: 1, tough: 0 };
    const state: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.hero]: { ...mustInstance(t.state, t.hero), statuses } },
    };
    const out = villainPhase({ ...t, state }, { drawFire: true, defenders: [t.hero, t.hero, t.hero] });
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 1 + 0);
    expect(mustInstance(out.state, t.hero).statuses).toEqual(statuses);
  });

  it("the rule is gone when the phase ends: the next villain phase the hero exhausts to defend again", () => {
    const t = table(FIRE);
    const first = villainPhase(t, { drawFire: true, defenders: [t.hero, t.hero, t.hero] });
    expect(first.state.step.phase).toBe("player");
    expect(defendsWithoutExhausting(first.state, deps, t.hero)).toBe(false);
    expect(first.state.lastingEffects.filter((e) => e.kind === "ruleGrant")).toEqual([]);
    const damage = mustInstance(first.state, t.hero).damage;
    // Round 2: the Thug and the Striker are both engaged. The villain's attack is defended (2), then 3 + 2 undefended.
    const second = villainPhase({ ...t, state: first.state }, { defenders: [t.hero, t.hero, t.hero] });
    expect(second.offered.map((step) => step.map((o) => o.id))).toEqual([[t.hero]]);
    expect(mustInstance(second.state, t.hero).damage - damage).toBe(2 + 3 + 2);
  });

  it("in alter-ego form the rule gives no defense: there is no hero to declare", () => {
    const t = table(STANCE_CARD);
    const alterEgo: GameState = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    expect(legalDefenders(alterEgo, P1, deps)).toEqual([]);
    expect(legalDefenders(t.state, P1, deps)).toEqual([t.hero]);
  });

  it("the rule ends mid-phase: the defense declared under it stands, the next one exhausts, the third is not offered", () => {
    const t = table(BRIEF_STANCE);
    expect(defendsWithoutExhausting(t.state, deps, t.hero)).toBe(true);
    const out = villainPhase(t, { defenders: [t.hero, t.hero, t.hero] });
    expect(locateCard(out.state, t.ids[BRIEF_STANCE.id]!)).toMatchObject({ kind: "discard" });
    expect(declarations(out.events)).toEqual([
      { defender: t.hero, withoutExhausting: true },
      { defender: t.hero, withoutExhausting: false },
    ]);
    expect(out.previews).toEqual([
      { exhausts: [], defenseReduction: 2 },
      { exhausts: [t.hero], defenseReduction: 2 },
    ]);
    expect(mustInstance(out.state, t.hero).damage).toBe(2 + 1 + 2);
    expect(exhaustions(out.events, t.hero)).toBe(1);
  });

  it("an ally under it defends every attack, takes the damage (4 + 3 + 2 of 9: defeated by the third) and never exhausts", () => {
    const t = table(DRILL_CARD, GUARD);
    const ally = t.ids[GUARD.id]!;
    expect(defendsWithoutExhausting(t.state, deps, ally)).toBe(true);
    expect(defendsWithoutExhausting(t.state, deps, t.hero)).toBe(false);
    const out = villainPhase(t, { defenders: [ally, ally, ally] });
    expect(declarations(out.events)).toEqual([
      { defender: ally, withoutExhausting: true },
      { defender: ally, withoutExhausting: true },
      { defender: ally, withoutExhausting: true },
    ]);
    expect(exhaustions(out.events, ally)).toBe(0);
    // An ally has no DEF: 4, then 3, then 2 is 9 damage on 9 hit points.
    expect(locateCard(out.state, ally)).toMatchObject({ kind: "discard" });
    expect(mustInstance(out.state, t.hero).damage).toBe(0);
    // The hero, without the rule, is offered beside the ally and would exhaust.
    expect(out.offered[0]).toEqual([
      { id: t.hero, exhausted: false },
      { id: ally, exhausted: false },
    ]);
    expect(out.previews[0]).toEqual({ exhausts: [t.hero], defenseReduction: 2 });
  });

  it("an exhausted ally under it is offered; one without the rule is not", () => {
    const t = table(DRILL_CARD, GUARD);
    const ally = t.ids[GUARD.id]!;
    const spent = exhaust(ally)(t.state);
    expect(legalDefenders(spent, P1, deps)).toEqual([t.hero, ally]);
    const plain = table(GUARD);
    expect(legalDefenders(exhaust(plain.ids[GUARD.id]!)(plain.state), P1, deps)).toEqual([plain.hero]);
  });
});
