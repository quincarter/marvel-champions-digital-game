/**
 * Which ability refs resolve, per pack — the report `coverage.test.ts` tells you to hand-roll.
 *
 * `wave2/coverage.test.ts` instructs future sessions to regenerate `KNOWN_SKIPPED` "the same way (a small
 * throwaway test dumping `allRefs.filter((id) => !(id in WAVE2_ABILITIES))`)", and records that hand-typing
 * that list instead is "exactly how this list drifted from reality the first time it was written". That
 * throwaway has now been written at least six times, once per wave 2 pack. This is it, kept.
 *
 *   pnpm refs                          every pack, summary table
 *   MC_REFS_PACKS=scw pnpm refs        one pack, plus a paste-ready KNOWN_SKIPPED array
 *   MC_REFS_PACKS="scw qsv" pnpm refs  several packs
 *
 * It lives outside `src/` and runs under its own vitest config, so it is not part of `pnpm test` — it
 * asserts nothing about what *should* be unresolved (that is `coverage.test.ts`'s job, and it stays the
 * thing that fails when the pool changes). This only reports what *is*.
 */
import * as content from "@mc/content";
import { allAbilityRefIds } from "../src/ability-refs.js";
import { CORE_ABILITIES } from "../src/core/index.js";
import { WAVE1_ABILITIES } from "../src/wave1/index.js";
import { WAVE2_ABILITIES } from "../src/wave2/index.js";

const REGISTRY: Record<string, unknown> = { ...CORE_ABILITIES, ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

/** Every `<PACK>_CARDS` array `@mc/content` exports, keyed by the lowercase pack code. */
function packsFromContent(): Map<string, readonly content.AnyCard[]> {
  const packs = new Map<string, readonly content.AnyCard[]>();
  for (const [name, value] of Object.entries(content as Record<string, unknown>)) {
    const match = /^([A-Z0-9_]+)_CARDS$/.exec(name);
    if (!match || !Array.isArray(value)) continue;
    const code = match[1]!.toLowerCase();
    // WAVE1_CARDS / WAVE2_CARDS / DATA_ONLY_CARDS are unions of other packs, not packs.
    if (code === "wave1" || code === "wave2" || code === "data_only") continue;
    packs.set(code, value as readonly content.AnyCard[]);
  }
  return packs;
}

interface Row {
  readonly code: string;
  readonly cards: number;
  readonly refs: number;
  readonly unresolved: readonly string[];
}

const rowFor = (code: string, cards: readonly content.AnyCard[]): Row => {
  const refs = allAbilityRefIds(cards);
  return { code, cards: cards.length, refs: refs.length, unresolved: refs.filter((id) => !(id in REGISTRY)) };
};

const pct = (done: number, total: number) => (total === 0 ? "  —  " : `${Math.round((done / total) * 100)}%`.padStart(5));

describe("ability ref coverage report", () => {
  it("reports which refs resolve, per pack", () => {
    const packs = packsFromContent();
    // A vitest worker does not see the CLI's argv, so the filter comes in as an env var.
    const wanted = (process.env.MC_REFS_PACKS ?? "").split(/[,\s]+/).filter((c) => c && packs.has(c.toLowerCase()));
    const selected = wanted.length > 0 ? wanted.map((c) => c.toLowerCase()) : [...packs.keys()].sort();

    const rows = selected.map((code) => rowFor(code, packs.get(code)!));
    const scripted = rows.filter((r) => r.refs > 0 && r.unresolved.length === 0);
    const partial = rows.filter((r) => r.refs > 0 && r.unresolved.length > 0 && r.unresolved.length < r.refs);
    const untouched = rows.filter((r) => r.refs > 0 && r.unresolved.length === r.refs);

    const lines: string[] = ["", "pack        cards   refs  resolved        status"];
    lines.push("".padEnd(52, "-"));
    for (const r of [...rows].sort((a, b) => a.unresolved.length - b.unresolved.length || a.code.localeCompare(b.code))) {
      const done = r.refs - r.unresolved.length;
      const status = r.refs === 0 ? "no abilities" : r.unresolved.length === 0 ? "scripted" : done === 0 ? "not started" : `${r.unresolved.length} unresolved`;
      lines.push(`${r.code.padEnd(11)}${String(r.cards).padStart(5)}${String(r.refs).padStart(7)}${pct(done, r.refs)}  ${status}`);
    }
    const totalRefs = rows.reduce((n, r) => n + r.refs, 0);
    const totalOpen = rows.reduce((n, r) => n + r.unresolved.length, 0);
    lines.push("".padEnd(52, "-"));
    lines.push(`${String(rows.length).padStart(3)} packs${String(rows.reduce((n, r) => n + r.cards, 0)).padStart(9)}${String(totalRefs).padStart(7)}${pct(totalRefs - totalOpen, totalRefs)}  ${totalOpen} unresolved`);
    lines.push(`      ${scripted.length} fully scripted, ${partial.length} in progress, ${untouched.length} not started`);

    // A paste-ready KNOWN_SKIPPED array, but only when the report is narrow enough to be useful.
    for (const r of rows) {
      if (r.unresolved.length === 0 || (wanted.length === 0 && r.unresolved.length > 40)) continue;
      if (wanted.length === 0 && rows.length > 6) continue;
      lines.push("", `  ${r.code}: [`);
      for (const id of r.unresolved) lines.push(`    "${id}",`);
      lines.push("  ],");
    }
    lines.push("");
    console.log(lines.join("\n"));

    expect(rows.length).toBeGreaterThan(0);
  });
});
