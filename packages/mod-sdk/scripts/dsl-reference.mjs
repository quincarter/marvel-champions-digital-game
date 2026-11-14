#!/usr/bin/env node
/**
 * Generates the DSL builder index that the creator template ships as docs/dsl-reference-generated.md.
 *
 * It scans packages/cards/src/dsl/{abilities,effects,values,extra-encounter-deck}.ts and prints, for every exported
 * builder, its name, signature and the first sentence of its JSDoc, grouped by the source files' own `// ----`
 * section banners. Nothing is written from memory, so the list is complete for the version of the game it is run in.
 * (A text scanner, not the TypeScript compiler API: the repo's TypeScript 7 has no JS API.)
 *
 *   node packages/mod-sdk/scripts/dsl-reference.mjs [--out <file>] [--version <sdk version>]
 *
 * Regenerate it for each SDK release and copy the file into the template repo's docs/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dslDir = join(here, "..", "..", "cards", "src", "dsl");

const args = process.argv.slice(2);
const argOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const outFile = argOf("--out");
const version =
  argOf("--version") ?? JSON.parse(readFileSync(join(here, "..", "..", "..", "package.json"), "utf8")).version;

const FILES = [
  ["abilities.ts", "Ability shapes, constant abilities, costs, limits and event patterns"],
  ["effects.ts", "Effects"],
  ["values.ts", "Players, targets, queries, values and predicates"],
  ["extra-encounter-deck.ts", "Extra encounter decks"],
];

const squash = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** First sentence of a JSDoc block, without the tags. */
function firstSentence(raw) {
  const text = squash(
    raw
      .replace(/^\/\*\*/, "")
      .replace(/\*\/$/, "")
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, ""))
      .filter((l) => !l.trim().startsWith("@"))
      .join(" "),
  );
  if (!text) return "";
  // The first sentence ends at ". " before a capital letter, skipping abbreviations such as "p." and "e.g.".
  const m = text.match(/^(.+?(?<!\bp)(?<!\bpp)(?<!\be\.g)(?<!\bi\.e)(?<!\bvs)[.!?])(\s+(?=[A-Z"(`])|$)/);
  return clip(m ? m[1] : text, 220);
}

/** The inside of the balanced group that opens at text[start], and the index after it. */
function balanced(text, start) {
  let depth = 0;
  for (let k = start; k < text.length; k++) {
    const c = text[k];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return { inner: text.slice(start + 1, k), end: k + 1 };
    }
  }
  return null;
}

/** A return type: from `start` up to a top-level "=>" (arrows) or "{" (functions). */
function returnType(text, start, stop) {
  let depth = 0;
  for (let k = start; k < text.length; k++) {
    const c = text[k];
    if (c === "=" && text[k + 1] === ">" && depth === 0 && stop === "=>") return squash(text.slice(start, k));
    if (c === "{" && depth === 0 && stop === "{") return squash(text.slice(start, k));
    if (c === "(" || c === "[" || c === "{" || (c === "<" && text[k - 1] !== "=")) depth++;
    else if (c === ")" || c === "]" || c === "}" || (c === ">" && text[k - 1] !== "=")) depth--;
  }
  return "";
}

function entry(sig, doc) {
  const code = clip(sig, 260);
  const fence = code.includes("`") ? "``" : "`";
  return `- ${fence}${code}${fence}${doc ? ` — ${doc.replace(/\|/g, "\\|")}` : ""}`;
}

const out = [];
out.push("# DSL builder index (generated)");
out.push("");
out.push(
  `Generated from the game's \`packages/cards/src/dsl/*.ts\` by \`packages/mod-sdk/scripts/dsl-reference.mjs\` (SDK ${version}). ` +
    "Do not edit by hand: regenerate it with `node packages/mod-sdk/scripts/dsl-reference.mjs --out dsl-reference-generated.md` " +
    "in the game repo. Each entry is `name(signature)` and the first sentence of the builder's doc comment. " +
    "A bare name is a constant (use it as is, without calling it). Types such as `TargetRef`, `Amount` and " +
    "`Predicate` are defined in the game's engine and `values.ts`; the guide `dsl-reference.md` explains the common ones. " +
    "Everything here is importable from `@champions-digital-game/mod-sdk`.",
);
out.push("");

let total = 0;
for (const [file, title] of FILES) {
  const text = readFileSync(join(dslDir, file), "utf8");
  // Section banners: a `// ----` line, then `// Title`.
  const lines = text.split("\n");
  const banners = [];
  let offset = 0;
  const lineStart = lines.map((l) => {
    const s = offset;
    offset += l.length + 1;
    return s;
  });
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\/\/ -{20,}\s*$/.test(lines[i]) && /^\/\/ \S/.test(lines[i + 1]) && !/^\/\/ -{5}/.test(lines[i + 1])) {
      banners.push({ pos: lineStart[i], title: lines[i + 1].replace(/^\/\/ /, "").trim() });
    }
  }
  const sectionAt = (pos) => {
    let t = "Top of file";
    for (const b of banners) if (b.pos <= pos) t = b.title;
    return t;
  };

  const groups = new Map();
  const add = (pos, line) => {
    const key = sectionAt(pos);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
    total++;
  };

  // Each exported declaration starts at column 0; its doc comment is the block directly above.
  const declRe = /^export (const|function) ([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = declRe.exec(text))) {
    const isFunction = m[1] === "function";
    const name = m[2];
    const pos = m.index;
    const before = text.slice(0, pos).trimEnd();
    let doc = "";
    if (before.endsWith("*/")) {
      const start = before.lastIndexOf("/**");
      const lastOpen = before.lastIndexOf("/*", before.length - 3);
      if (start >= 0 && start >= lastOpen) doc = firstSentence(before.slice(start));
    }
    const rest = text.slice(pos + m[0].length);
    let sig;
    if (isFunction) {
      const open = rest.indexOf("(");
      const grp = open >= 0 ? balanced(rest, open) : null;
      const ret = grp && /^\s*:/.test(rest.slice(grp.end)) ? returnType(rest, rest.indexOf(":", grp.end) + 1, "{") : "";
      sig = grp ? `${name}(${squash(grp.inner)})${ret ? `: ${ret}` : ""}` : name;
    } else {
      const eq = rest.indexOf("=");
      const annotation = squash(rest.slice(0, eq)).replace(/^:\s*/, "");
      const after = rest.slice(eq + 1);
      const fn = after.match(/^\s*(?:async\s*)?(?:<[^(=]*>)?\s*\(/);
      const grp = fn ? balanced(after, after.indexOf("(")) : null;
      const tail = grp ? after.slice(grp.end) : "";
      if (grp && /^\s*(:|=>)/.test(tail)) {
        const ret = /^\s*:/.test(tail) ? returnType(after, after.indexOf(":", grp.end) + 1, "=>") : "";
        sig = `${name}(${squash(grp.inner)})${ret ? `: ${ret}` : ""}`;
      } else if (/^\s*[A-Za-z_$][\w$]*\(/.test(after)) {
        const firstLine = after.split("\n")[0];
        sig = /^\s*triggered\(/.test(after)
          ? `${name}(event: EventPattern, ...args: Args)`
          : `${name} (helper-made: a constant or a function)`;
        doc =
          doc ||
          (firstLine.includes('"hero"')
            ? "Hero-form-only version of the trigger above."
            : firstLine.includes('"alterEgo"')
              ? "Alter-ego-form-only version of the trigger above."
              : "");
      } else {
        sig = annotation ? `${name}: ${annotation}` : name;
      }
    }
    add(pos, entry(sig, doc));
  }

  out.push(`## ${title} (\`${file}\`)`);
  out.push("");
  for (const [section, items] of groups) {
    out.push(`### ${section}`);
    out.push("");
    out.push(...items);
    out.push("");
  }
}

// The event patterns: members of the `on` object (`when` and `after` are the same object).
{
  const text = readFileSync(join(dslDir, "abilities.ts"), "utf8");
  const start = text.indexOf("export const on = {");
  const open = text.indexOf("{", start);
  const end = text.indexOf("\n};", open);
  const body = text.slice(open + 1, end);
  const items = [];
  const memberRe = /^ {2}([A-Za-z_$][\w$]*)(?::\s*|,\s*$)/gm;
  let m;
  while ((m = memberRe.exec(body))) {
    const name = m[1];
    const before = body.slice(0, m.index).trimEnd();
    let doc = "";
    if (before.endsWith("*/")) {
      const st = before.lastIndexOf("/**");
      if (st >= 0 && st >= before.lastIndexOf("/*", before.length - 3)) doc = firstSentence(before.slice(st));
    }
    const rest = body.slice(m.index + m[0].length);
    let sig = name;
    if (rest.startsWith("(")) {
      const grp = balanced(rest, 0);
      const ret = /^\s*:/.test(rest.slice(grp.end)) ? returnType(rest, rest.indexOf(":", grp.end) + 1, "=>") : "";
      sig = `${name}(${squash(grp.inner)})${ret ? `: ${ret}` : ""}`;
    }
    items.push(entry(sig, doc));
    total++;
  }
  out.push("## Event patterns: `on.*`, `when.*` and `after.*` (`abilities.ts`)");
  out.push("");
  out.push(
    "`when` and `after` are the same object as `on`; use `when.x` for interrupts and `after.x` for responses so the card reads like its text. A member written as a bare name (for example `enemyAttacks`) is a function defined elsewhere in the file with its own doc comment.",
  );
  out.push("");
  out.push(...items);
  out.push("");
}

out.push(`<!-- ${total} exports -->`);
const result = `${out.join("\n")}\n`;
if (outFile) writeFileSync(outFile, result);
else process.stdout.write(result);
