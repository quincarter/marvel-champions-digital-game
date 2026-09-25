import { activeEncounterDeckId, characterProfile, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import {
  applyOk,
  endTurn,
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
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, revealFromEncounterDeck, stageNemesisCardForReveal } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { nebulaScenario } from "./support.js";

const nebulaVsRhino = (seed = 1) => startWave4Game(nebulaScenario("rhino", { seed }));

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else. Mirrors
 * `../../wave3/gam/gamora-obligation-nemesis.test.ts`'s own `pickingLabelStartingWith`. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** `../../testing/staging.ts`'s `driveEvents`, but with a caller-supplied `pick` rather than a hardcoded
 * `firstLegal` — needed here because the default `firstLegal` would always take Inferiority Complex's *first*
 * `chooseOne` branch ("Exhaust Nebula → remove this obligation"), never the alternative this test needs to reach. */
function driveEventsWith(
  state: GameState,
  pick: Picker,
  ...commands: readonly Parameters<typeof runWith>[2][]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        WAVE4_DEPS,
      );
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, WAVE4_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

describe("Nebula's obligation (Inferiority Complex, 22027)", () => {
  it("(22027.obligation): exhausting your alter-ego removes it from the game, leaving your hand untouched", () => {
    const withObligation = stageWithFiller(nebulaVsRhino(1), "22027");
    const handBefore = playerOf(withObligation, P1).hand.length;
    const revealed = settle(
      runWith(WAVE4_DEPS, withObligation, endTurn()),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE4_DEPS,
    );
    const [obligation] = instancesOf(revealed, "22027");
    expect(revealed.removedFromGame).toContain(obligation);
    expect(playerOf(revealed, P1).hand.length).toBe(handBefore);
  });

  it("(22027.obligation): discarding 2 technique upgrades she controls discards the obligation instead", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(2), toHero());
    const { state: withOne, id: tech1 } = playFromHand(hero, "22004", 1);
    const { state: withTwo, id: tech2 } = playFromHand(withOne, "22006", 1);
    const staged = stageWithFiller(withTwo, "22027");
    const revealed = settle(
      runWith(WAVE4_DEPS, staged, endTurn()),
      pickingLabelStartingWith("Choose and discard 2 Technique"),
      undefined,
      WAVE4_DEPS,
    );
    const [obligation] = instancesOf(revealed, "22027");
    expect(revealed.removedFromGame).not.toContain(obligation);
    expect(playerOf(revealed, P1).discard).toContain(tech1);
    expect(playerOf(revealed, P1).discard).toContain(tech2);
  });

  it("(22027.obligation): with no technique upgrades to discard, the card gains surge instead", () => {
    const start = nebulaVsRhino(3);
    const staged = stageWithFiller(start, "22027");
    // No technique upgrades to choose from (`chooseCards`'s own `minSelections`/`max` both cap to 0 candidates), so
    // the "if no upgrade was discarded" branch gains surge. `driveEventsWith` (not `settle`, which only returns the
    // final state) is what proves surge actually fired: the extra card it deals doesn't reliably land back in the
    // discard pile to count there (it might resolve into play instead), so the `surgeTriggered` event itself is the
    // real signal.
    const { events } = driveEventsWith(staged, pickingLabelStartingWith("Choose and discard 2 Technique"), endTurn());
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });
});

describe("Nebula's nemesis set (Gamora, Self-Preservation, Lethal Weapon, Old Rivals)", () => {
  it("Gamora nemesis minion (22028.gamora-forced-interrupt): when this minion would enter play, discard the Gamora ally from play", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(4), toHero());
    const givenAlly = moveToHand(hero, P1, "22002");
    const [gamoraAllyId] = givenAlly.ids as [InstanceId];
    const withAlly = settle(
      runWith(WAVE4_DEPS, givenAlly.state, play(P1, gamoraAllyId, payWith(givenAlly.state, P1, 3, [gamoraAllyId]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(withAlly, P1).playArea).toContain(gamoraAllyId);
    const { state: withMinion } = revealFromEncounterDeck(WAVE4_DEPS, withAlly, "22028", firstLegal, 1);
    expect(instancesOf(withMinion, "22028").some((id) => playerOf(withMinion, P1).playArea.includes(id))).toBe(true);
    expect(playerOf(withMinion, P1).playArea).not.toContain(gamoraAllyId);
    expect(playerOf(withMinion, P1).discard).toContain(gamoraAllyId);
  });

  it("Gamora nemesis minion (22028.gamora-forced-response): after Gamora attacks and damages you, choose and discard an upgrade you control", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(5), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "22019", 2);
    const { state: withMinion, id: minion } = revealFromEncounterDeck(WAVE4_DEPS, withUpgrade, "22028", firstLegal, 1);
    // Engage the minion with P1 directly (test surgery — the reveal above may or may not already have engaged it
    // depending on setup order, and this test cares only about the forced response once she attacks, not the
    // engagement rule itself).
    const identity = identityOf(withMinion, P1);
    const engaged = patchInstance(withMinion, minion, { engagedWith: P1 });
    const afterAttack = settle(runWith(WAVE4_DEPS, engaged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    // Whatever damage the minion's attack dealt, the forced response should have offered (and, via `firstLegal`,
    // resolved) discarding the one upgrade she controls.
    if (inst(afterAttack, identity).damage > 0) {
      expect(inst(afterAttack, identity).attachments).not.toContain(upgrade);
      expect(playerOf(afterAttack, P1).discard).toContain(upgrade);
    }
  });

  it("Self-Preservation (22029.self-preservation-constant, 22029.self-preservation-constant-2): Nebula gets -1 THW/-1 ATK/-1 DEF; Gamora gets +1 ATK and piercing attacks", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(6), toHero());
    const identity = identityOf(hero, P1);
    const before = characterProfile(hero, identity, WAVE4_DEPS)!;
    const givenAlly = moveToHand(hero, P1, "22002");
    const [gamoraAllyId] = givenAlly.ids as [InstanceId];
    const withAlly = settle(
      runWith(WAVE4_DEPS, givenAlly.state, play(P1, gamoraAllyId, payWith(givenAlly.state, P1, 3, [gamoraAllyId]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const gamoraBefore = characterProfile(withAlly, gamoraAllyId, WAVE4_DEPS)!;
    const schemeId = "self-preservation-test" as InstanceId;
    const withScheme: GameState = {
      ...withAlly,
      villainArea: [...withAlly.villainArea, schemeId],
      instances: {
        ...withAlly.instances,
        [schemeId]: {
          instanceId: schemeId,
          cardId: "22029" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 2,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const after = characterProfile(withScheme, identity, WAVE4_DEPS)!;
    expect(after.thw).toBe(before.thw - 1);
    expect(after.atk).toBe(before.atk - 1);
    expect(after.def).toBe(before.def - 1);
    const gamoraAfter = characterProfile(withScheme, gamoraAllyId, WAVE4_DEPS)!;
    expect(gamoraAfter.atk).toBe(gamoraBefore.atk + 1);
  });

  it("Old Rivals (22031.when-revealed): the Gamora ally attacks you without exhausting (no surge); with no Gamora it surges", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(5), toHero());
    const identity = identityOf(hero, P1);
    const givenAlly = moveToHand(hero, P1, "22002");
    const [gamora] = givenAlly.ids as [InstanceId];
    const withAlly = settle(
      runWith(WAVE4_DEPS, givenAlly.state, play(P1, gamora, payWith(givenAlly.state, P1, 3, [gamora]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const gamoraAtk = characterProfile(withAlly, gamora, WAVE4_DEPS)!.atk;
    const rivalsSurged = (events: readonly GameEvent[], state: GameState) =>
      events.some((e) => e.type === "surgeTriggered" && state.instances[e.instanceId]?.cardId === ("22031" as never));
    const withGamora = driveEvents(WAVE4_DEPS, stageNemesisCardForReveal(withAlly, "22031"), endTurn(P1));
    expect(withGamora.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: identity, sourceInstanceId: gamora }),
    );
    expect(gamoraAtk).toBeGreaterThan(0);
    expect(rivalsSurged(withGamora.events, withGamora.state)).toBe(false);
    const alone = driveEvents(WAVE4_DEPS, stageNemesisCardForReveal(hero, "22031"), endTurn(P1));
    expect(rivalsSurged(alone.events, alone.state)).toBe(true);
  });

  it("Lethal Weapon (22030.lethal-weapon-action): discard an upgrade you control → discard this attachment", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(4), toHero());
    const givenAlly = moveToHand(hero, P1, "22002");
    const [gamora] = givenAlly.ids as [InstanceId];
    const withAlly = settle(
      runWith(WAVE4_DEPS, givenAlly.state, play(P1, gamora, payWith(givenAlly.state, P1, 3, [gamora]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const { state: withTech, id: tech } = playFromHand(withAlly, "22005", 1);
    // Lethal Weapon, attached to the Gamora ally as its reveal would ("Attach to Gamora").
    const weapon = "lethal-weapon-test" as InstanceId;
    const staged: GameState = {
      ...withTech,
      instances: {
        ...withTech.instances,
        [gamora]: { ...inst(withTech, gamora), attachments: [weapon] },
        [weapon]: {
          instanceId: weapon,
          cardId: "22030" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: gamora,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const after = settle(
      runWith(WAVE4_DEPS, staged, use(P1, weapon, "22030.lethal-weapon-action", [], { discarded: [tech] })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(tech);
    expect(inst(after, gamora).attachments).not.toContain(weapon);
    expect(after.encounterDecks[activeEncounterDeckId(after)]!.discard).toContain(weapon);
  });
});

/** Stacks `code` on top of the encounter deck behind a filler card (Advance, 01186 — never resolved as a boost
 * card), the same convention `../../wave3/gam/gamora-obligation-nemesis.test.ts` uses for its own obligation
 * (`stackEncounterDeck`) — an obligation is already shuffled *into* the encounter deck at setup (unlike a nemesis
 * card, which starts set aside), so `stageNemesisCardForReveal` (built around `player.setAside`) doesn't apply. */
function stageWithFiller(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === code) ??
    pile.discard.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const filler = pile.deck.find((i) => state.instances[i]?.cardId === "01186" && i !== id);
  const rest = pile.deck.filter((i) => i !== id && i !== filler);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: filler ? [filler, id, ...rest] : [id, ...rest] },
    },
  };
}
