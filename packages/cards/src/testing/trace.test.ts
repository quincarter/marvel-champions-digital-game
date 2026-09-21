import type { AbilityDefinition, EngineDeps } from "@mc/engine";
import { CORE_DEPS } from "../core/index.js";
import { coreScenario } from "../core/setup.js";
import { endTurn, firstLegal, runWith, settle, startCoreGame, toHero } from "./harness.js";
import { expectNotResolved, expectResolved, traceAbilities } from "./trace.js";

const fakeDeps = (ids: readonly string[]): EngineDeps => ({
  abilities: Object.fromEntries(
    ids.map((id) => [
      id,
      { trigger: { kind: "action" }, effects: [{ kind: "drawCards", count: 1 }] } as unknown as AbilityDefinition,
    ]),
  ),
});

describe("traceAbilities", () => {
  it("separates 'looked up' from 'effects actually ran'", () => {
    const { deps, trace } = traceAbilities(fakeDeps(["a.one", "b.two"]));

    // What legality enumeration does: read `.trigger` on every ability it might offer.
    void deps.abilities["a.one"]?.trigger;
    void deps.abilities["b.two"]?.trigger;
    expect(trace.considered()).toEqual(new Set(["a.one", "b.two"]));
    expect(trace.resolved()).toEqual(new Set());

    // What `resolve/ability.ts` does when the ability actually fires: read `.effects`.
    void deps.abilities["b.two"]?.effects;
    expect(trace.resolved()).toEqual(new Set(["b.two"]));
  });

  it("returns definitions that behave identically, and the same object each lookup", () => {
    const { deps } = traceAbilities(fakeDeps(["a.one"]));
    const first = deps.abilities["a.one"];
    expect(first).toBe(deps.abilities["a.one"]);
    expect(first?.effects).toEqual([{ kind: "drawCards", count: 1 }]);
    expect(deps.abilities["nope.missing"]).toBeUndefined();
    expect(Object.keys(deps.abilities)).toEqual(["a.one"]);
  });

  it("reset() scopes a trace to the commands that follow it", () => {
    const { deps, trace } = traceAbilities(fakeDeps(["a.one", "b.two"]));
    void deps.abilities["a.one"]?.effects;
    trace.reset();
    expect(trace.resolved()).toEqual(new Set());
    void deps.abilities["b.two"]?.effects;
    expect(trace.resolved()).toEqual(new Set(["b.two"]));
  });
});

describe("expectResolved, against a real game", () => {
  // Seed-pinned: Spider-Man (Justice) vs Rhino, solo, one full round. Under seed 11 the villain phase reveals
  // 01166 and 01190, and Spider-Sense is *offered* as an interrupt (`firstLegal` declines it) without firing.
  // That pair is the whole point of the helper: offered is not fired.
  const oneRound = () => {
    const start = startCoreGame(
      coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 }),
    );
    const { deps, trace } = traceAbilities(CORE_DEPS);
    trace.reset();
    settle(runWith(deps, start, toHero(), endTurn()), firstLegal, undefined, deps);
    return trace;
  };

  it("passes for an ability whose effects actually ran", () => {
    expect(() => expectResolved(oneRound(), "01166.when-revealed")).not.toThrow();
  });

  it("fails for an ability that was offered but never fired, and says so", () => {
    const trace = oneRound();
    expect(trace.considered()).toContain("01001a.spider-sense");
    expect(() => expectResolved(trace, "01001a.spider-sense")).toThrow(
      /offered as a legal action or checked for a trigger/,
    );
  });

  it("fails differently for an ability whose card never reached play", () => {
    // Thor's kit is not in this scenario at all, so nothing ever looks it up.
    expect(() => expectResolved(oneRound(), "06001a.god-of-thunder")).toThrow(/never looked up at all/);
  });

  it("expectNotResolved is the mirror", () => {
    const trace = oneRound();
    expect(() => expectNotResolved(trace, "01001a.spider-sense")).not.toThrow();
    expect(() => expectNotResolved(trace, "01166.when-revealed")).toThrow(/not to resolve, but it did/);
  });
});
