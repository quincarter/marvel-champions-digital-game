import { encounterSetId } from "@mc/content";
import {
  applyCommand,
  cardOf,
  cardsInPlay,
  consideredRemainingHitPoints,
  createGame,
  grantedIcons,
  hasKeyword,
  keywordTotal,
  mainSchemeValue,
  maxHitPoints,
  replay,
  sessionApply,
  startSession,
  traitsOf,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, firstLegal, patchInstance, settle, stackEncounterDeck } from "../testing/harness.js";
import { playToOutcome } from "../testing/driver.js";
import { withForm } from "../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS } from "./index.js";
import { wave8Scenario, type Wave8ScenarioOptions } from "./setup.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Whole games of the five Age of Apocalypse scenarios (`wave8Scenario`), the first time any of them is played from
 * setup to an outcome (docs/phase7-wave8-qa.md). Their card scripts are unit tested on a Rhino game with the fields
 * swapped in; the builder's tests (`setup.test.ts`) stop after the first villain phase. Here the real builder, the real
 * registry (`WAVE8_DEPS`) and the shared greedy driver (`../testing/driver.ts`) play one command at a time, each game
 * with a different wave 8 hero's starter deck.
 *
 * Invariants after every command, on every game (same list as the precon games, `aoa/magik/precon-e2e.test.ts`):
 * - the engine accepts every command the driver picks from the legal ones (`sessionApply`), so no rejection;
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with, and every encounter card the setup created, is
 *   still somewhere (RRG "Owner", p. 31);
 * - the log replays to the identical final state.
 *
 * Scenario checks (the `seen` tally; the last test of the file asserts each was seen, and says whether naturally in a
 * driver-played game or staged by state surgery before a real command; every occurrence is asserted, not only the first):
 * - Unus: Gene Pool's tiers (MC45 p. 8, 45059 to 45061: retaliate 1 at 3, stalwart at 6, an amplify icon at 9), and the
 *   main scheme (45062b) placing 1 threat on Gene Pool after step one of each villain phase.
 * - Four Horsemen: a shuffled row, the active counter moving one place right from the holder (docs/phase7-wave8.md
 *   section 4.1 Q5), a Horseman at 0 hit points staying in play until all four are at 0, then all four falling together
 *   and the game won (45081 to 45084 "cannot be defeated while another villain has at least 1 hit point").
 * - Apocalypse: a Prelate with each chained side scheme (MC45 p. 14), no threat removed from one while a Prelate is in
 *   play, completing the main scheme at stages I to III revealing the next stage with no loss (45101a to 45102a), No
 *   Longer Worthy attached when the Throne falls (45105a), stage IV at target losing (45102b).
 * - Dark Beast: at most one Setting environment in play, the stage change bringing a new one, his attack resolving the
 *   Setting's Special (45118 to 45120).
 * - En Sabah Nur: a form change with no reveal (MC45 p. 19), power counters reaching 4 and revealing a SUPERPOWER card
 *   (45147b), the new stage keeping the form (Q16).
 */

const HEROES = [
  "bishop-leadership",
  "magik-aggression",
  "iceman-aggression",
  "jubilee-justice",
  "magneto-leadership",
  "nightcrawler-protection",
] as const;
const SCENARIOS = ["unus", "four-horsemen", "apocalypse", "dark-beast", "en-sabah-nur"] as const;
type ScenarioId = (typeof SCENARIOS)[number];
const PRELATES = ["45179", "45180", "45181", "45182", "45183"];
const CHAINED = ["45104a", "45104b", "45105a"];

const heroOf = (n: number) => HEROES[n % HEROES.length]!;

// ---------------------------------------------------------------------------------------------------------------
// What was seen
// ---------------------------------------------------------------------------------------------------------------

/** The Horsemen's row, as codes left to right, in every game that began: it is random by seed. */
const rowOrders = new Set<string>();
const seen: Record<string, { natural: string[]; staged: string[] }> = {};
const note = (key: string, where: string, staged: boolean): void => {
  const entry = (seen[key] ??= { natural: [], staged: [] });
  (staged ? entry.staged : entry.natural).push(where);
};

const codeOf = (s: GameState, id: InstanceId): string => String(s.instances[id]!.cardId);
const nameOf = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.name;
const inPlayByCode = (s: GameState, ...codes: string[]): InstanceId[] =>
  cardsInPlay(s).filter((id) => codes.includes(codeOf(s, id)));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const threatOf = (s: GameState, id: InstanceId): number => s.instances[id]!.threat;
const hpLeft = (s: GameState, id: InstanceId): number =>
  (maxHitPoints(s, id, WAVE8_DEPS) ?? 0) - s.instances[id]!.damage;
const poolOf = (s: GameState): InstanceId | undefined => inPlayByCode(s, "45071")[0];
const unusOf = (s: GameState): InstanceId | undefined => s.villains.find((v) => !v.defeated)?.instanceId;
const isSetting = (s: GameState, id: InstanceId): boolean => {
  const card = cardOf(s, id);
  return card?.type === "environment" && (traitsOf(s, id, WAVE8_DEPS) as readonly string[]).includes("SETTING");
};
const settingsInPlay = (s: GameState): InstanceId[] => cardsInPlay(s).filter((id) => isSetting(s, id));
const prelatesInPlay = (s: GameState): InstanceId[] =>
  cardsInPlay(s).filter((id) => cardOf(s, id)?.type === "minion" && PRELATES.includes(codeOf(s, id).slice(0, 5)));

// ---------------------------------------------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------------------------------------------

function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** The setup facts the per-command checks compare against. */
interface Baseline {
  readonly dealtTo: ReadonlyMap<string, PlayerId>;
  /** Every encounter card instance the setup created (not a player's, not a villain or the main scheme). */
  readonly encounterIds: readonly InstanceId[];
}

function baselineOf(s: GameState): Baseline {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea", "setAside"] as const)
      for (const id of p[zone]) if (s.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  const owned = new Set(s.players.flatMap((p) => [...p.hand, ...p.deck, ...p.discard, ...p.playArea, ...p.setAside]));
  const encounterIds = (Object.keys(s.instances) as InstanceId[]).filter(
    (id) =>
      !owned.has(id) &&
      !s.players.some((p) => p.identity.instanceId === id) &&
      !s.villains.some((v) => v.instanceId === id) &&
      id !== s.mainScheme.instanceId &&
      s.instances[id]!.attachedTo === null,
  );
  return { dealtTo, encounterIds };
}

/** Throws a descriptive error on the first broken invariant of `s`. */
function checkState(s: GameState, base: Baseline, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  for (const [id, owner] of base.dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const id of base.encounterIds)
    if (!zones.has(id) && s.instances[id]?.attachedTo === null && s.instances[id]?.facedownAs === undefined)
      fail(`encounter card ${nameOf(s, id)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone]) {
        const dealt = base.dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && dealt === undefined)
          fail(`${nameOf(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
}

// ---------------------------------------------------------------------------------------------------------------
// Scenario checks (asserted on every state and every command)
// ---------------------------------------------------------------------------------------------------------------

interface Context {
  readonly scenario: ScenarioId;
  readonly label: string;
  readonly staged: boolean;
  /** A game that began at setup (the setup checks apply to its opening state); false for a staged segment mid-game. */
  readonly fromSetup?: boolean;
}

/** Per-run state of the scenario checks, which keeps what spans commands (a prompt in between). */
class Observer {
  /** Villain phases whose step one ran, and the times 45062b answered one. */
  private phases = 0;
  private responses = 0;
  /** Horsemen: villain activations and counter moves, whole run. */
  private activations = 0;
  private moves = 0;
  /** An effect chain waiting for its end (a prompt split it across commands): where it began and what it needs. */
  private waiting = new Map<string, { readonly where: string; readonly data: readonly InstanceId[] }>();
  constructor(readonly ctx: Context) {}

  private see(key: string, s: GameState): void {
    note(`${this.ctx.scenario}.${key}`, `${this.ctx.label} round ${s.round}`, this.ctx.staged);
  }
  private wait(key: string, s: GameState, data: readonly InstanceId[] = []): void {
    if (!this.waiting.has(key)) this.waiting.set(key, { where: `${this.ctx.label} round ${s.round}`, data });
  }

  /** The opening state: the state checks, and what setup did (MC45 pp. 8 to 19: each scenario's Setup). */
  initial(s: GameState): void {
    this.state(s);
    if (this.ctx.fromSetup === false) return;
    const here = `${this.ctx.label} setup`;
    if (this.ctx.scenario === "four-horsemen") {
      const row = s.villainRow ?? [];
      const codes = row.map((id) => codeOf(s, id));
      // 45085a Setup: the four Horsemen shuffled into a row, the counter on the leftmost, a side scheme per player.
      expect(codes.map((c) => c.slice(0, 5)).sort(), `${here}: the four Horsemen`).toEqual([
        "45081",
        "45082",
        "45083",
        "45084",
      ]);
      expect(s.activeVillainId, `${here}: the active counter starts on the leftmost`).toBe(row[0]);
      expect(inPlayByCode(s, "45086", "45087", "45088", "45089").length, `${here}: a side scheme per player`).toBe(
        s.players.length,
      );
      rowOrders.add(codes.map((c) => c.slice(0, 5)).join(">"));
    }
    if (this.ctx.scenario === "apocalypse") {
      // 45103a Setup: Heart of the Empire, with a random Prelate revealed by the first player.
      expect(inPlayByCode(s, "45104a"), `${here}: Heart of the Empire`).toHaveLength(1);
      expect(prelatesInPlay(s), `${here}: its Prelate`).toHaveLength(1);
      this.see("prelateGuards", s);
    }
    if (this.ctx.scenario === "unus") expect(poolOf(s), `${here}: Gene Pool`).toBeDefined();
    if (this.ctx.scenario === "dark-beast") expect(settingsInPlay(s), `${here}: a Setting`).toHaveLength(1);
    if (this.ctx.scenario === "en-sabah-nur") expect(s.villains[0]!.side, `${here}: Biomorph form`).toBe("A");
  }

  /** Checks of the state alone, run on the opening state and after every command. */
  state(s: GameState): void {
    const here = `${this.ctx.label} round ${s.round}`;
    if (this.ctx.scenario === "unus") this.unusTiers(s, here);
    if (this.ctx.scenario === "four-horsemen") this.horsemenState(s, here);
    if (this.ctx.scenario === "dark-beast") {
      // 45127, 45133, 45139 "When Revealed: Discard each other Setting environment in play": one Setting at a time.
      expect(settingsInPlay(s).length, `${here}: at most one Setting environment in play`).toBeLessThanOrEqual(1);
      if (settingsInPlay(s).length === 1) this.see("oneSetting", s);
    }
  }

  private unusTiers(s: GameState, here: string): void {
    const pool = poolOf(s);
    const unus = unusOf(s);
    if (pool === undefined || unus === undefined) return;
    const threat = threatOf(s, pool);
    // 45059 to 45061: at 3 retaliate 1; at 6 also stalwart; at 9 also an amplify icon. Each is read live, so each is
    // gone again when the threat falls below it.
    expect(keywordTotal(s, unus, "retaliate", WAVE8_DEPS) >= 1, `${here}: retaliate at ${threat} threat`).toBe(
      threat >= 3,
    );
    expect(hasKeyword(s, unus, "stalwart", WAVE8_DEPS), `${here}: stalwart at ${threat} threat`).toBe(threat >= 6);
    expect(grantedIcons(s, WAVE8_DEPS, "amplify") >= 1, `${here}: amplify at ${threat} threat`).toBe(threat >= 9);
    this.see(threat >= 9 ? "tier9" : threat >= 6 ? "tier6" : threat >= 3 ? "tier3" : "tier0", s);
  }

  private horsemenState(s: GameState, here: string): void {
    const row = s.villainRow ?? [];
    const defeated = s.villains.filter((v) => v.defeated).length;
    // 45081 to 45084: none can be defeated while another has at least 1 hit point, so they fall together or not at all.
    // (Finding F1, fixed: no state between the two is ever handed back to the player.)
    expect([0, 4], `${here}: ${defeated} Horsemen defeated`).toContain(defeated);
    if (defeated === 0) {
      expect(row, `${here}: the whole row is in play`).toHaveLength(4);
      expect(new Set(row).size).toBe(4);
    }
    const alive = s.villains.filter((v) => !v.defeated).map((v) => v.instanceId);
    const atZero = alive.filter((id) => hpLeft(s, id) <= 0);
    if (atZero.length > 0) this.see("zeroStaysInPlay", s);
    // All four at 0 and none defeated is only legal while a Golden Horse or Metal Wings is "considered to have at
    // least 1" (45090, 45091); otherwise the state check defeats all four.
    if (alive.length === 4 && atZero.length === 4) {
      const floor = alive.some((id) => (consideredRemainingHitPoints(s, id, WAVE8_DEPS) ?? 0) >= 1);
      expect(floor, `${here}: all four at 0 hit points and nobody defeated, with no floor card`).toBe(true);
    }
  }

  /** Checks of one command: the state before and after it and the events it produced. */
  command(before: GameState, after: GameState, events: readonly GameEvent[]): void {
    const here = `${this.ctx.label} round ${before.round}`;
    switch (this.ctx.scenario) {
      case "unus":
        return this.unusCommand(after, events, here);
      case "four-horsemen":
        return this.horsemenCommand(before, after, events, here);
      case "apocalypse":
        return this.apocalypseCommand(before, after, events, here);
      case "dark-beast":
        return this.darkBeastCommand(before, after, events, here);
      case "en-sabah-nur":
        return this.sabahNurCommand(before, after, events, here);
    }
  }

  /** At the end of a game: nothing a scenario started was left unfinished, and the counts agree. */
  finish(final: GameState): void {
    const label = this.ctx.label;
    if (!final.outcome)
      for (const [key, w] of this.waiting) expect.fail(`${label}: ${key} began at ${w.where} and never finished`);
    if (this.ctx.scenario === "unus") {
      expect(this.responses, `${label}: 45062b answered each villain phase`).toBeLessThanOrEqual(this.phases);
      // A loss in step one itself (the main scheme completing) leaves no response behind.
      expect(this.phases - this.responses, `${label}: a villain phase without 45062b's threat`).toBeLessThanOrEqual(1);
    }
    if (this.ctx.scenario === "four-horsemen")
      expect(this.moves, `${label}: the counter moved after each villain activation`).toBeGreaterThanOrEqual(
        this.activations - 1,
      );
  }

  private unusCommand(after: GameState, events: readonly GameEvent[], here: string): void {
    for (const e of ofType(events, "stepChanged"))
      if (e.to.phase === "villain" && e.to.kind === "placeThreat" && e.from.kind !== "placeThreat") this.phases++;
    const pool = poolOf(after);
    events.forEach((e, index) => {
      if (e.type !== "abilityResolved" || e.abilityId !== "45062b.hunting-gene-traitors-forced-response") return;
      this.responses++;
      // 45062b: "place 1 threat on Gene Pool" after step one.
      const placed = events
        .slice(index)
        .filter((x) => x.type === "threatPlaced" && x.schemeInstanceId === pool && x.amount === 1);
      expect(placed.length, `${here}: the main scheme placed 1 threat on Gene Pool`).toBeGreaterThanOrEqual(1);
      this.see("mainSchemeThreat", after);
    });
  }

  private horsemenCommand(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const rowOf = (s: GameState) =>
      (s.villainRow ?? []).filter((id) => !s.villains.find((v) => v.instanceId === id)?.defeated);
    const sameRow = JSON.stringify(rowOf(before)) === JSON.stringify(rowOf(after));
    let holder = before.activeVillainId;
    for (const e of ofType(events, "activeVillainChanged")) {
      if (e.reason !== "nextInRow") {
        holder = e.to;
        continue;
      }
      expect(e.from, `${here}: the move starts at the villain holding the counter`).toBe(holder);
      const row = rowOf(before);
      if (sameRow && row.length > 1) {
        // Q5: one place along the row from the holder, wrapping from the right end to the leftmost.
        expect(e.to, `${here}: one place to the right of the holder`).toBe(row[(row.indexOf(e.from) + 1) % row.length]);
        this.see("counterMovesRight", after);
      }
      holder = e.to;
      this.moves++;
    }
    this.activations += ofType(events, "enemyActivated").filter((e) =>
      before.villains.some((v) => v.instanceId === e.enemyInstanceId),
    ).length;
    if (events.some((e) => e.type === "gameEnded") && after.outcome?.result === "win") {
      expect(after.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
      expect(
        after.villains.every((v) => v.defeated),
        `${here}: all four fell together`,
      ).toBe(true);
      this.see("fallTogether", after);
    }
  }

  private apocalypseCommand(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    // Threat cannot be removed from a chained scheme while a Prelate is in play (45104a, 45104b, 45105a).
    for (const e of ofType(events, "threatRemoved")) {
      if (e.amount <= 0 || !CHAINED.includes(codeOf(before, e.schemeInstanceId))) continue;
      const prelatesBefore = prelatesInPlay(before).length;
      expect(
        prelatesBefore === 0 || prelatesInPlay(after).length < prelatesBefore,
        `${here}: threat removed from ${nameOf(before, e.schemeInstanceId)} with a Prelate in play`,
      ).toBe(true);
    }
    // A chained scheme that comes into play (or flips to its next side) brings a Prelate with it.
    const chained = (s: GameState) => inPlayByCode(s, ...CHAINED);
    const flipped = ofType(events, "cardFlippedToOtherFace").filter((e) => CHAINED.includes(String(e.to)));
    const entered = chained(after).filter((id) => !chained(before).includes(id));
    if (flipped.length + entered.length > 0) this.wait("prelate", after);
    if (
      this.waiting.has("prelate") &&
      ofType(events, "encounterCardRevealed").some((e) => PRELATES.includes(String(e.cardId).slice(0, 5)))
    ) {
      this.waiting.delete("prelate");
      expect(prelatesInPlay(after).length, `${here}: a Prelate guards the scheme that just came into play`).toBe(1);
      this.see("prelateGuards", after);
    }
    for (const e of ofType(events, "villainStageRevealed")) {
      expect(e.toStageNumber, `${here}: the next stage`).toBe(e.fromStageNumber + 1);
      expect(e.fromStageNumber).toBeLessThanOrEqual(3);
      expect(after.outcome, `${here}: completing stage ${e.fromStageNumber} is not a loss`).toBeNull();
      expect(threatOf(after, after.mainScheme.instanceId)).toBeLessThan(
        mainSchemeValue(after, "targetThreat", WAVE8_DEPS),
      );
      this.see(`stage${e.fromStageNumber}to${e.toStageNumber}`, after);
    }
    if (after.outcome?.result === "loss" && after.outcome.reason === "mainSchemeCompleted") {
      expect(after.villains[0]!.stageIndex, `${here}: the main scheme only loses the game at stage IV`).toBe(3);
      this.see("stageIVLoses", after);
    }
    if (ofType(events, "cardFlippedToOtherFace").some((e) => String(e.to) === "45105b"))
      this.wait("noLongerWorthy", after);
    const worthy = inPlayByCode(after, "45105b")[0];
    if (this.waiting.has("noLongerWorthy") && worthy !== undefined) {
      this.waiting.delete("noLongerWorthy");
      expect(after.instances[worthy]!.attachedTo, `${here}: No Longer Worthy attached to Apocalypse`).toBe(
        after.villains[0]!.instanceId,
      );
      this.see("noLongerWorthy", after);
    }
  }

  private darkBeastCommand(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    // 45118 to 45120: when Dark Beast attacks, the attacked player resolves the Setting's Special (it may ask first).
    if (
      events.some(
        (e) =>
          e.type === "abilityResolved" &&
          /^4511[89]\.dark-beast-forced-interrupt$|^45120\.dark-beast-forced-interrupt$/.test(e.abilityId),
      ) &&
      (settingsInPlay(before).length > 0 || settingsInPlay(after).length > 0)
    )
      this.wait("special", after);
    if (
      this.waiting.has("special") &&
      events.some((e) => e.type === "abilityResolved" && e.abilityId.endsWith("-special"))
    ) {
      this.waiting.delete("special");
      this.see("attackResolvesSpecial", after);
    }
    if (ofType(events, "villainStageAdvanced").length > 0) this.wait("newSetting", after, settingsInPlay(before));
    const waiting = this.waiting.get("newSetting");
    if (waiting) {
      const fresh = settingsInPlay(after).filter((id) => !waiting.data.includes(id));
      if (fresh.length > 0) {
        this.waiting.delete("newSetting");
        expect(settingsInPlay(after), `${here}: exactly one Setting after the stage change`).toHaveLength(1);
        this.see("stageBringsNewSetting", after);
      }
    }
  }

  private sabahNurCommand(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const villain = after.villains[0]!;
    const flips = ofType(events, "villainFlipped");
    if (flips.length > 0) {
      // MC45 p. 19: a form change is a flip, "NOT the same as 'defeating' or 'revealing' the villain".
      expect(ofType(events, "villainStageAdvanced"), `${here}: no stage change in a form change`).toHaveLength(0);
      expect(ofType(events, "villainStageRevealed"), `${here}: no reveal in a form change`).toHaveLength(0);
      expect(
        ofType(events, "encounterCardRevealed").some((r) => r.instanceId === villain.instanceId),
        `${here}: the villain was not revealed`,
      ).toBe(false);
      expect(villain.side, `${here}: the villain shows the form it flipped to`).toBe(flips[flips.length - 1]!.to);
      this.see("formChangeNoReveal", after);
    }
    for (const e of ofType(events, "villainStageAdvanced")) {
      if (flips.length > 0) continue;
      // Q16 = A: the new stage keeps the form it was defeated in.
      expect(villain.side, `${here}: stage ${e.stageIndex + 1} keeps the form`).toBe(before.villains[0]!.side);
      this.see(`stageKeepsForm.${villain.side}`, after);
    }
    for (const e of ofType(events, "counterRemoved")) {
      if (e.counterType !== "power" || e.instanceId !== before.mainScheme.instanceId || e.amount !== 4) continue;
      const hadOne = Object.values(before.encounterDecks).some((pile) =>
        [...pile.deck, ...pile.discard].some((id) => isSuperpower(before, id)),
      );
      if (hadOne) this.wait("superpower", after);
    }
    if (
      this.waiting.has("superpower") &&
      ofType(events, "encounterCardRevealed").some((r) => isSuperpower(after, r.instanceId))
    ) {
      this.waiting.delete("superpower");
      this.see("powerFourRevealsSuperpower", after);
    }
  }
}

const isSuperpower = (s: GameState, id: InstanceId): boolean =>
  (traitsOf(s, id, WAVE8_DEPS) as readonly string[]).includes("SUPERPOWER");

// ---------------------------------------------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------------------------------------------

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
  readonly events: readonly GameEvent[];
}

interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  /** Commands issued first, one per step at which nothing is pending, before the driver takes over. */
  readonly script?: readonly ((s: GameState) => Command)[];
  /** Stop once the script is spent and nothing is pending (a staged segment). */
  readonly stopAfterScript?: boolean;
}

function nextCommand(
  state: GameState,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  if (!state.pendingChoice && !state.outcome && script.length > 0) return script.shift()!(state);
  if (!state.pendingChoice && state.step.phase === "player" && state.step.kind === "turn") {
    const key = `${state.round}:${state.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: state.step.activePlayerId };
  }
  const [command] = playToOutcome(state, WAVE8_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

/** Plays `initial` to an outcome, a round or the end of a script, checking every invariant after every command. */
function play(initial: GameState, ctx: Context, options: PlayOptions = {}): GameResult & { observer: Observer } {
  const base = baselineOf(initial);
  const observer = new Observer(ctx);
  checkState(initial, base, `${ctx.label} start`);
  observer.initial(initial);
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 2500;
  const events: GameEvent[] = [];
  let commands = 0;
  const done = () =>
    session.state.outcome !== null ||
    (options.stopAtRound !== undefined && session.state.round >= options.stopAtRound) ||
    (options.stopAfterScript === true && script.length === 0 && !session.state.pendingChoice);
  while (!done()) {
    if (commands >= maxCommands)
      throw new Error(`${ctx.label}: no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(before, turn, script);
    const result = sessionApply(session, command, WAVE8_DEPS);
    if (!result.ok)
      throw new Error(
        `${ctx.label}: engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`,
      );
    session = result.session;
    commands++;
    events.push(...result.events);
    checkState(session.state, base, `${ctx.label} command ${commands} ${JSON.stringify(command)}`);
    observer.state(session.state);
    observer.command(before, session.state, result.events);
  }
  observer.finish(session.state);
  return { session, commands, label: ctx.label, events, observer };
}

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE8_DEPS);
  expect(replayed.ok, `${result.label}: replay`).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

const start = (config: ReturnType<typeof wave8Scenario>): GameState => {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
};

interface Spec {
  readonly scenario: ScenarioId;
  readonly seats: readonly string[];
  readonly seed: number;
  readonly expert?: boolean;
  readonly options?: Partial<Wave8ScenarioOptions>;
}

const configOf = (spec: Spec) =>
  wave8Scenario(spec.scenario, {
    players: spec.seats.map((starterDeckId) => ({ starterDeckId })),
    seed: spec.seed,
    difficulty: spec.expert ? "expert" : "standard",
    ...spec.options,
  });

const labelOf = (spec: Spec): string =>
  `${spec.scenario}#${spec.seed} ${spec.expert ? "expert" : "standard"} ${spec.seats.join("+")}`;

/** A natural game: built from setup and played by the driver. */
function game(spec: Spec, options: PlayOptions = {}) {
  return play(start(configOf(spec)), { scenario: spec.scenario, label: labelOf(spec), staged: false }, options);
}

const completedRounds = (r: GameResult): number => r.session.state.round - 1;

// ---------------------------------------------------------------------------------------------------------------
// Natural games
// ---------------------------------------------------------------------------------------------------------------

const idx = (scenario: ScenarioId): number => SCENARIOS.indexOf(scenario);
/** One player, a different hero per seed (and per scenario, so all six heroes meet every scenario somewhere). */
const solo = (scenario: ScenarioId, seeds: readonly number[], expert = false): Spec[] =>
  seeds.map((seed, i) => ({ scenario, seats: [heroOf(idx(scenario) * 2 + i + (expert ? 3 : 0))], seed, expert }));
/** Two players with two different heroes. */
const duo = (scenario: ScenarioId, seed: number, options?: Partial<Wave8ScenarioOptions>): Spec => ({
  scenario,
  seats: [heroOf(idx(scenario)), heroOf(idx(scenario) + 3)],
  seed,
  ...(options ? { options } : {}),
});

/** The setup option each scenario's second two-player game carries (and what the test proves about it). */
const OPTION_GAME: Record<ScenarioId, Partial<Wave8ScenarioOptions>> = {
  unus: { genePoolThreatPerPlayer: 2 },
  "four-horsemen": { horsemanSides: ["A", "B", "B", "A"] },
  apocalypse: { easierStart: true },
  "dark-beast": { difficultySets: { standard: encounterSetId("standard_iii") } },
  "en-sabah-nur": { difficultySets: { standard: encounterSetId("standard_iii") } },
};

describe.each(SCENARIOS)("%s, whole games", (scenario) => {
  describe("standard, one player", () => {
    it.each(solo(scenario, [1, 2]))("$seats seed $seed plays to an outcome", (spec) => {
      const result = game(spec);
      expect(result.session.state.outcome).not.toBeNull();
      expectReplays(result);
    });
  });

  describe("expert, one player", () => {
    it.each(solo(scenario, [7, 8], true))("$seats seed $seed plays to an outcome", (spec) => {
      const result = game(spec);
      expect(result.session.state.outcome).not.toBeNull();
      expectReplays(result);
    });
  });

  describe("standard, two players", () => {
    // Seeds picked for the shorter games (the Horsemen's four villains make a game slow to drive).
    const [plain, optioned] = scenario === "four-horsemen" ? [14, 12] : [9, 10];
    const specs = [duo(scenario, plain), duo(scenario, optioned, OPTION_GAME[scenario])];
    it.each(specs)("$seats seed $seed $options plays to an outcome or five rounds", (spec) => {
      const result = game(spec, { stopAtRound: 6 });
      expect(result.session.state.outcome !== null || completedRounds(result) >= 5).toBe(true);
      expect(result.session.state.players).toHaveLength(2);
      expectReplays(result);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The setup options
// ---------------------------------------------------------------------------------------------------------------

/** How many encounter-deck and discard cards of `setId` the state holds. */
const countOfSet = (s: GameState, setId: string): number =>
  Object.values(s.encounterDecks)
    .flatMap((pile) => [...pile.deck, ...pile.discard])
    .filter((id) => {
      const card = WAVE8_CARDS.find((c) => c.id === s.instances[id]!.cardId);
      return (
        card !== undefined && "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)
      );
    }).length;

describe("setup options, in games", () => {
  it("Gene Pool extra threat: 2 per player on 2 players puts 4 more on Gene Pool at setup (MC45 p. 8)", () => {
    const withIt = start(configOf(duo("unus", 10, OPTION_GAME.unus)));
    const without = start(configOf(duo("unus", 10)));
    expect(threatOf(withIt, poolOf(withIt)!) - threatOf(without, poolOf(without)!)).toBe(4);
    // And it is a rule choice, not the mode: expert alone adds nothing.
    const expert = start(configOf({ ...duo("unus", 10), expert: true }));
    expect(threatOf(expert, poolOf(expert)!)).toBe(threatOf(without, poolOf(without)!));
    // The tier it reaches is the tier the card reads: 4 + 4 = 8 threat is tier 6.
    new Observer({ scenario: "unus", label: "gene-pool option", staged: false }).state(withIt);
  });

  it("Standard III as the standard set: the deck holds Standard III cards and no Standard cards (RRG p. 40; Q10)", () => {
    for (const scenario of ["dark-beast", "en-sabah-nur"] as const) {
      const s = start(configOf(duo(scenario, 10, OPTION_GAME[scenario])));
      expect(countOfSet(s, "standard_iii"), scenario).toBeGreaterThan(0);
      expect(countOfSet(s, "standard"), scenario).toBe(0);
      const printed = start(configOf(duo(scenario, 10)));
      expect(countOfSet(printed, "standard_iii"), scenario).toBe(0);
      expect(countOfSet(printed, "standard"), scenario).toBeGreaterThan(0);
    }
  });

  it("the per-Horseman sides: War and Death on side A, Famine and Pestilence on side B (MC45 p. 11)", () => {
    const s = start(configOf(duo("four-horsemen", 10, OPTION_GAME["four-horsemen"])));
    expect(s.villains.map((v) => codeOf(s, v.instanceId))).toEqual(["45081a", "45082b", "45083b", "45084a"]);
    expect((s.villainRow ?? []).map((id) => codeOf(s, id)).sort()).toEqual(["45081a", "45082b", "45083b", "45084a"]);
  });

  it("Apocalypse's easier start: stage I, 8 hit points and 8 target threat per player (MC45 p. 14)", () => {
    const s = start(configOf(duo("apocalypse", 10, OPTION_GAME.apocalypse)));
    const villain = s.villains[0]!;
    expect(villain.stageIndex).toBe(0);
    expect(maxHitPoints(s, villain.instanceId, WAVE8_DEPS)).toBe(16);
    expect(mainSchemeValue(s, "targetThreat", WAVE8_DEPS)).toBe(16);
    const printed = start(configOf(duo("apocalypse", 10)));
    expect(printed.villains[0]!.stageIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Staged: the checks no driver-played game reaches. The state is patched once (damage, threat, form) and every
// command after that is real, with the same invariants, and every segment's log replays.
// ---------------------------------------------------------------------------------------------------------------

const heroAttack =
  (target: (s: GameState) => InstanceId): ((s: GameState) => Command) =>
  (s) => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: s.players[0]!.identity.instanceId,
    targetInstanceId: target(s),
  });
const heroThwart =
  (target: (s: GameState) => InstanceId): ((s: GameState) => Command) =>
  (s) => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: s.players[0]!.identity.instanceId,
    schemeInstanceId: target(s),
  });
const endMyTurn = (s: GameState): Command => ({ type: "endTurn", playerId: s.step.phase === "player" ? P1 : P1 });
/** The hero in hero form, ready, to act. */
const ready = (s: GameState): GameState =>
  patchInstance(withForm(s, { heroForm: 0 }), s.players[0]!.identity.instanceId, { exhausted: false });
/** Damage set directly, and no status card (a tough card would absorb the attack that is meant to defeat it). */
const withDamageOn = (s: GameState, id: InstanceId, damage: number): GameState =>
  patchInstance(s, id, { damage, statuses: { ...s.instances[id]!.statuses, tough: 0 } });

/** One staged segment: patch the state, issue the script, let the driver settle every prompt, replay the log. */
function segment(
  scenario: ScenarioId,
  label: string,
  state: GameState,
  script: readonly ((s: GameState) => Command)[],
  fromSetup = false,
): ReturnType<typeof play> {
  const result = play(state, { scenario, label, staged: true, fromSetup }, { script, stopAfterScript: true });
  expectReplays(result);
  return result;
}

const stagedStart = (spec: Spec, change: (c: ReturnType<typeof configOf>) => ReturnType<typeof configOf> = (c) => c) =>
  start(change(configOf(spec)));

describe("Apocalypse, staged", () => {
  const completing = (spec: Spec, from: number) => {
    const s = stagedStart(spec);
    const target = mainSchemeValue(s, "targetThreat", WAVE8_DEPS);
    const patched = patchInstance(s, s.mainScheme.instanceId, { threat: target - 1 });
    const result = segment("apocalypse", `${labelOf(spec)} stage ${from} completes`, patched, [endMyTurn], true);
    return { result, s };
  };

  it.each([
    { from: 1, spec: { scenario: "apocalypse", seats: [heroOf(0)], seed: 21, options: { easierStart: true } } },
    { from: 2, spec: { scenario: "apocalypse", seats: [heroOf(1)], seed: 22 } },
    { from: 3, spec: { scenario: "apocalypse", seats: [heroOf(2)], seed: 23, expert: true } },
  ] satisfies { from: number; spec: Spec }[])(
    "completing the main scheme at stage $from reveals stage $from + 1 and does not lose (45101a to 45102a)",
    ({ from, spec }) => {
      const { result, s } = completing(spec, from);
      expect(s.villains[0]!.stageIndex).toBe(from - 1);
      const revealed = ofType(result.events, "villainStageRevealed");
      expect(revealed).toHaveLength(1);
      expect([revealed[0]!.fromStageNumber, revealed[0]!.toStageNumber]).toEqual([from, from + 1]);
      expect(ofType(result.events, "gameEnded")).toHaveLength(0);
      expect(result.session.state.outcome ?? null).toBeNull();
      expect(result.session.state.villains[0]!.stageIndex).toBe(from);
    },
  );

  it("completing the main scheme at stage IV loses the game (45102b; RRG p. 27)", () => {
    const spec: Spec = { scenario: "apocalypse", seats: [heroOf(3)], seed: 24 };
    const s = stagedStart(spec, (c) => ({ ...c, villainStartStageIndex: 3 }));
    expect(s.villains[0]!.stageIndex).toBe(3);
    const target = mainSchemeValue(s, "targetThreat", WAVE8_DEPS);
    const result = segment(
      "apocalypse",
      "stage IV completes",
      patchInstance(s, s.mainScheme.instanceId, { threat: target - 1 }),
      [endMyTurn],
      true,
    );
    expect(result.session.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(ofType(result.events, "villainStageRevealed")).toHaveLength(0);
  });

  it("the chain: a Prelate guards Heart, Citadel and Throne; No Longer Worthy attaches; Apocalypse falls and the players win", () => {
    const spec: Spec = { scenario: "apocalypse", seats: [heroOf(4)], seed: 25 };
    let s = stagedStart(spec);
    const apocalypse = (st: GameState) => st.villains[0]!.instanceId;
    const scheme = (code: string) => (st: GameState) => inPlayByCode(st, code)[0]!;
    const prelate = (st: GameState) => prelatesInPlay(st)[0]!;
    // Heart of the Empire with its Prelate, from setup.
    expect(inPlayByCode(s, "45104a")).toHaveLength(1);
    expect(prelatesInPlay(s)).toHaveLength(1);
    new Observer({ scenario: "apocalypse", label: "setup", staged: true }).state(s);

    // With the Prelate in play no threat comes off the scheme: the thwart is refused or removes nothing (45104a).
    const heart = scheme("45104a")(s);
    const lockedHeart = patchInstance(ready(s), heart, { threat: 1 });
    const tried = applyCommand(lockedHeart, heroThwart(scheme("45104a"))(lockedHeart), WAVE8_DEPS);
    expect(!tried.ok || threatOf(tried.state, heart) === 1, "a Prelate locks the Heart's threat").toBe(true);

    const clear = (code: string, hurt?: InstanceId) => {
      // Kill the Prelate with a real attack, then thwart the scheme (patched to 1 threat) with the hero ready again.
      const killed = segment(
        "apocalypse",
        `kill the Prelate guarding ${code}`,
        withDamageOn(ready(s), prelate(s), 99),
        [heroAttack(prelate)],
        code === "45104a",
      );
      s = killed.session.state;
      expect(prelatesInPlay(s)).toHaveLength(0);
      const thwarted = segment(
        "apocalypse",
        `defeat ${code}`,
        patchInstance(hurt === undefined ? ready(s) : withDamageOn(ready(s), hurt, 8), scheme(code)(s), { threat: 1 }),
        [heroThwart(scheme(code))],
      );
      s = thwarted.session.state;
      return thwarted;
    };
    const heartDown = clear("45104a");
    expect(inPlayByCode(s, "45104b"), "the Citadel is the Heart's other face").toHaveLength(1);
    expect(prelatesInPlay(s)).toHaveLength(1);
    expect(ofType(heartDown.events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(1);
    const citadelDown = clear("45104b");
    expect(inPlayByCode(s, "45105a"), "the Throne").toHaveLength(1);
    expect(prelatesInPlay(s)).toHaveLength(1);
    expect(inPlayByCode(s, "45104b"), "the Citadel left play").toHaveLength(0);
    expect(citadelDown.session.state.outcome ?? null).toBeNull();
    // The Throne's When Defeated heals 5 per hero from Apocalypse (45105a): 8 damage on him, 1 hero, 3 left.
    const throneDown = clear("45105a", apocalypse(s));
    const worthy = inPlayByCode(s, "45105b");
    expect(worthy, "No Longer Worthy").toHaveLength(1);
    expect(s.instances[worthy[0]!]!.attachedTo).toBe(apocalypse(s));
    expect(s.instances[apocalypse(s)]!.damage, "healed 5 per hero").toBe(3);
    expect(throneDown.session.state.outcome ?? null).toBeNull();
    expect(prelatesInPlay(s)).toHaveLength(1);

    // A Prelate in play: Apocalypse takes no damage (45105b). Without one, the killing blow wins the game.
    const shielded = applyCommand(withDamageOn(ready(s), apocalypse(s), 0), heroAttack(apocalypse)(s), WAVE8_DEPS);
    expect(
      !shielded.ok || shielded.state.instances[apocalypse(s)]!.damage === 0,
      "no damage with a Prelate in play",
    ).toBe(true);
    const killed = segment("apocalypse", "kill the last Prelate", withDamageOn(ready(s), prelate(s), 99), [
      heroAttack(prelate),
    ]);
    s = killed.session.state;
    expect(prelatesInPlay(s)).toHaveLength(0);
    const hp = maxHitPoints(s, apocalypse(s), WAVE8_DEPS)!;
    const finish = segment("apocalypse", "the killing blow", withDamageOn(ready(s), apocalypse(s), hp - 1), [
      heroAttack(apocalypse),
    ]);
    expect(finish.session.state.outcome?.result).toBe("win");
  });
});

describe("Dark Beast, staged", () => {
  // MC45 p. 16: Dark Beast I and II in standard mode, II and III in expert mode.
  it.each([
    { expert: false, stages: [0, 1] },
    { expert: true, stages: [1, 2] },
  ])(
    "expert $expert: the stage change brings a new Setting environment, one at a time (45118 to 45120)",
    ({ expert, stages }) => {
      let s = stagedStart({ scenario: "dark-beast", seats: [heroOf(3)], seed: 31, expert });
      expect(s.villains[0]!.stageIndex).toBe(stages[0]);
      expect(settingsInPlay(s)).toHaveLength(1);
      const first = settingsInPlay(s)[0]!;
      const changed = segment(
        "dark-beast",
        `stage ${stages[0]! + 1} defeated`,
        withDamageOn(ready(s), s.villains[0]!.instanceId, 99),
        [heroAttack((st) => st.villains[0]!.instanceId)],
        true,
      );
      s = changed.session.state;
      expect(s.villains[0]!.stageIndex).toBe(stages[1]);
      expect(settingsInPlay(s)).toHaveLength(1);
      expect(settingsInPlay(s)[0], "a new card").not.toBe(first);
      expect(codeOf(s, settingsInPlay(s)[0]!), "from another Setting set").not.toBe(codeOf(s, first));
      // The last stage's defeat wins the game (RRG "Villain Defeat", p. 47).
      const won = segment("dark-beast", "last stage defeated", withDamageOn(ready(s), s.villains[0]!.instanceId, 99), [
        heroAttack((st) => st.villains[0]!.instanceId),
      ]);
      expect(won.session.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    },
  );
});

describe("En Sabah Nur, staged", () => {
  it.each(["A", "B", "C"] as const)("defeated in form %s, stage II keeps the form with no flip (Q16)", (side) => {
    let s = stagedStart({ scenario: "en-sabah-nur", seats: [heroOf(1)], seed: 41 });
    s = { ...s, villains: s.villains.map((v) => ({ ...v, side })) };
    const result = segment(
      "en-sabah-nur",
      `defeated as ${side}`,
      withDamageOn(ready(s), s.villains[0]!.instanceId, 99),
      [heroAttack((st) => st.villains[0]!.instanceId)],
    );
    const after = result.session.state;
    expect(after.villains[0]!.stageIndex).toBe(1);
    expect(after.villains[0]!.side).toBe(side);
    expect(ofType(result.events, "villainFlipped")).toHaveLength(0);
  });

  it("a Technological Interface revealed in Biomorph form flips him to Cyberpath: no reveal of the villain, a power counter (45151)", () => {
    const s0 = stagedStart({ scenario: "en-sabah-nur", seats: [heroOf(2)], seed: 42 });
    const s = stackEncounterDeck(s0, "45151");
    const result = segment("en-sabah-nur", "Technological Interface", ready(s), [endMyTurn]);
    expect(ofType(result.events, "villainFlipped").map((e) => [e.from, e.to])).toContainEqual(["A", "B"]);
  });
});

/**
 * Three Horsemen at 0 hit points (each taken there by a real attack: a state check that passes over a Horseman it
 * cannot defeat is what keeps it watched, so a damage counter set straight to 0 would be a state play cannot reach)
 * and the fourth one hit point from it, the hero ready to attack. Built once.
 */
let fallTogetherCache: { readonly state: GameState; readonly last: InstanceId } | undefined;
function readyToFall(): { readonly state: GameState; readonly last: InstanceId } {
  if (fallTogetherCache) return fallTogetherCache;
  let s = stagedStart({ scenario: "four-horsemen", seats: [heroOf(5)], seed: 51 });
  const [last, ...others] = [...s.villains.map((v) => v.instanceId)].reverse();
  others.forEach((id, i) => {
    const hp = maxHitPoints(s, id, WAVE8_DEPS)!;
    const result = segment(
      "four-horsemen",
      `Horseman ${i + 1} to 0`,
      withDamageOn(ready(s), id, hp - 1),
      [heroAttack(() => id)],
      i === 0,
    );
    s = result.session.state;
    expect(hpLeft(s, id), `Horseman ${i + 1} is at 0 hit points`).toBeLessThanOrEqual(0);
    expect(
      s.villains.filter((v) => v.defeated),
      "nobody defeated yet",
    ).toHaveLength(0);
    expect(s.outcome ?? null).toBeNull();
  });
  const hp = maxHitPoints(s, last!, WAVE8_DEPS)!;
  fallTogetherCache = { state: withDamageOn(ready(s), last!, hp - 1), last: last! };
  return fallTogetherCache;
}

describe("Four Horsemen, staged", () => {
  it("three at 0 stay in play; the fourth's last hit point falls and all four fall together, the players win", () => {
    const { state, last } = readyToFall();
    expect(state.villainRow).toHaveLength(4);
    const result = segment("four-horsemen", "the last hit point", state, [heroAttack(() => last)]);
    expect(result.session.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
    expect(result.session.state.villains.every((v) => v.defeated)).toBe(true);
    expect(ofType(result.events, "characterDefeated")).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Findings (F1 is fixed: its expectation is a passing `it`)
// ---------------------------------------------------------------------------------------------------------------

describe("F1: the Horsemen fall in one step, with no question about who is active next", () => {
  /** The killing blow, then each prompt answered with its first option; what each stop looked like. */
  function killingBlow() {
    const { state, last } = readyToFall();
    const first = sessionApply(startSession(state), heroAttack(() => last)(state), WAVE8_DEPS);
    if (!first.ok) throw new Error(first.error.message);
    const stops: { defeated: number; prompt: string | null; options: number; outcome: boolean }[] = [];
    let session = first.session;
    const stop = () =>
      stops.push({
        defeated: session.state.villains.filter((v) => v.defeated).length,
        prompt: session.state.pendingChoice
          ? `${session.state.pendingChoice.prompt.kind}:${(session.state.pendingChoice.prompt as { slot?: string }).slot}`
          : null,
        options: session.state.pendingChoice?.options.length ?? 0,
        outcome: session.state.outcome !== null,
      });
    stop();
    while (session.state.pendingChoice && stops.length < 8) {
      const choice = session.state.pendingChoice;
      const next = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [choice.options[0]!.optionId],
        },
        WAVE8_DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      session = next.session;
      stop();
    }
    return stops;
  }

  // Expected: 45081 to 45084 "cannot be defeated while another villain has at least 1 hit point", and
  // docs/phase7-wave8.md section 3.9 ("all four are defeated in one step"): once the last hit point falls the four are
  // defeated together, so the one command that deals it ends the game and nobody is asked which Horseman is active
  // next (none will be left). The active counter's holder is always one of the four.
  it("the killing blow ends the game in the same command, with no prompt", () => {
    const stops = killingBlow();
    expect(stops).toEqual([{ defeated: 4, prompt: null, options: 0, outcome: true }]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------------------------------------------

const REQUIRED = [
  "unus.tier0",
  "unus.tier3",
  "unus.tier6",
  "unus.tier9",
  "unus.mainSchemeThreat",
  "four-horsemen.counterMovesRight",
  "four-horsemen.zeroStaysInPlay",
  "four-horsemen.fallTogether",
  "apocalypse.prelateGuards",
  "apocalypse.stage1to2",
  "apocalypse.stage2to3",
  "apocalypse.stage3to4",
  "apocalypse.stageIVLoses",
  "apocalypse.noLongerWorthy",
  "dark-beast.oneSetting",
  "dark-beast.stageBringsNewSetting",
  "dark-beast.attackResolvesSpecial",
  "en-sabah-nur.formChangeNoReveal",
  "en-sabah-nur.powerFourRevealsSuperpower",
  "en-sabah-nur.stageKeepsForm.A",
  "en-sabah-nur.stageKeepsForm.B",
  "en-sabah-nur.stageKeepsForm.C",
];

describe("coverage", () => {
  it("every scenario check was seen at least once, and the row is random by seed", () => {
    const missing = REQUIRED.filter((key) => !seen[key] || seen[key]!.natural.length + seen[key]!.staged.length === 0);
    expect(missing).toEqual([]);
    expect(rowOrders.size, "different seeds seat the Horsemen in different orders").toBeGreaterThan(1);
  });
});
