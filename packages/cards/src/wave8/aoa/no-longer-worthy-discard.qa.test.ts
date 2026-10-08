import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cardId, CORE_CARDS, MUT_GEN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { NIGHTCRAWLER_OBLIGATION_NEMESIS } from "../ncrawler/nightcrawler/obligation-nemesis.js";
import { MAGNETO_EVENTS } from "../magneto/magneto/events.js";
import { APOCALYPSE } from "./apocalypse.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Owner ruling Q13 (docs/phase7-wave8.md section 4.1; sections 3.21 and 5.1): "a player card may discard No Longer
 * Worthy; the confirm prompt is our UX, worded as a warning, not a rule." RRG 1.8 "Leaves Play" / "Discard": nothing in
 * the rules stops a player card from discarding an attachment on an enemy, so the engine treats it as an ordinary
 * legal choice.
 *
 * What the repo can prove today:
 * - No scripted player card can reach No Longer Worthy (45105b). Every player card that discards an enemy attachment
 *   is limited to "an attachment with the text 'Hero Action' or 'Hero Response'" (Electromagnetic Blast 49008 here;
 *   Vision, Shadowcat, Wonder Man, Wolverine are the same filter) and No Longer Worthy prints only a Forced Interrupt.
 *   That is correct for those cards, but it means the ruling's "a player card may discard it" has no real card to
 *   exercise it: pinned as todo.
 * - The client warning ("The rules allow this. ... This warning is the app's, not the game's.") is not built: pinned
 *   with it.fails against the client source.
 */
const NLW = "45105b";
const SWORD = "48029"; // Azazel's Sword: Hero Response (scripted with Nightcrawler's nemesis set)
const SUIT = "01098";
const BLAST = "49008";
const BREAKIN = "01107";

const MAGNETO = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const SEAT = {
  identityCardId: MAGNETO.identityCardId,
  aspects: MAGNETO.aspects,
  deck: MAGNETO.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_EVENTS, NIGHTCRAWLER_OBLIGATION_NEMESIS, APOCALYPSE),
};
const POOL = [...CORE_CARDS, ...WAVE8_CARDS, ...MUT_GEN_CARDS.filter((c) => (c.id as string) === "32150")];

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame(
    { ...config, players: [SEAT], encounterDeck: [...config.encounterDeck, cardId(NLW), cardId(SUIT)] as never[] },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
    { heroForm: 0 },
  );
}

const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = POOL.find((c) => (c.id as string) === (s.instances[id]!.cardId as string)) as
    | { resourceIcons?: Record<string, number> }
    | undefined;
  return Object.values(card?.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};

/** Board: a 3-threat side scheme (so Blast removes its last threat), No Longer Worthy and Azazel's Sword on the villain. */
function board() {
  const base = setupGame();
  const scheme = encounterCardInVillainArea(base, BREAKIN, 3);
  const villain = scheme.state.activeVillainId!;
  const worthy = attachToHost(scheme.state, NLW, villain);
  const suit = attachToHost(worthy.state, SUIT, villain);
  const sword = { state: patchInstance(suit.state, suit.id, { cardId: cardId(SWORD) }), id: suit.id };
  return { state: sword.state, scheme: scheme.id, worthy: worthy.id, sword: sword.id };
}

/** Plays Electromagnetic Blast, recording every attachment a prompt offers, and answers with `prefer`. */
function blast(state: GameState, watched: readonly InstanceId[], prefer: readonly string[]) {
  const offered = new Set<string>();
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    for (const o of choice.options) if (watched.includes(o.optionId as InstanceId)) offered.add(o.optionId);
    const hits = prefer.filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(s);
  };
  const handed = moveToHand(state, P1, BLAST);
  const card = handed.ids[0]!;
  const paying: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(handed.state, P1).hand) {
    if (paid >= 2) break;
    if (h === card || iconsOf(handed.state, h) === 0) continue;
    paying.push(h);
    paid += iconsOf(handed.state, h);
  }
  if (paid < 2) throw new Error("not enough payers");
  const run = driveEventsPicking(DEPS, handed.state, pick, play(P1, card, paying));
  return { state: run.state, offered };
}

describe("Q13: a player card discarding No Longer Worthy (45105b)", () => {
  it("control: Electromagnetic Blast (Q13 board) offers Azazel's Sword (Hero Response) and discards it", () => {
    const b = board();
    expect(inst(b.state, b.worthy).attachedTo).toBe(b.state.activeVillainId);
    const { state, offered } = blast(b.state, [b.worthy, b.sword], [b.scheme, b.sword]);
    expect([...offered]).toEqual([b.sword]);
    expect(inst(state, b.sword).attachedTo).toBeNull();
  });

  it("Blast does not offer No Longer Worthy (it prints only a Forced Interrupt, no Hero Action/Response); it stays attached", () => {
    const b = board();
    const { state, offered } = blast(b.state, [b.worthy, b.sword], [b.scheme, b.worthy]);
    expect(offered.has(b.worthy)).toBe(false);
    expect(inst(state, b.worthy).attachedTo).toBe(b.state.activeVillainId);
  });

  // Needs a player card whose discard is not limited to Hero Action / Hero Response text. None is scripted in the repo.
  it.todo(
    "Q13 = A: an unrestricted player discard offers No Longer Worthy, it leaves play, is removed from the game (45105b text; docs 3.21) and cannot return",
  );

  const clientSources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? clientSources(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });

  // docs/phase7-wave8.md 5.1 specifies this client wording. Not built: nothing under packages/client/src carries it.
  it.fails("the app warns once, in its own words, before a player card discards No Longer Worthy (docs 5.1)", () => {
    const root = join(import.meta.dirname, "../../../../client/src");
    const text = clientSources(root)
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    expect(text).toContain("This warning is the app's, not the game's.");
  });
});
