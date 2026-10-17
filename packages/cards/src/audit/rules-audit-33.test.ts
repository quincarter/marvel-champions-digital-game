/**
 * Rules audit chunk 33 (FFG rulings Apr 17 - Jul 25, 2025, post-RRG 1.6). Audit proofs only: each `it.fails` marks a
 * place the engine does something the rulings forbid, and flips to a failure when it is fixed.
 */
import { JUBILEE_CARDS, WAVE7_CARDS, WAVE8_STARTER_DECKS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type Command,
  type GameEvent,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../dsl/index.js";
import { coreScenario } from "../core/setup.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { JUBILEE_ABILITIES } from "../wave8/jubilee/index.js";
import {
  firstLegal,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  settle,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { AOS_ABILITIES } from "../wave9/aos/index.js";
import { wave9Scenario } from "../wave9/setup.js";

vi.setConfig({ testTimeout: 180_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, AOS_ABILITIES) };
const SPRAY_FIRE = "50039";
const ATTACROBATICS = "50076";
const ABDUCTOR = "50080"; // A.I.M. Abductor, a minion in the Black Widow encounter deck

describe("audit 33.29: Attacrobatics prevents only the damage dealt to Black Widow (Ruling 69.71, July 11, 2025)", () => {
  // "Like Temporal Shield preventing just the damage dealt to Kang, Attacrobatics only prevents the damage that would be
  // dealt to Black Widow during the attack. Spray Fire would still deal damage to engaged minions."
  // RRG 1.8 p. 10 ("an ability labeled as an attack is considered a single attack") does not say that a Preparation's
  // "this attack" covers every target; "Prevent" (p. 35) is per damage instance. The engine follows owner decision Q4 = A
  // (`engine/src/resolve/attack-ability.ts` header, `wave9/aos/scenarios-rulings.qa.test.ts`), which pins the opposite.
  it.fails("Spray Fire on Black Widow with Attacrobatics on top: she takes nothing, the engaged minion still takes 3", () => {
    const config = wave9Scenario("black-widow", {
      players: [{ starterDeckId: "nick-fury-justice" }],
      seed: 1,
      difficulty: "standard",
    });
    const created = createGame(config, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    // Clear setup minions off the table, then engage one Abductor with P1.
    const deckId = activeEncounterDeckId(state);
    const setup = cardsInPlay(state).filter((i) => state.instances[i]!.engagedWith !== undefined);
    let pile = state.encounterDecks[deckId]!;
    state = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...setup] } },
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !setup.includes(i)) })),
      instances: Object.fromEntries(
        Object.entries(state.instances).map(([id, i]) => [
          id,
          setup.includes(id as InstanceId) ? { ...i, engagedWith: undefined } : i,
        ]),
      ) as GameState["instances"],
    };
    state = withForm(state, { heroForm: 0 }, P1);
    pile = state.encounterDecks[deckId]!;
    const minion = [...pile.deck, ...pile.discard].find((i) => state.instances[i]?.cardId === cardId(ABDUCTOR))!;
    state = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== minion), discard: pile.discard.filter((i) => i !== minion) },
      },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
      instances: { ...state.instances, [minion]: { ...state.instances[minion]!, faceup: true, engagedWith: P1 } },
    };
    // Black Widow's interrupt discards the top encounter card: make it Attacrobatics (standard mode: just prevention).
    const top = state.encounterDecks[deckId]!.deck[0]!;
    state = patchInstance(state, top, { cardId: cardId(ATTACROBATICS) });
    const given = moveToHand(state, P1, SPRAY_FIRE);
    const [spray] = given.ids as [InstanceId];
    const command: Command = play(P1, spray, payWith(given.state, P1, 3, [spray]));
    const { state: after } = driveEventsPicking(
      DEPS,
      given.state,
      (s) => {
        const c = s.pendingChoice!;
        return c.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
      },
      command,
    );
    const villain = after.villains[0]!.instanceId;
    expect(inst(after, villain).damage).toBe(0); // setup check: Attacrobatics prevented the damage to her
    expect(inst(after, minion).damage).toBe(3); // actual: 0 (the whole attack was prevented)
  });
});

describe("audit 33.25: Multitalented is an attack and a thwart whatever was paid (Ruling 69.67, June 26, 2025)", () => {
  // "Regardless of which resources were paid or which effects were resolved, Multitalented is still labeled as an
  // 'attack' and a 'thwart,' and by playing it your hero is considered to have 'attacked' and 'thwarted' ... Something
  // you could do if you only healed using Multitalented would be triggering Surprise! and/or playing Pitchback."
  // RRG 1.8 p. 26 "Labeled Ability": resolving a labeled ability is considered to be that labeled effect by the identity.
  // Fixed (contributor's rules call (bluefireF5ran), 2026-10-15): every "(attack)" ability begins its attack as it begins resolving,
  // whether or not its damage line runs (`beginLabelAttack`, engine `resolve/attack-ability.ts`).
  it("paid with [energy] and [mental] only, Jubilee is still considered to have attacked", () => {
    const jubilee = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
    const deck = jubilee.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
    const abilities = mergeRegistries(WAVE7_ABILITIES, JUBILEE_ABILITIES);
    const deps: EngineDeps = { abilities };
    const pool = [...WAVE7_CARDS, ...JUBILEE_CARDS];
    const base = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: pool,
    });
    const extra = ["47021", "47019", "47013", "47019"].map((c) => cardId(c));
    const players = [{ identityCardId: jubilee.identityCardId, aspects: jubilee.aspects, deck: [...deck, ...extra] }];
    const created = createGame({ ...base, players, requireLegalDecks: false }, deps);
    if (!created.ok) throw new Error(created.error.message);
    let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
    state = withForm(state, { heroForm: 0 }, P1);
    // Hand: Multitalented plus two [energy] (Cell Phone 47019) and one [mental] (Disguise 47013) resource cards.
    const cleared: GameState = {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
    };
    const given = moveToHand(
      patchInstance(cleared, cleared.mainScheme.instanceId, { threat: 6 }),
      P1,
      "47021",
      "47019",
      "47013",
      "47019",
    );
    const [event, ...paid] = given.ids as [InstanceId, ...InstanceId[]];
    const rhino = given.state.activeVillainId!;
    const main = given.state.mainScheme.instanceId;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice && (choice.prompt.kind === "chooseCards" || choice.prompt.kind === "chooseTarget")) {
        const hits = [rhino, main].filter((id) => choice.options.some((o) => o.optionId === id));
        if (hits.length > 0) return hits.slice(0, choice.maxSelections);
      }
      return firstLegal(s);
    };
    const run = driveEventsPicking(deps, given.state, pick, play(P1, event, paid));
    const attacks = run.events.flatMap((e: GameEvent) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
    );
    // Setup check: the thwart half happened (the cost was paid and the ability resolved).
    expect(inst(run.state, main).threat).toBeLessThan(inst(given.state, main).threat);
    // Expected: one labeled attack by Jubilee (no attacked enemy). Actual: none.
    expect(attacks).toHaveLength(1);
  });
});
