import { cardId, encounterSetId, trait } from "@mc/content";
import {
  applyCommand,
  createGame,
  NO_STATUSES,
  replay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  threatOn,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import { playToOutcome } from "../../../testing/driver.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";
import { wave5Scenario } from "../../setup.js";

/**
 * `encounterCardInVillainArea` puts a card straight into `state.villainArea`, which is fine for the constant/boost
 * checks the other modular tests use it for — but the engine's own defeat sweep only walks each *player's* own
 * `playArea` for an ally/minion (`resolve/defeat.ts`'s `checkDefeats`), the same "test surgery: the Decoy engaged
 * with P1" trap `sinister-six/guerrilla-tactics.test.ts` already documents. Common Criminal's own Alter-Ego Action
 * needs a real defeat check, so this moves it into `player`'s play area engaged with them first, the way a real
 * reveal/boost would.
 */
function engagedMinion(
  state: GameState,
  code: string,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterCardInVillainArea(state, code);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
      instances: { ...placed.state.instances, [placed.id]: { ...inst(placed.state, placed.id), engagedWith: player } },
    },
  };
}

/**
 * Down to Earth (`sm` 27131/27133/27134, `down-to-earth.ts`, docs/phase7-wave5.md §2.2). A plain `ghostSpiderScenario`
 * game (Ghost-Spider's own precon, alter-ego "Gwen Stacy" prints the CIVILIAN trait and REC 3, `sm` 27001a) with this
 * modular swapped in in place of the scenario's own recommended set, `sandman/scenario.test.ts`'s own
 * `modularSetIds: [encounterSetId("bomb_scare")]` stand-in precedent.
 *
 * **Loose Ends (27135) is not scripted here** — see this module's own docblock in `down-to-earth.ts` and the e2e
 * game below, which drops it from the built encounter deck for exactly that reason.
 */
const game = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("sandman", { seed, modularSetIds: [encounterSetId("down_to_earth")] }));

const basicThwart = (state: GameState, scheme: InstanceId, player = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(state, player),
  schemeInstanceId: scheme,
});

/** Picks `label` in a `chooseOption`/`chooseTarget`-by-name prompt, recording what was offered; else `firstLegal`. */
const pickOption =
  (label: string): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const match = choice.options.find((o) => o.label === label);
      if (match) return [match.optionId];
    }
    return firstLegal(s);
  };

describe("Common Criminal (27131)", () => {
  it("27131.common-criminal-constant: spends a [physical] resource to deal 3 damage, defeating it (3 HP); offers draw or remove threat", () => {
    const state = game();
    const placed = engagedMinion(state, "27131");
    const paid = moveToHand(placed.state, P1, "27022"); // Strength: producesIcons.physical 2
    const [strength] = paid.ids;
    const handBefore = playerOf(paid.state, P1).hand.length;

    const drawn = settle(
      runWave5(paid.state, use(P1, placed.id, "27131.common-criminal-constant", [{ fromHand: strength! }])),
      pickOption("Draw 1 card"),
      undefined,
      WAVE5_DEPS,
    );
    // Leaving play resets damage (RRG 1.8 "Leaving Play", p. 27) — the proof of defeat is that it left P1's play area.
    expect(playerOf(drawn, P1).playArea).not.toContain(placed.id);
    // Strength itself left the hand to pay; the "draw 1 card" branch replaces it.
    expect(playerOf(drawn, P1).hand.length).toBe(handBefore - 1 + 1);
  });

  it("27131.common-criminal-constant: the other branch removes 3 threat from a chosen side scheme", () => {
    const state = game();
    const placed = engagedMinion(state, "27131");
    const side = encounterCardInVillainArea(placed.state, "27133", 4); // Volunteer Work, 4 threat
    const paid = moveToHand(side.state, P1, "27022");
    const [strength] = paid.ids;

    const offered: InstanceId[] = [];
    const choosing: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") {
        const match = choice.options.find((o) => o.label.startsWith("Remove 3 threat"));
        if (match) return [match.optionId];
      }
      if (choice?.prompt.kind === "chooseTarget") {
        const cards = choice.options.flatMap((o) => (o.ref.kind === "card" ? [o] : []));
        offered.push(...cards.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : ("" as InstanceId))));
        const hit = cards.find((o) => o.ref.kind === "card" && o.ref.instanceId === side.id);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };
    const resolved = settle(
      runWave5(paid.state, use(P1, placed.id, "27131.common-criminal-constant", [{ fromHand: strength! }])),
      choosing,
      undefined,
      WAVE5_DEPS,
    );
    expect(offered).toContain(side.id);
    expect(threatOn(resolved, side.id)).toBe(1);
  });

  it("27131.common-criminal-constant: a Tough Common Criminal absorbs the 3 damage — not defeated, no choice offered", () => {
    const state = game();
    const placed = engagedMinion(state, "27131");
    const tough = patchInstance(placed.state, placed.id, { statuses: { ...NO_STATUSES, tough: 1 } });
    const paid = moveToHand(tough, P1, "27022");
    const [strength] = paid.ids;
    const before = playerOf(paid.state, P1).hand.length;

    const resolved = settle(
      runWave5(paid.state, use(P1, placed.id, "27131.common-criminal-constant", [{ fromHand: strength! }])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(resolved, placed.id).damage).toBe(0);
    expect(inst(resolved, placed.id).statuses.tough).toBe(0);
    expect(playerOf(resolved, P1).playArea).toContain(placed.id); // still in play, not defeated
    // No "draw 1 card or remove threat" choice fired, so the hand is down only the resource spent to pay.
    expect(playerOf(resolved, P1).hand.length).toBe(before - 1);
  });
});

describe("Volunteer Work (27133)", () => {
  it("27133.volunteer-work-constant: cannot be thwarted, by anyone", () => {
    // Thwarting is a hero-form-only action; Ghost-Spider starts in alter-ego form (`toHero`), so the ban this test
    // actually proves is Volunteer Work's own `cannotThwart`, not "you're in the wrong form to act at all".
    const hero = settle(runWave5(game(), toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const placed = encounterCardInVillainArea(hero, "27133", 4);
    const refused = applyCommand(placed.state, basicThwart(placed.state, placed.id), WAVE5_DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(threatOn(placed.state, placed.id)).toBe(4);
  });

  it("27133.volunteer-work-action: spends 2 resources of any type, removes threat equal to alter-ego REC (Gwen Stacy: 3), and draws 1 card (CIVILIAN)", () => {
    const state = game();
    const placed = encounterCardInVillainArea(state, "27133", 4);
    const paid = moveToHand(placed.state, P1, "27020", "27021"); // Energy + Genius: 2 spendable cards
    const before = playerOf(paid.state, P1).hand.length;

    const resolved = settle(
      runWave5(
        paid.state,
        use(
          P1,
          placed.id,
          "27133.volunteer-work-action",
          paid.ids.map((id) => ({ fromHand: id })),
        ),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(threatOn(resolved, placed.id)).toBe(1); // 4 - REC 3
    // Both resources left to pay, and the CIVILIAN clause draws 1 back.
    expect(playerOf(resolved, P1).hand.length).toBe(before - 2 + 1);
  });

  it("27133.volunteer-work-action: the CIVILIAN draw is a real condition (`ifThen` gate), not unconditional", () => {
    // Every wave 5 precon alter-ego happens to print CIVILIAN (Gwen Stacy, Miles Morales), so this is a registry-
    // level check of the gate itself rather than a live divergent path — `sandman/city-in-chaos.test.ts`'s own
    // "27127.panic-in-the-streets-constant" precedent for a condition no in-repo card can fail live.
    const def = WAVE5_DEPS.abilities["27133.volunteer-work-action"];
    expect(def?.effects).toContainEqual(
      expect.objectContaining({
        kind: "if",
        condition: expect.objectContaining({ kind: "hasTrait", trait: trait("CIVILIAN") }),
      }),
    );
  });
});

describe('"Threat or Menace?" (27134)', () => {
  // A villain phase places its own threat on the main scheme regardless of this card (step 1, plus Sandman's own
  // scheme icon), so — `guerrilla-tactics.test.ts`'s own "27143.boost" precedent — the ability's own marginal
  // contribution is read off the `threatPlaced` events this card's own instance authored (`sourceInstanceId`), not
  // a before/after main-scheme-threat delta over the whole phase.
  const placedByCard = (events: readonly GameEvent[], card: InstanceId, main: InstanceId): number =>
    events
      .filter(
        (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
          e.type === "threatPlaced" && e.sourceInstanceId === card && e.schemeInstanceId === main,
      )
      .reduce((sum, e) => sum + e.amount, 0);

  // Every villain activation (attack or scheme) deals itself a boost card off the top of the deck first
  // (`guerrilla-tactics.test.ts`'s own "absorbs the active villain's own unconditional boost draw" precedent) — one
  // filler covers that alone. A hero-form P1 is additionally attacked (Sand Blast), whose own Surging Sands discards
  // several more cards before the "deal to each player" step ever reaches the deck
  // (`sandman/encounter-set-2.test.ts`'s own `dealPastNaturalAttack` docblock, `sandman/city-in-chaos.test.ts`'s own
  // copy of the filler list) — an alter-ego P1 isn't attacked at all, so only the one boost-card filler is needed.
  const revealIt = (state: GameState, pick: Picker, fillers: readonly string[] = ["01186"]) => {
    const card = instancesOf(state, "27134")[0]!;
    const main = state.mainScheme.instanceId;
    const { state: resolved, events } = driveEventsPicking(
      WAVE5_DEPS,
      stackEncounterDeck(state, ...fillers, "27134"),
      pick,
      endTurn(P1),
    );
    // A sanity check against the false positive this class of test is prone to (`sandman/*` own fixed filler count
    // guessing the reveal timing): if the card was never actually revealed, every "no threat placed" assertion below
    // would trivially (and wrongly) pass.
    expect(events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === card)).toBe(true);
    return { state: resolved, placed: placedByCard(events, card, main) };
  };
  const HERO_FORM_FILLERS = ["01186", "01186", "01187", "01188", "01189", "01190"];

  // A game starts alter-ego (`setup.ts`'s Appendix II default); `toHero`/`changeForm` is a *toggle* with no `to`
  // field (`actions.ts` `changeForm`: `to = player.identity.form === "hero" ? "alterEgo" : "hero"`), so there is no
  // separate "become alter-ego" command — reading it twice from the same starting form is how each branch below gets
  // to the form it wants to start the reveal in.
  const heroForm = (state: GameState) => settle(runWave5(state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);

  it("starting in hero form and declining to change places 2 threat on the main scheme", () => {
    const { placed } = revealIt(heroForm(game()), pickOption("Don't change form"), HERO_FORM_FILLERS);
    expect(placed).toBe(2);
  });

  it("changing from hero to alter-ego avoids the threat — you cannot change form during your next turn instead", () => {
    const { state: resolved, placed } = revealIt(heroForm(game()), pickOption("Change form"), HERO_FORM_FILLERS);
    expect(placed).toBe(0);
    // Next turn, changing to hero form is refused (the `cannotChangeForm` lasting rule).
    const nextTurn = settle(runWave5(resolved, endTurn(P1)), firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const attempted = applyCommand(nextTurn, toHero(P1), WAVE5_DEPS);
    expect(attempted.ok).toBe(false);
  });

  it("starting in alter-ego form (the default) and declining to change also blocks next turn's form change", () => {
    const { state: resolved, placed } = revealIt(game(), pickOption("Don't change form"));
    expect(placed).toBe(0);
    const nextTurn = settle(runWave5(resolved, endTurn(P1)), firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const attempted = applyCommand(nextTurn, toHero(P1), WAVE5_DEPS);
    expect(attempted.ok).toBe(false);
  });

  it("starting in alter-ego form and choosing to change to hero form places the 2 threat instead", () => {
    const { placed } = revealIt(game(), pickOption("Change form"));
    expect(placed).toBe(2);
  });
});

describe("wave5Scenario with Down to Earth swapped in", () => {
  it("Sandman, solo: Ghost-Spider, with Down to Earth in place of the scenario's own recommended modular", () => {
    // Loose Ends (27135) is dropped from the built deck — it has no registered ability yet (this module's own
    // docblock: `search … removed-from-game area … for a copy of your obligation` needs a `CardSelector` this
    // repo's DSL/engine don't have yet), so a seed that happened to reveal it would otherwise crash the game.
    const base = ghostSpiderScenario("sandman", { seed: 2026, modularSetIds: [encounterSetId("down_to_earth")] });
    const config = { ...base, encounterDeck: base.encounterDeck.filter((id) => id !== cardId("27135")) };
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE5_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE5_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  it("also builds via wave5Scenario directly (a Core precon), unaffected by the swap", () => {
    expect(() =>
      wave5Scenario("sandman", {
        seed: 3,
        players: [{ starterDeckId: "core-captain-marvel-leadership" }],
        modularSetIds: [encounterSetId("down_to_earth")],
      }),
    ).not.toThrow();
  });
});
