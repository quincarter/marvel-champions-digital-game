/**
 * Rules-QA 2026-10-04: reveal sweep. Every card of every modular encounter set is revealed, one at a time, in a scenario
 * it was never printed for, in alter-ego form and in hero form: the encounter card is stacked behind the villain's
 * boost card and the player's turn ends, so the villain phase deals it exactly as a game would. A seeded soak reveals
 * a given card in a given scenario by luck; this makes every card meet the host.
 *
 * Asserts, per reveal: nothing throws, every choice the card opens can be answered (`settle` gives up after 300), and the
 * card is revealed (the game may end first, but only by the hero or main scheme: a loss by a card's own text or by
 * running out of encounter cards in the first villain phase is a bug, RRG 1.8 p. 17). Cards that cannot be dealt from the
 * deck (the Milano and the Setup attachments, which start in play) are skipped and counted.
 *
 * Hosts (the scenario the set is added to): Rhino (Core, one villain), Tower Defense (several villains: "the villain" is
 * ambiguous) and The Kang Dynasty's Kang (separate game areas). Default: each set meets one host, rotating; with
 * `QA_MODULAR_FULL=1` every set meets all three.
 */
import { createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { firstLegal, settle } from "./testing/harness.js";
import {
  MODULAR_SETS,
  PLAYABLE_SCENARIOS,
  buildPairing,
  cardsOfSet,
  pairingFor,
  revealOnTurnEnd,
  stackBehindBoost,
} from "./testing/modular-matrix.js";

const FULL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_MODULAR_FULL === "1";
const HOSTS = ["rhino", "tower-defense", "kang"];
const TIMEOUT = 300_000;
/** She-Hulk's 14 hit points in hero form outlast the villain's first activation, so the card is reached. */
const HERO = "core-she-hulk-aggression";

interface Reveal {
  readonly host: string;
  readonly set: string;
  readonly cardId: string;
  readonly name: string;
  readonly form: "hero" | "alterEgo";
  readonly problem?: string;
  readonly reached: boolean;
  readonly outcome: string | null;
}

function sweep(set: string, host: string): { reveals: Reveal[]; skipped: string[] } {
  const scenarioIndex = PLAYABLE_SCENARIOS.findIndex((scenario) => scenario.id === host);
  const scenario = PLAYABLE_SCENARIOS[scenarioIndex]!;
  const reveals: Reveal[] = [];
  const skipped: string[] = [];
  const built = buildPairing(set, scenario, {
    seed: 4000 + scenarioIndex,
    players: [{ starterDeckId: HERO }],
  });
  const config = built.config ?? built.workaround;
  if (!config) return { reveals, skipped: [`${set} does not build in ${host}: ${built.error ?? built.pairing.kind}`] };
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const base = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const seen = new Set<string>();
  for (const card of cardsOfSet(set)) {
    if (seen.has(card.id) || card.type === "villain" || card.type === "main_scheme") continue;
    seen.add(card.id);
    const ids = Object.values(base.instances)
      .filter((instance) => instance.ownerId === null && instance.cardId === card.id)
      .map((instance) => instance.instanceId);
    const id = ids.find((candidate) => stackBehindBoost(base, candidate, 1) !== null);
    if (!id) {
      skipped.push(`${card.id} ${card.name}`);
      continue;
    }
    for (const form of ["alterEgo", "hero"] as const) {
      const record: Reveal = { host, set, cardId: card.id, name: card.name, form, reached: false, outcome: null };
      try {
        const run = revealOnTurnEnd(base, id, { form });
        const reached = run.revealed;
        const outcome = run.state.outcome ? `${run.state.outcome.result}:${run.state.outcome.reason}` : null;
        const bad = outcome === "loss:cardAbility" || outcome === "loss:encounterDeckExhausted";
        reveals.push({
          ...record,
          reached,
          outcome,
          ...(bad
            ? { problem: `the game was lost by ${outcome}` }
            : !reached && !outcome
              ? { problem: "never revealed" }
              : {}),
        });
      } catch (error) {
        reveals.push({ ...record, problem: `threw: ${(error as Error).message.split("\n")[0]}` });
      }
    }
  }
  return { reveals, skipped };
}

const all: Reveal[] = [];
const skippedAll: string[] = [];

describe(`reveal sweep: every modular card in a foreign scenario (${FULL ? "all hosts" : "one host per set; QA_MODULAR_FULL=1 for all"})`, () => {
  const eligible = (set: string, host: string) =>
    pairingFor(
      set,
      PLAYABLE_SCENARIOS.find((scenario) => scenario.id === host)!,
    ).kind === "build";
  MODULAR_SETS.forEach((set, index) => {
    const hosts = FULL ? HOSTS : [HOSTS[index % HOSTS.length]!];
    for (const host of hosts) {
      const chosen = eligible(set.id, host) ? host : HOSTS.find((other) => eligible(set.id, other));
      if (!chosen) continue;
      it(
        `${set.id} in ${chosen}`,
        () => {
          const { reveals, skipped } = sweep(set.id, chosen);
          all.push(...reveals);
          skippedAll.push(...skipped.map((entry) => `${chosen}: ${entry}`));
          const problems = reveals.filter((reveal) => reveal.problem);
          expect(problems.map((r) => `${r.cardId} ${r.name} (${r.form}): ${r.problem}`)).toEqual([]);
        },
        TIMEOUT,
      );
    }
  });
  it("summary", () => {
    console.log(`reveal sweep: ${all.length} reveals, ${skippedAll.length} skipped`, skippedAll);
    expect(all.length).toBeGreaterThan(300);
  });
});
