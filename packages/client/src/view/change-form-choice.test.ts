/**
 * "Which form?" (Ant-Man's own Tiny/Giant forms, `ant` 12001a/12001c, the same `additionalHeroForms` mechanic
 * docs/phase7-wave2.md §3.2 introduced): the action bar's Change Form button used to dispatch
 * `legal.find(entry => entry.action.kind === "changeForm")` — whichever the engine happened to list first — so a
 * three-sided identity's player could never pick which other form to become. This is the fix: every legal
 * `changeForm` entry, labeled.
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { POOL_DEPS } from "../content/pool.js";
import { formEntries, formSources, needsFormChoice } from "./change-form-choice.js";

const ANT_MAN_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "ant-leadership" }],
  seed: 1,
};

describe("formEntries / formSources / needsFormChoice", () => {
  test("a three-sided identity in alter-ego form offers a changeForm entry per hero face, each labeled", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(ANT_MAN_SOLO);
    for (let step = 0; step < 10; step++) {
      const pending = store.state.legal;
      if (!pending || pending.actions.kind !== "choice") break;
      const { choice } = pending.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    const legal = store.state.legal?.actions;
    const entries = formEntries(legal);
    // Scott Lang (alter-ego) can become either hero face: small Ant-Man (hero index 0) or Giant (additionalHeroForms[0]).
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(needsFormChoice(entries)).toBe(true);
    const sources = formSources(store.state.game!, entries, POOL_DEPS);
    expect(sources).toHaveLength(entries.length);
    for (const source of sources) expect(source.label.length).toBeGreaterThan(0);
    // Ant-Man's own small and Giant hero faces both print "Ant-Man" as their faceName — every label must still be
    // distinct, or the two buttons would be unpickable.
    expect(new Set(sources.map((source) => source.label)).size).toBe(sources.length);
  });

  test('formEntries is empty outside a real turn (no legalActions of kind "turn")', () => {
    expect(formEntries(undefined)).toEqual([]);
    expect(formEntries(null)).toEqual([]);
    expect(formEntries({ kind: "choice" } as never)).toEqual([]);
  });

  test("needsFormChoice is false for the ordinary two-faced identity's single changeForm entry", () => {
    expect(needsFormChoice([])).toBe(false);
    expect(needsFormChoice([{} as never])).toBe(false);
  });
});
