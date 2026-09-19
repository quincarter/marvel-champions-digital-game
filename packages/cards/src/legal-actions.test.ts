import {
  applyCommand,
  createGame,
  legalActions,
  paymentFor,
  tryPayment,
  type ActionRef,
  type Command,
  type GameSetupConfig,
  type InstanceId,
  type LegalAction,
  type PaymentContext,
} from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { P1, moveToHand, payWith, play, playerOf, run, startCoreGame, toHero } from "./testing/harness.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * `legalActions` against real Core games. The greedy driver finds its moves
 * independently, by trying commands against `applyCommand`. So at every
 * player-turn state:
 * - every command the driver actually issued must be listed as legal, with its target;
 * - every listed action's example command must be accepted.
 */

/** Does `command` fall under `entry` (same action, and its target is one of the legal ones)? */
function covers(entry: LegalAction, command: Command): boolean {
  const action = entry.action;
  switch (command.type) {
    case "playCard": {
      if (action.kind !== "playCard" || action.instanceId !== command.cardInstanceId) return false;
      if (command.attachToInstanceId !== null && !entry.targets.includes(command.attachToInstanceId)) return false;
      const picks = Object.entries(command.costChoices ?? {}).filter(([slot]) => slot !== "discard").flatMap(([, ids]) => ids);
      return picks.every((id) => entry.targets.includes(id));
    }
    case "useAbility":
      return action.kind === "useAbility" && action.instanceId === command.cardInstanceId && action.abilityId === command.abilityId;
    case "basicAttack":
      return action.kind === "basicAttack" && action.instanceId === command.attackerInstanceId && entry.targets.includes(command.targetInstanceId);
    case "basicThwart":
      return action.kind === "basicThwart" && action.instanceId === command.thwarterInstanceId && entry.targets.includes(command.schemeInstanceId);
    case "basicRecover":
    case "changeForm":
    case "endTurn":
      return action.kind === command.type;
    // Neither is a turn action `legalActions` lists: a choice is answered, and conceding is always available.
    case "resolveChoice":
    case "concede":
      return false;
  }
}

const GAMES: readonly [string, GameSetupConfig][] = [
  ["Rhino, solo", coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 })],
  ["Klaw, 2 players", coreScenario("klaw", { players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }], seed: 77 })],
  [
    "Ultron, 4 players",
    coreScenario("ultron", {
      players: ["core-captain-marvel-leadership", "core-iron-man-aggression", "core-black-panther-protection", "core-spider-man-justice"].map((starterDeckId) => ({ starterDeckId })),
      seed: 1138,
    }),
  ],
];

describe("legalActions on real Core games", () => {
  for (const [label, config] of GAMES) {
    it(`${label}: every driver move is listed as legal, and every listed example is accepted`, () => {
      const created = createGame(config, CORE_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const { session } = playToOutcome(created.state, CORE_DEPS);
      let state = session.log.initialState;
      let checked = 0;
      let slowest = 0;
      for (const command of session.log.commands) {
        if (command.type !== "resolveChoice") {
          const started = performance.now();
          const result = legalActions(state, command.playerId, CORE_DEPS);
          slowest = Math.max(slowest, performance.now() - started);
          expect(result.kind).toBe("turn");
          if (result.kind === "turn") {
            const listed = result.legal.some((entry) => covers(entry, command));
            if (!listed) throw new Error(`${command.type} was accepted but not listed as legal: ${JSON.stringify(command)}`);
            for (const entry of result.legal) {
              const accepted = applyCommand(state, entry.example, CORE_DEPS);
              if (!accepted.ok) throw new Error(`example for ${JSON.stringify(entry.action)} rejected: ${accepted.error.message}`);
            }
            checked++;
          }
        }
        const next = applyCommand(state, command, CORE_DEPS);
        if (!next.ok) throw new Error(next.error.message);
        state = next.state;
      }
      console.info(`[legalActions] ${label}: ${checked} turn states checked, slowest call ${slowest.toFixed(1)} ms`);
      expect(checked).toBeGreaterThan(0);
    }, 180_000);
  }
});

/** The picks `entry.example` already made, so the payment query prices the same variant. */
function contextOf(entry: LegalAction): PaymentContext {
  const example = entry.example;
  if (example.type !== "playCard") return {};
  const picks = Object.entries(example.costChoices ?? {})
    .filter(([slot]) => slot !== "discard")
    .flatMap(([, ids]) => ids);
  return {
    target: example.attachToInstanceId ?? picks[0] ?? null,
    ...(example.controllerId ? { controllerId: example.controllerId } : {}),
    ...(example.costChoices ? { costChoices: example.costChoices } : {}),
  };
}

const optionIdsOf = (entry: LegalAction): readonly string[] =>
  entry.example.type === "playCard" || entry.example.type === "useAbility"
    ? entry.example.payment.map((p) => ("fromHand" in p ? `hand:${p.fromHand}` : `ability:${p.ability.instanceId}:${p.ability.abilityId}`))
    : [];

const spiderManVsRhino = () => startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 }));
const playCardAction = (instanceId: InstanceId): ActionRef => ({ kind: "playCard", instanceId });

describe("paymentFor / tryPayment on real Core cards", () => {
  it("lists every payable source, never the card being paid for, and prices The Power of Justice by what it really generates", () => {
    const given = moveToHand(spiderManVsRhino(), P1, "01060", "01062", "01087"); // For Justice!, The Power of Justice, Haymaker
    const [forJustice, powerOfJustice, haymaker] = given.ids as [InstanceId, InstanceId, InstanceId];
    const hero = run(given.state, toHero());

    const query = paymentFor(hero, P1, playCardAction(forJustice), {}, CORE_DEPS);
    if (!query) throw new Error("For Justice! costs 2, so it has a payment step");
    expect(query.requirement).toEqual({ generic: 2, physical: 0, mental: 0, energy: 0 });
    expect(query.sources.map((source) => source.instanceId)).not.toContain(forJustice);
    expect(query.sources.map((source) => source.instanceId).sort()).toEqual(
      playerOf(hero, P1).hand.filter((id) => id !== forJustice).sort(),
    );
    // "Double the number of resources this card generates while paying for a Justice card."
    const doubled = query.sources.find((source) => source.instanceId === powerOfJustice);
    expect(doubled).toMatchObject({ kind: "handCard", label: "The Power of Justice", pool: { wild: 2 } });
    expect(query.sources.find((source) => source.instanceId === haymaker)?.pool).toEqual({ physical: 0, mental: 0, energy: 1, wild: 0 });

    const accepted = tryPayment(hero, P1, playCardAction(forJustice), query.suggested, {}, CORE_DEPS);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(applyCommand(hero, accepted.command, CORE_DEPS).ok).toBe(true);

    // The same card is worth 1 toward a basic card, and the engine says so.
    const basic = paymentFor(hero, P1, playCardAction(haymaker), {}, CORE_DEPS);
    expect(basic?.sources.find((source) => source.instanceId === powerOfJustice)?.pool).toEqual({ physical: 0, mental: 0, energy: 0, wild: 1 });
    const short = tryPayment(hero, P1, playCardAction(haymaker), [`hand:${powerOfJustice}`], {}, CORE_DEPS);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe("insufficient_resources");
  });

  it("Web-Shooter's Resource ability is a source, and the engine spends it before any card in hand", () => {
    const given = moveToHand(spiderManVsRhino(), P1, "01008", "01002"); // Web-Shooter, Black Cat
    const [shooter, blackCat] = given.ids as [InstanceId, InstanceId];
    const hero = run(given.state, toHero());
    const withShooter = run(hero, play(P1, shooter, payWith(hero, P1, 1, given.ids)));
    const optionId = `ability:${shooter}:01008.web-shooter-resource`;

    const query = paymentFor(withShooter, P1, playCardAction(blackCat), {}, CORE_DEPS);
    const source = query?.sources.find((candidate) => candidate.optionId === optionId);
    expect(source).toMatchObject({ kind: "resourceAbility", instanceId: shooter, label: "Web-Shooter" });
    // "Resource: ... generate a wild resource" — the ability's own `generates`, not the card's printed [physical].
    expect(source?.pool).toEqual({ physical: 0, mental: 0, energy: 0, wild: 1 });
    expect(query?.suggested[0]).toBe(optionId);
    expect(tryPayment(withShooter, P1, playCardAction(blackCat), query?.suggested ?? [], {}, CORE_DEPS).ok).toBe(true);
  });

  it("a card that costs nothing has no payment step", () => {
    const leadership = startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-captain-marvel-leadership" }], seed: 5 }));
    const given = moveToHand(leadership, P1, "01069"); // Get Ready — cost 0, "Action: Ready an ally."
    const [getReady] = given.ids as [InstanceId];
    const hero = run(given.state, toHero());
    expect(paymentFor(hero, P1, playCardAction(getReady), {}, CORE_DEPS)).toBeNull();
    expect(paymentFor(hero, P1, { kind: "basicThwart", instanceId: playerOf(hero, P1).identity.instanceId }, {}, CORE_DEPS)).toBeNull();
    expect(paymentFor(hero, P1, { kind: "endTurn" }, {}, CORE_DEPS)).toBeNull();
  });

  it("Rhino, solo: every payable action the engine lists can be paid for the way the engine itself would", () => {
    const config = coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
    const created = createGame(config, CORE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const { session } = playToOutcome(created.state, CORE_DEPS);
    let state = session.log.initialState;
    let priced = 0;
    let slowest = 0;
    for (const command of session.log.commands) {
      if (command.type !== "resolveChoice") {
        const result = legalActions(state, command.playerId, CORE_DEPS);
        if (result.kind === "turn") {
          for (const entry of result.legal) {
            if (!entry.needsPayment) continue;
            const context = contextOf(entry);
            const started = performance.now();
            const query = paymentFor(state, command.playerId, entry.action, context, CORE_DEPS);
            slowest = Math.max(slowest, performance.now() - started);
            if (!query) throw new Error(`${JSON.stringify(entry.action)} needs payment but has no payment query`);
            // The overlay opens on exactly the payment `example` carries.
            expect(query.suggested).toEqual(optionIdsOf(entry));
            const attempt = tryPayment(state, command.playerId, entry.action, query.suggested, context, CORE_DEPS);
            if (!attempt.ok) throw new Error(`suggested payment for ${JSON.stringify(entry.action)} rejected: ${attempt.message}`);
            expect(attempt.command).toEqual(entry.example);
            priced++;
          }
        }
      }
      const next = applyCommand(state, command, CORE_DEPS);
      if (!next.ok) throw new Error(next.error.message);
      state = next.state;
    }
    console.info(`[paymentFor] Rhino, solo: ${priced} payable actions priced, slowest call ${slowest.toFixed(1)} ms`);
    expect(priced).toBeGreaterThan(0);
  }, 180_000);
});
