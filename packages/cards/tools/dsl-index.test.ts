/**
 * What can the ability DSL express, and what is it called?
 *
 *   pnpm dsl                     every builder, grouped by module
 *   MC_DSL=trait pnpm dsl        only builders whose name or doc mentions "trait"
 *   MC_DSL="ready exhaust" pnpm dsl
 *
 * Step 3 of scripting a card is "find the primitive that expresses this sentence", and there are 260-odd
 * builders over the engine's `EffectSpec` / `ValueSpec` / `TargetQuery` / `RuleSpec` vocabulary. Done by hand
 * that step is grep-the-engine-and-hope: expensive in tokens and non-deterministic, because what you find
 * depends on which word you happened to guess. Searching names *and* doc comments makes it a lookup.
 *
 * Generated from source on every run, so it cannot go stale the way a checked-in index would.
 * See `docs/card-scripting-process.md` §2 step 3.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DSL_DIR = new URL("../src/dsl/", import.meta.url).pathname;

interface Builder {
  readonly module: string;
  readonly name: string;
  readonly signature: string;
  readonly doc: string;
}

/** Strips a JSDoc block to one flowing line. */
const flatten = (block: string): string =>
  block
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*\*ic?\s?/, "")
        .replace(/^\s*\*\s?/, "")
        .trim(),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

function buildersIn(file: string): Builder[] {
  const source = readFileSync(join(DSL_DIR, file), "utf8");
  const out: Builder[] = [];
  // An optional JSDoc block immediately before an exported const/function.
  const re = /(\/\*\*(?:[^*]|\*(?!\/))*\*\/\s*)?^export (?:const|function) ([A-Za-z0-9_]+)\s*(?:=\s*)?(\(?[^\n=]*)/gm;
  for (const m of source.matchAll(re)) {
    const [, docBlock, name, rest] = m;
    if (!name) continue;
    const signature = (rest ?? "")
      .replace(/\s*=>?\s*$/, "")
      .trim()
      .slice(0, 110);
    out.push({ module: file.replace(/\.ts$/, ""), name, signature, doc: docBlock ? flatten(docBlock) : "" });
  }
  return out;
}

describe("DSL index", () => {
  it("lists the ability-DSL builders, optionally filtered", () => {
    const files = readdirSync(DSL_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts");
    const all = files.flatMap((f) => buildersIn(f));

    const terms = (process.env.MC_DSL ?? "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase());
    const matches = (b: Builder) =>
      terms.length === 0 ||
      terms.some(
        (t) =>
          b.name.toLowerCase().includes(t) || b.doc.toLowerCase().includes(t) || b.signature.toLowerCase().includes(t),
      );
    const hits = all.filter(matches);

    const lines: string[] = [""];
    if (terms.length > 0)
      lines.push(`  ${hits.length} of ${all.length} builders match ${terms.map((t) => `"${t}"`).join(" / ")}`, "");
    else lines.push(`  ${all.length} builders across ${files.length} modules. Filter with MC_DSL=<terms>.`, "");

    let currentModule = "";
    for (const b of hits) {
      if (b.module !== currentModule) {
        currentModule = b.module;
        lines.push(`── dsl/${currentModule}.ts`);
      }
      lines.push(`  ${b.name}`);
      if (b.doc) {
        // One wrapped paragraph, indented, capped so a broad search stays readable.
        const doc = b.doc.length > 240 ? `${b.doc.slice(0, 237)}...` : b.doc;
        for (const chunk of doc.match(/.{1,104}(\s|$)/g) ?? []) lines.push(`      ${chunk.trim()}`);
      }
    }
    if (hits.length === 0) lines.push("  (nothing matched — try a broader term, or a rules word from the card text)");
    lines.push("");
    console.log(lines.join("\n"));

    expect(all.length).toBeGreaterThan(100);
  });
});
