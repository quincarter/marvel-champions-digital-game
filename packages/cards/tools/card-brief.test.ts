/**
 * Everything you need to start scripting one card, in one command.
 *
 *   MC_CARD=15023 pnpm card
 *   MC_CARD="11020 11049" pnpm card
 *
 * Replaces the five-or-so file reads a scripter otherwise does per card — find it in
 * `packages/content/src/data/<pack>/cards.ts`, read its text, list its ability refs, check each against the
 * registry, then grep `packages/cards/src` for where a scripted one lives. Doing that by hand costs tokens and
 * is easy to get subtly wrong; this is deterministic and always current.
 *
 * It also surfaces two things that are easy to miss by eye and expensive to miss in a script:
 * **errata** (`text.current` differing from `text.printed` — the errata'd text is what to script), and
 * **`starIcon`**, which is not `boostIcons` (see `docs/card-scripting-process.md` §7).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import * as content from "@mc/content";
import { abilityRefIds } from "../src/ability-refs.js";
import { CORE_ABILITIES } from "../src/core/index.js";
import { WAVE1_ABILITIES } from "../src/wave1/index.js";
import { WAVE2_ABILITIES } from "../src/wave2/index.js";

const REGISTRY: Record<string, unknown> = { ...CORE_ABILITIES, ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

type Card = Record<string, any>;

function everyCard(): Card[] {
  const seen = new Map<string, Card>();
  for (const [name, value] of Object.entries(content as Record<string, unknown>)) {
    if (!name.endsWith("_CARDS") || !Array.isArray(value)) continue;
    for (const card of value as Card[]) if (card?.id && !seen.has(card.id)) seen.set(card.id, card);
  }
  return [...seen.values()];
}

/** Where a ref is scripted, if it is — a repo-relative path, found the same way a human would grep for it. */
function definedIn(refId: string): string | null {
  try {
    const out = execSync(`grep -rl '"${refId}"' src --include=*.ts`, {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
    });
    const files = out.split("\n").filter((f) => f && !f.endsWith(".test.ts"));
    return files[0] ? `packages/cards/${files[0]}` : null;
  } catch {
    return null;
  }
}

const bullet = (label: string, value: unknown): string | null =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
    ? null
    : `  ${label.padEnd(14)}${Array.isArray(value) ? value.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join(", ") : value}`;

function brief(card: Card): string {
  const lines: (string | null)[] = [
    "",
    `━━ ${card.id}  ${card.name}${card.subname ? ` — ${card.subname}` : ""}`,
    bullet("type", card.type),
    bullet("pack", card.setCode),
    bullet("traits", card.traits),
    bullet("keywords", card.keywords),
    bullet("cost", card.cost),
    bullet("unique", card.unique === true ? "yes" : null),
    bullet("boostIcons", card.boostIcons),
    bullet("starIcon", card.starIcon === true ? "YES — count with starIcons, NOT boostIcons" : null),
  ];

  const printed: string | undefined = card.text?.printed;
  const current: string | undefined = card.text?.current;
  if (printed) {
    lines.push("", "  text (printed):");
    for (const l of printed.split("\n")) lines.push(`    │ ${l}`);
  }
  if (current && current !== printed) {
    lines.push("", "  !! ERRATA — script THIS, not the printed text:");
    for (const l of current.split("\n")) lines.push(`    │ ${l}`);
  }

  const refs = abilityRefIds(card);
  lines.push("", refs.length === 0 ? "  abilities: (none)" : "  abilities:");
  for (const ref of refs) {
    const where = ref in REGISTRY ? definedIn(ref) : null;
    lines.push(
      `    ${ref in REGISTRY ? "✓" : "✗"} ${ref}${where ? `\n        ${where}` : ref in REGISTRY ? "" : "   ← not scripted"}`,
    );
  }

  const md = `docs/cards/by_pack/${card.setCode}.md`;
  try {
    readFileSync(new URL(`../../../${md}`, import.meta.url));
    lines.push("", `  printed-text reference: ${md}  (transcription, not authoritative)`);
  } catch {
    /* no markdown for this pack */
  }
  return lines.filter((l) => l !== null).join("\n");
}

describe("card brief", () => {
  it("prints everything needed to script the requested card(s)", () => {
    const wanted = (process.env.MC_CARD ?? "").split(/[,\s]+/).filter(Boolean);
    if (wanted.length === 0) {
      console.log("\n  Set MC_CARD to one or more card ids, e.g.  MC_CARD=15023 pnpm card\n");
      return;
    }
    const cards = everyCard();
    const out: string[] = [];
    for (const id of wanted) {
      const card = cards.find((c) => c.id === id);
      out.push(card ? brief(card) : `\n━━ ${id}  NOT FOUND in @mc/content`);
    }
    out.push("");
    console.log(out.join("\n"));
    expect(wanted.length).toBeGreaterThan(0);
  });
});
