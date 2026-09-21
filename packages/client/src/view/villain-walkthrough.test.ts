/**
 * The walkthrough is rebuilt from a real villain phase's event stream, played
 * by real Core content — the whole reason it exists is that the engine runs the
 * phase inside one command, so a synthetic event list would prove nothing.
 */

import { activeAbilityRefs, activeVillain } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { ChoiceOption, ChoicePrompt, GameState, PendingChoice, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  appendWalkthrough,
  decisionLabel,
  emptyWalkthrough,
  inlineInterruptFor,
  interruptActionLabel,
  pauseFor,
  VILLAIN_STEPS,
  type Walkthrough,
} from "./villain-walkthrough.js";

interface Played {
  readonly walkthrough: Walkthrough;
  readonly state: GameState;
  readonly viewer: PlayerId;
  /** Every pause seen across the phase, in order. */
  readonly pauses: readonly string[];
}

/**
 * Plays a Rhino solo game by ending every turn as fast as possible, which is
 * the quickest route into a full villain phase, and folds each update onto the
 * walkthrough exactly as the Board scene would.
 */
async function playThroughVillainPhase(): Promise<Played> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  const viewer = store.state.game!.players[0]!.playerId;

  let walkthrough = emptyWalkthrough(store.state.game!.round);
  const pauses: string[] = [];
  let sawVillainPhase = false;

  for (let step = 0; step < 80 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await store.dispatch(end.example);
    } else break;

    walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer, POOL_DEPS);
    if (walkthrough.pausedAt) pauses.push(walkthrough.pausedAt.label);
    if (walkthrough.activeStep !== null) sawVillainPhase = true;
    // Stop once a whole villain phase has been walked.
    if (sawVillainPhase && walkthrough.complete) break;
    if (store.state.game!.outcome) break;
  }

  return { walkthrough, state: store.state.game!, viewer, pauses };
}

describe("villain phase walkthrough", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  test("rebuilds all five RRG steps, in order, from the event stream alone", () => {
    const { steps } = played.walkthrough;

    expect(steps.map((step) => step.kind)).toEqual([...VILLAIN_STEPS]);
    expect(steps.map((step) => step.number)).toEqual([1, 2, 3, 4, 5]);
    for (const step of steps) expect(step.title.length).toBeGreaterThan(0);
  });

  test("the phase actually produced beats, so the screen has something to advance through", () => {
    const total = played.walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

    expect(total).toBeGreaterThan(0);
    // Threat placement is step one, so it can never be empty in a real phase.
    expect(played.walkthrough.steps[0]!.beats.length).toBeGreaterThan(0);
    expect(played.walkthrough.steps[0]!.beats.some((beat) => /threat/i.test(beat.text))).toBe(true);
    // Step two ran the villain's activation against the seat.
    expect(played.walkthrough.steps[1]!.beats.some((beat) => /Rhino/.test(beat.text))).toBe(true);
  });

  /**
   * Regression: step 3 always moves at least one card into `dealtEncounter`
   * (RRG "Villain Phase" step 3 deals every player a card, hazard icons aside),
   * but that move used to be a bare `cardMoved` — bookkeeping the log already
   * drops — so the step showed nothing while steps 1, 2, 4 and 5 all had a
   * beat. A silent step reads as a bug, not as "nothing happened here."
   */
  test("step three (deal encounter cards) is never silently empty", () => {
    const deal = played.walkthrough.steps[2]!;
    expect(deal.kind).toBe("dealEncounterCards");
    expect(deal.beats.length).toBeGreaterThan(0);
    expect(deal.beats.some((beat) => /dealt/i.test(beat.text))).toBe(true);
  });

  test("records only the villain phase: no player-turn beats leak in", () => {
    const texts = played.walkthrough.steps.flatMap((step) => step.beats.map((beat) => beat.text));

    // "You take a turn." and the end-of-phase discard belong to the player
    // phase; the walkthrough is a villain-phase screen and must ignore them.
    expect(texts.some((text) => /take a turn/.test(text))).toBe(false);
    expect(texts.length).toBeGreaterThan(0);
  });

  test("shows one phase at a time rather than accumulating rounds", () => {
    // Every beat recorded belongs to the round the walkthrough reports.
    const perStep = played.walkthrough.steps.map((step) => step.beats.length);
    // A single Rhino villain phase places threat once in step one.
    expect(perStep[0]).toBeLessThanOrEqual(3);
  });

  /**
   * Regression: the engine hands over round 1's whole villain phase *and*
   * `roundStarted(2)` in one command, so reading the last round seen — or
   * `state.round`, which has already moved on — labelled the screen "Round 2"
   * while it narrated round 1. Caught in the browser, not in a unit test, which
   * is why the assertion is against a real game rather than a crafted stream.
   */
  test("labels the phase with the round it belongs to, not the round that follows it", () => {
    expect(played.walkthrough.round).toBe(1);
    // The phase ran to its end, so the next round really had begun by now:
    // the label is frozen deliberately, not merely stale.
    expect(played.walkthrough.complete).toBe(true);
    expect(played.state.round).toBe(2);
  });

  test("beat ids are unique, so the screen can key and animate them", () => {
    const ids = played.walkthrough.steps.flatMap((step) => step.beats.map((beat) => beat.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("marks the phase complete once the engine leaves it", () => {
    expect(played.walkthrough.complete).toBe(true);
    expect(played.walkthrough.steps.every((step) => step.status === "done")).toBe(true);
  });

  test("every pause it does record is labeled in the design's words", () => {
    // A given villain phase need not pause at all — in this Rhino game the
    // hero is in alter-ego form, so Rhino schemes and nobody declares a
    // defender. What must hold is that any pause is labeled, and that pauses
    // from the player phase (the end-of-phase discard) never appear here.
    for (const label of played.pauses) {
      expect(label).toMatch(/^Auto-advance paused/);
    }
  });
});

describe("a villain phase that really does pause", () => {
  /**
   * Klaw with two seats parks a trigger window inside the phase, so this
   * exercises the whole path: the engine emits `choiceRequested` mid-command,
   * the walkthrough stops on it, and the beat carries the rule that put it
   * there. `pauseFor`'s own cases are unit-tested below.
   */
  test("stops on the engine's choice and attaches it to the step it happened in", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "klaw",
      difficulty: "standard",
      players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
      seed: 77,
    });
    const viewer = store.state.game!.players[0]!.playerId;
    let walkthrough = emptyWalkthrough(store.state.game!.round);
    let paused: { step: number; promptKind: string; authority: string; label: string; offer: string } | null = null;

    for (let step = 0; step < 60 && !store.state.game!.outcome && !paused; step++) {
      const legal = store.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      } else if (legal.actions.kind === "turn") {
        const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
        if (!end) break;
        await store.dispatch(end.example);
      } else break;

      walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer, POOL_DEPS);
      for (const view of walkthrough.steps) {
        for (const beat of view.beats) {
          if (beat.pause && !paused) {
            paused = {
              step: view.number,
              promptKind: beat.pause.promptKind,
              authority: beat.pause.authority,
              label: beat.pause.label,
              offer: beat.pause.offer,
            };
          }
        }
      }
    }

    expect(paused, "no villain-phase choice was reached in 60 commands").not.toBeNull();
    expect(paused!.step).toBeGreaterThanOrEqual(1);
    expect(paused!.step).toBeLessThanOrEqual(5);
    expect(paused!.promptKind.length).toBeGreaterThan(0);
    expect(["player", "firstPlayerTargets", "firstPlayerOrders"]).toContain(paused!.authority);
    expect(paused!.label).toMatch(/^Auto-advance paused/);
    // Whatever this decision is, the pause says what it's actually offering,
    // not just who has to make it (PLAN.md, "player actions during the
    // villain phase need the same card visibility").
    expect(paused!.offer.length).toBeGreaterThan(0);
  }, 60_000);
});

describe("a defended attack", () => {
  /**
   * Regression for the other reported gap: the player needs to see what a
   * defence actually did, not just that the villain attacked. Flipping to
   * hero form before ending the first turn puts Spider-Man in the way of
   * Rhino's attack (RRG "Activation": a villain attacks a player in hero
   * form) instead of Rhino scheming against alter-ego, and declaring the
   * identity as defender (rather than the "decline" option every other test
   * in this file picks) is what actually produces `attackResolved`.
   */
  async function playThroughDefendedAttack(): Promise<{ walkthrough: Walkthrough }> {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const viewer = store.state.game!.players[0]!.playerId;

    let walkthrough = emptyWalkthrough(store.state.game!.round);
    let changedForm = false;
    let sawVillainPhase = false;

    for (let step = 0; step < 80 && !store.state.game!.outcome; step++) {
      const legal = store.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        const declare =
          choice.prompt.kind === "declareDefender" ? choice.options.find((o) => o.optionId !== "decline") : null;
        await store.resolveChoice(
          declare ? [declare.optionId] : choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
        );
      } else if (legal.actions.kind === "turn") {
        if (!changedForm) {
          const toHero = legal.actions.legal.find((entry) => entry.action.kind === "changeForm");
          changedForm = true;
          if (toHero) {
            await store.dispatch(toHero.example);
            continue;
          }
        }
        const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
        if (!end) break;
        await store.dispatch(end.example);
      } else break;

      walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer, POOL_DEPS);
      if (walkthrough.activeStep !== null) sawVillainPhase = true;
      if (sawVillainPhase && walkthrough.complete) break;
    }

    return { walkthrough };
  }

  test("shows the attack's numbers and the damage they produced", async () => {
    const { walkthrough } = await playThroughDefendedAttack();
    const beats = walkthrough.steps.flatMap((step) => step.beats.map((beat) => beat.text));

    const resolved = beats.find((text) => text.startsWith("Rhino hit "));
    expect(resolved, `no attackResolved beat in: ${JSON.stringify(beats)}`).toBeDefined();
    const match = resolved!.match(/^Rhino hit .+ for (\d+) \(ATK \d+ \+ \d+ boost − \d+ defense\)\.$/);
    expect(match, resolved).not.toBeNull();

    // The defended beat comes first, then the attack's own numbers — the
    // whole point of "know what the result of my defense is."
    expect(beats.indexOf(resolved!)).toBeGreaterThan(beats.findIndex((text) => text.endsWith("defends.")));

    // A full defense can reduce the hit to 0, and the engine emits no
    // separate `damageDealt` for a 0-amount hit — so the beat's own "for 0"
    // is the only place that outcome shows up, and this asserts it's not
    // silently contradicted by a nonzero damage line appearing instead.
    const damageDealt = Number(match![1]);
    const tookLine = beats.slice(beats.indexOf(resolved!)).find((text) => /took \d+ damage\.$/.test(text));
    if (damageDealt > 0) {
      expect(tookLine, `expected a "took ${damageDealt} damage" beat after: ${resolved}`).toBeDefined();
      expect(tookLine).toContain(`took ${damageDealt} damage`);
    } else {
      expect(tookLine).toBeUndefined();
    }
  }, 60_000);

  /**
   * The structured breakdown ("happening now" reads numbers, not just prose)
   * has to agree with the very same beat's own text — both come from
   * `attackResolved`, so they can never say two different things.
   */
  test("the resolved beat's own activation snapshot carries the same numbers as its text", async () => {
    const { walkthrough } = await playThroughDefendedAttack();
    const allBeats = walkthrough.steps.flatMap((step) => step.beats);
    const resolvedBeat = allBeats.find((beat) => beat.text.startsWith("Rhino hit "));
    expect(resolvedBeat).toBeDefined();

    const activation = resolvedBeat!.activation;
    expect(activation?.kind).toBe("attack");
    if (activation?.kind !== "attack") return;
    expect(activation.resolved).not.toBeNull();

    const match = resolvedBeat!.text.match(/for (\d+) \(ATK (\d+) \+ (\d+) boost − (\d+) defense\)/);
    expect(match).not.toBeNull();
    expect(activation.resolved).toEqual({
      targetInstanceId: activation.resolved!.targetInstanceId,
      baseAtk: Number(match![2]),
      boostIcons: Number(match![3]),
      defenseReduction: Number(match![4]),
      damageDealt: Number(match![1]),
    });
    // A defender was declared for this attack (not declined) — Spider-Man's
    // own identity, since this test's whole point is a basic defense.
    expect(activation.defender).toEqual({ instanceId: activation.defender?.instanceId, declined: false });
    expect(activation.defender?.instanceId).not.toBeNull();
  }, 60_000);
});

describe("pauseFor", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  // A real declareDefender needs a real `attack` (`offerFor` reads it to name
  // the enemy and target); every other prompt kind here only cares about `kind`.
  const choice = (
    authority: "player" | "firstPlayerTargets" | "firstPlayerOrders",
    kind = "chooseTarget",
    soleDecider = false,
    options: readonly ChoiceOption[] = [],
  ) => ({
    playerId: played.viewer,
    prompt: (kind === "declareDefender"
      ? {
          kind,
          attack: {
            enemyInstanceId: activeVillain(played.state).instanceId,
            targetPlayerId: played.viewer,
            targetCharacterInstanceId: played.state.players[0]!.identity.instanceId,
          },
        }
      : { kind }) as ChoicePrompt,
    authority,
    soleDecider,
    options,
  });

  test("names the rule that made this player the decider", () => {
    expect(pauseFor(choice("firstPlayerTargets"), played.state, played.viewer).label).toContain(
      "as first player, you pick the target",
    );
    expect(pauseFor(choice("firstPlayerOrders"), played.state, played.viewer).label).toContain("order these effects");
    expect(pauseFor(choice("player"), played.state, played.viewer).label).toBe(
      "Auto-advance paused for your interrupt",
    );
  });

  test("addresses another seat by name rather than in the second person", () => {
    const other = "player-does-not-exist" as PlayerId;
    const pause = pauseFor({ ...choice("firstPlayerTargets"), playerId: other }, played.state, played.viewer);

    expect(pause.label).not.toContain("you");
    expect(pause.playerId).toBe(other);
  });

  test("a defend prompt says so instead of calling it an interrupt", () => {
    expect(pauseFor(choice("player", "declareDefender"), played.state, played.viewer).label).toContain(
      "declare your defender",
    );
  });

  test("offer names the attack a defend prompt is about, not just that one exists", () => {
    const pause = pauseFor(
      choice("player", "declareDefender", false, [{ optionId: "decline", label: "No defense", ref: { kind: "none" } }]),
      played.state,
      played.viewer,
    );

    expect(pause.offer).toContain("Rhino");
    expect(pause.offer).toContain("Options: No defense");
  });

  test("offer lists what a non-defend prompt is actually offering", () => {
    const pause = pauseFor(
      choice("player", "chooseTriggers", false, [
        { optionId: "a", label: "Web-Shooter", ref: { kind: "none" } },
        { optionId: "b", label: "Spider-Tracer", ref: { kind: "none" } },
      ]),
      played.state,
      played.viewer,
    );

    expect(pause.offer).toBe("Options: Web-Shooter, Spider-Tracer.");
  });

  test("offer caps a long option list rather than running the panel off the screen", () => {
    const options = Array.from({ length: 7 }, (_u, i) => ({
      optionId: `o${i}`,
      label: `Card ${i}`,
      ref: { kind: "none" } as const,
    }));
    const pause = pauseFor(choice("player", "chooseTarget", false, options), played.state, played.viewer);

    expect(pause.offer).toBe("Options: Card 0, Card 1, Card 2, Card 3 (+3 more).");
  });

  test("offer is blank rather than a stray label when the engine parked no options", () => {
    expect(pauseFor(choice("player", "mulligan"), played.state, played.viewer).offer).toBe("");
  });

  test("Peril says only that player may decide", () => {
    const pause = pauseFor(choice("player", "chooseTarget", true), played.state, played.viewer);

    expect(pause.soleDecider).toBe(true);
    expect(pause.label).toContain("Peril — only");
  });
});

describe("decisionLabel", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  const choice = (authority: "player" | "firstPlayerTargets" | "firstPlayerOrders", kind = "chooseTarget") => ({
    playerId: played.viewer,
    prompt: { kind } as ChoicePrompt,
    authority,
    soleDecider: false,
    options: [] as ChoiceOption[],
  });

  test("never says 'auto-advance' — that wording belongs to the villain-phase screen", () => {
    // The overlay can be open during setup or a player turn, where nothing is
    // auto-advancing; calling a mulligan an "interrupt" was a real bug.
    for (const authority of ["player", "firstPlayerTargets", "firstPlayerOrders"] as const) {
      expect(decisionLabel(choice(authority), played.state, played.viewer)).not.toMatch(/auto-advance/i);
    }
    expect(decisionLabel(choice("player", "mulligan"), played.state, played.viewer)).toBe("Your decision");
  });

  test("still names the rule that made this player the decider", () => {
    expect(decisionLabel(choice("firstPlayerTargets"), played.state, played.viewer)).toBe(
      "As first player, you pick the target",
    );
    expect(decisionLabel(choice("firstPlayerOrders"), played.state, played.viewer)).toBe(
      "As first player, you order these effects",
    );
    expect(decisionLabel(choice("player", "declareDefender"), played.state, played.viewer)).toBe(
      "Declare your defender",
    );
  });

  test("addresses another seat in the third person", () => {
    const other = "player-nobody" as PlayerId;
    expect(decisionLabel({ ...choice("player"), playerId: other }, played.state, played.viewer)).toMatch(/decides$/);
  });
});

describe("inlineInterruptFor", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  const villainId = () => activeVillain(played.state).instanceId;

  const triggersChoice = (playerId: PlayerId, options: readonly ChoiceOption[]): PendingChoice => ({
    choiceId: "c1" as never,
    playerId,
    prompt: { kind: "chooseTriggers", event: { kind: "enemyAttack" } as never, timing: "response" as never },
    minSelections: 0,
    maxSelections: options.length,
    options,
    frameId: null,
    ordered: true,
    soleDecider: false,
    authority: "player",
  });

  test("offers the viewer's own card, by instance, when one is legal to play", () => {
    const options = inlineInterruptFor(
      triggersChoice(played.viewer, [
        {
          optionId: "x:ability-1",
          label: "Energy Barrier",
          ref: { kind: "ability", instanceId: villainId(), abilityId: "ability-1" as never },
        },
      ]),
      played.viewer,
    );

    expect(options).toEqual([{ optionId: "x:ability-1", instanceId: villainId(), abilityId: "ability-1" }]);
  });

  test("null when the choice is not the viewer's own — never offers to play another seat's card", () => {
    const other = "player-not-viewer" as PlayerId;
    const options = inlineInterruptFor(
      triggersChoice(other, [
        {
          optionId: "x:ability-1",
          label: "Energy Barrier",
          ref: { kind: "ability", instanceId: villainId(), abilityId: "ability-1" as never },
        },
      ]),
      played.viewer,
    );

    expect(options).toBeNull();
  });

  test("a card in hand is played; an ability on a card in play is used, by its printed name", () => {
    const player = played.state.players.find((seat) => seat.playerId === played.viewer)!;
    const handCard = player.hand[0]!;
    expect(interruptActionLabel(played.state, { optionId: "h", instanceId: handCard, abilityId: null })).toMatch(
      /^Play /,
    );

    // Spider-Man's identity is in play, never in hand: "Play Spider-Man" names something the player cannot do.
    const identity = player.identity.instanceId;
    const refs = activeAbilityRefs(played.state, identity);
    const named = refs.find((ref) => ref.label);
    const label = interruptActionLabel(played.state, {
      optionId: "i",
      instanceId: identity,
      abilityId: named?.id ?? null,
    });
    expect(label).toBe(named?.label ? `Use ${named.label}` : "Use Spider-Man");
    expect(label).not.toMatch(/^Play /);
  });

  test("null when there is nothing legal to interrupt with — the window is real but empty", () => {
    expect(inlineInterruptFor(triggersChoice(played.viewer, []), played.viewer)).toBeNull();
  });

  test("null for every prompt kind but chooseTriggers — a defend or an ordering has no 'let it resolve'", () => {
    const declare: PendingChoice = {
      ...triggersChoice(played.viewer, [{ optionId: "decline", label: "No defense", ref: { kind: "none" } }]),
      prompt: {
        kind: "declareDefender",
        attack: { enemyInstanceId: villainId(), targetPlayerId: played.viewer, targetCharacterInstanceId: villainId() },
      },
    };
    expect(inlineInterruptFor(declare, played.viewer)).toBeNull();
  });
});
