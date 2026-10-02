/**
 * `MUT_GEN_CAMPAIGN_DEFINITION` (Mutant Genesis, MC32): the definition is well-formed against the real `@mc/content`
 * records, and each node's setup and Victory instructions do what the rulebook prints, driven through the real runner
 * with stand-in game outcomes (`sm.qa.test.ts`'s technique: a finished game's facts are supplied as
 * `CampaignGameResult.records`; deriving them from a real `GameState` is the engine's own job, and the campaign cards
 * (171-195) are not scripted yet, so no real game is played here).
 *
 * Covered: the fixed scenario order and per-node bullets (pinned), roles (distinct choice, role upgrade dealt from the
 * role's own set, role-building), Q12 (a used role upgrade's removal survives a retry, an unused one is redealt), the
 * Future Past composition, Jubilee and the Captive allies carried forward, Rescue Captives' allies removed, expert
 * persistent hit points and the rejoin token, and the expert-only loss of the campaign.
 */
import { describe, expect, it } from "vitest";
import {
  MUT_GEN_CAMPAIGN,
  MUT_GEN_CARDS,
  MUT_GEN_SCENARIOS,
  MUT_GEN_STARTER_DECKS,
  cardId,
  type PlayModes,
} from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
} from "@mc/engine";
import { action } from "../dsl/abilities.js";
import { validateDefinition } from "../dsl/validate.js";
import { WAVE6_CARDS } from "../wave6/index.js";
import { MUT_GEN_CAMPAIGN_DEFINITION } from "./mut_gen.js";

const DEF = MUT_GEN_CAMPAIGN_DEFINITION;
const DEPS: CampaignDeps = { pool: WAVE6_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };

const NODES = ["sabretooth", "project-wideawake", "master-mold", "mansion-attack", "magneto"] as const;

function allInstructions(): readonly CampaignInstruction[] {
  const graph = DEF.graph;
  if (graph.kind !== "linear") throw new Error("expected a linear graph");
  return graph.nodes.flatMap((node) => [
    ...(node.composition ?? []),
    ...node.setup,
    ...node.victory,
    ...(node.defeat ?? []),
  ]);
}

function fieldsIn(value: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.field === "string") found.add(record.field);
    for (const v of Object.values(record)) fieldsIn(v, found);
  }
  return found;
}

describe("MUT_GEN_CAMPAIGN_DEFINITION: structure", () => {
  it("matches the @mc/content campaign record and lists the five scenarios in MC32's fixed order", () => {
    expect(DEF.campaignId).toBe(MUT_GEN_CAMPAIGN.id);
    expect(DEF.graph.kind).toBe("linear");
    if (DEF.graph.kind !== "linear") return;
    expect(DEF.graph.nodes.map((node) => node.id)).toEqual([...NODES]);
    const known = new Set(MUT_GEN_SCENARIOS.map((scenario) => scenario.id as string));
    const scenarioIds = DEF.graph.nodes.map((node) => {
      if (node.scenario.kind !== "fixed") throw new Error(`${node.id}: expected a fixed scenario`);
      expect(known.has(node.scenario.scenarioId as string), node.id).toBe(true);
      return node.scenario.scenarioId as string;
    });
    expect(scenarioIds).toEqual(MUT_GEN_CAMPAIGN.scenarioIds.map((id) => id as string));
  });

  it("every instruction id is unique, prefixed 'mc32.', and cites 'MC32 p. N'", () => {
    const instructions = allInstructions();
    const ids = instructions.map((instruction) => instruction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const instruction of instructions) {
      expect(instruction.id.startsWith("mc32."), instruction.id).toBe(true);
      expect(instruction.citation, instruction.id).toMatch(/^MC32 p\. \d+$/);
    }
    for (const field of DEF.logFields) expect(field.citation, field.id).toMatch(/^MC32 p\. \d+$/);
  });

  it("every field an instruction reads or writes is declared, and every declared field is used", () => {
    const declared = new Set(DEF.logFields.map((field) => field.id));
    const referenced = new Set<string>();
    for (const instruction of allInstructions()) fieldsIn(instruction.step, referenced);
    for (const instruction of allInstructions()) fieldsIn(instruction.when, referenced);
    for (const field of referenced) expect(declared.has(field), field).toBe(true);
    for (const field of declared) expect(referenced.has(field), `${field} is never read or written`).toBe(true);
  });

  it("every in-game instruction passes the DSL validator and the definition round-trips through JSON", () => {
    for (const instruction of allInstructions()) {
      if (instruction.step.kind !== "inGame") continue;
      expect(validateDefinition(action(...instruction.step.effects)), instruction.id).toEqual([]);
    }
    expect(JSON.parse(JSON.stringify(DEF))).toEqual(DEF);
  });

  it("draws role upgrades only from the four role sets, each a real five-card set", () => {
    const roleSets = new Set(MUT_GEN_CAMPAIGN.roles?.map((role) => role.encounterSetId as string));
    const sources: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (record.kind === "campaignSet") sources.push(record.encounterSetId as string);
        Object.values(record).forEach(walk);
      }
    };
    allInstructions().forEach((instruction) => walk(instruction.step));
    expect([...new Set(sources)].sort()).toEqual([...roleSets].sort());
    for (const setId of roleSets) {
      const cards = MUT_GEN_CARDS.filter((card) => "specificTo" in card && card.specificTo?.encounterSetId === setId);
      expect(cards, setId).toHaveLength(5);
    }
  });

  it("lists exactly the printed bullets of each scenario, in printed order", () => {
    if (DEF.graph.kind !== "linear") throw new Error("expected a linear graph");
    const listed = Object.fromEntries(
      DEF.graph.nodes.map((node) => [
        node.id,
        {
          setup: node.setup.map((instruction) => instruction.id),
          victory: node.victory.map((instruction) => instruction.id),
          defeat: (node.defeat ?? []).map((instruction) => instruction.id),
        },
      ]),
    );
    const common = (n: number, gate: string) => [
      `mc32.s${n}.setup.future-past`,
      `mc32.s${n}.setup.role-upgrade-draw`,
      `mc32.s${n}.setup.role-upgrade`,
      `mc32.s${n}.setup.role-building`,
      gate,
      `mc32.s${n}.setup.hp-set`,
      `mc32.s${n}.setup.heal`,
    ];
    const carried = (n: number) => [`mc32.s${n}.setup.jubilee`, `mc32.s${n}.setup.captives`];
    const futureAndRoles = (n: number) => [
      `mc32.s${n}.victory.future-past-display`,
      `mc32.s${n}.victory.future-past`,
      `mc32.s${n}.victory.role-upgrades`,
    ];
    expect(listed).toEqual({
      sabretooth: {
        setup: [
          "mc32.s1.setup.identity",
          "mc32.s1.setup.roles",
          "mc32.s1.setup.role-upgrade-draw",
          "mc32.s1.setup.role-upgrade",
          "mc32.s1.setup.role-building",
          "mc32.s1.setup.future-past",
          "mc32.s1.setup.frightened-police",
        ],
        victory: ["mc32.s1.victory.frightened-police", ...futureAndRoles(1), "mc32.s1.victory.hp"],
        defeat: [],
      },
      "project-wideawake": {
        setup: common(2, "mc32.s2.setup.enemy-of-my-enemy"),
        victory: [
          "mc32.s2.victory.enemy-of-my-enemy",
          ...futureAndRoles(2),
          "mc32.s2.victory.jubilee",
          "mc32.s2.victory.captives",
          "mc32.s2.victory.hp",
        ],
        defeat: [],
      },
      "master-mold": {
        setup: ["mc32.s3.setup.future-past", ...carried(3), ...common(3, "mc32.s3.setup.find-the-prisoners").slice(1)],
        victory: [
          "mc32.s3.victory.find-the-prisoners",
          ...futureAndRoles(3),
          "mc32.s3.victory.jubilee",
          "mc32.s3.victory.held-allies",
          "mc32.s3.victory.held-allies-remove",
          "mc32.s3.victory.hp",
        ],
        defeat: [],
      },
      "mansion-attack": {
        setup: ["mc32.s4.setup.future-past", ...carried(4), ...common(4, "mc32.s4.setup.surprise-attack").slice(1)],
        victory: [
          "mc32.s4.victory.surprise-attack",
          ...futureAndRoles(4),
          "mc32.s4.victory.jubilee",
          "mc32.s4.victory.hp",
        ],
        defeat: [],
      },
      magneto: {
        setup: ["mc32.s5.setup.future-past", ...carried(5), ...common(5, "mc32.s5.setup.magnetos-fortress").slice(1)],
        victory: ["mc32.s5.victory.win"],
        defeat: ["mc32.s5.defeat.lose-campaign"],
      },
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The runner, node by node, with stand-in game outcomes
// ---------------------------------------------------------------------------------------------------------------

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no mut_gen starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [seatFor("colossus-protection", 1), seatFor("shadowcat-aggression", 2)];

/** Answers every pending choice with `pick`, recording what was asked. Throws if a step list never settles. */
function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}

/** Seat 1 takes Brawler, seat 2 Defender; every optional choice (role-building, deck shuffles) is declined. */
const PLAN: Record<number, string> = { 1: "brawler", 2: "defender" };
const pickRoles = (choice: CampaignPendingChoice): readonly string[] =>
  choice.slot === "role" ? [PLAN[choice.seatNumber ?? 0] ?? choice.options[0]!] : [];

const futurePastCardIds = MUT_GEN_CARDS.filter(
  (card) => "encounterSetIds" in card && card.encounterSetIds.includes("future_past" as never),
).map((card) => card.id as string);

function newLog(modes: PlayModes, seed = 4242): CampaignLog {
  return createCampaignLog(DEF, { id: `mut-gen-${seed}`, seats: SEATS, modes, poolVersion: "qa-test", seed });
}

function compose(log: CampaignLog) {
  const composed = settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pickRoles);
  return { log: composed.value, asked: composed.asked, start: startGameFromLog(DEF, composed.value) };
}

function finish(composed: CampaignLog, result: CampaignGameResult): CampaignLog {
  return settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    () => [],
  ).value;
}

function outcome(nodeId: string, won: boolean, extra: Partial<CampaignGameResult> = {}): CampaignGameResult {
  return {
    nodeId,
    outcome: won ? "won" : "lost",
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
    ...extra,
  };
}

const flagWrite = (instructionId: string, field: string, value: boolean) => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set" as const, value: { kind: "flag" as const, value } },
});
const listWrite = (instructionId: string, field: string, ids: readonly string[]) => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set" as const, value: { kind: "cardList" as const, cardIds: ids as never } },
});

const roleUpgradeOf = (log: CampaignLog, seatIndex: number): string | undefined => {
  const value = log.seats[seatIndex]?.fields.roleUpgrade;
  return value?.kind === "cardRef" && value.cardId !== "" ? (value.cardId as string) : undefined;
};
const setOfCard = (id: string): string | undefined => {
  const card = MUT_GEN_CARDS.find((candidate) => (candidate.id as string) === id);
  return card && "specificTo" in card ? (card.specificTo?.encounterSetId as string | undefined) : undefined;
};
const ids = (start: ReturnType<typeof compose>["start"]): readonly string[] =>
  start.input.instructions.map((instruction) => instruction.instructionId);

describe("MUT_GEN_CAMPAIGN_DEFINITION: scenario 1 (Sabretooth, MC32 p. 7)", () => {
  it("each player chooses a different role, draws an upgrade from their own role's set, and sets up Future Past", () => {
    const { log, asked, start } = compose(newLog(STANDARD));
    const roleChoices = asked.filter((choice) => choice.slot === "role");
    expect(roleChoices.map((choice) => choice.options)).toEqual([
      ["brawler", "commander", "defender", "peacekeeper"],
      ["commander", "defender", "peacekeeper"], // seat 2 cannot take Brawler: "Each player must choose a different role"
    ]);
    expect(log.seats.map((seat) => seat.fields.role)).toEqual([
      { kind: "choice", option: "brawler" },
      { kind: "choice", option: "defender" },
    ]);
    // Role-building is offered to each seat (one event and one upgrade), and declined by the script.
    expect(asked.filter((choice) => choice.slot === "roleEvent" || choice.slot === "roleUpgradeCard")).toHaveLength(4);
    expect(setOfCard(roleUpgradeOf(log, 0)!)).toBe("brawler");
    expect(setOfCard(roleUpgradeOf(log, 1)!)).toBe("defender");
    expect([...start.input.setAsideCards!].sort()).toEqual([roleUpgradeOf(log, 0)!, roleUpgradeOf(log, 1)!].sort());
    expect(start.encounterSets.setAside).toEqual(expect.arrayContaining(["future_past", "mut_gen_campaign"]));
    expect(ids(start)).toEqual([
      "mc32.s1.setup.role-upgrade",
      "mc32.s1.setup.future-past",
      "mc32.s1.setup.frightened-police",
    ]);
  });

  it("role-building grants the chosen event and upgrade for this game only", () => {
    const base = newLog(STANDARD);
    const composed = settleBy(
      (answers) => resolveBetweenGames(DEF, base, DEPS, base.modes, answers),
      (choice) => {
        if (choice.slot === "role") return pickRoles(choice);
        if (choice.seatNumber === 1 && (choice.slot === "roleEvent" || choice.slot === "roleUpgradeCard")) {
          expect(choice.options.length, choice.slot).toBeGreaterThan(0);
          return [choice.options[0]!];
        }
        return [];
      },
    ).value;
    const grants = composed.attempt!.input.seats[0]!.grantedCardIds;
    expect(grants).toHaveLength(2);
    const categories = grants.map((id) => WAVE6_CARDS.find((card) => card.id === id)?.type).sort();
    expect(categories).toEqual(["event", "upgrade"]);
    expect(composed.attempt!.input.seats[1]!.grantedCardIds).toEqual([]);
    const won = finish(composed, outcome("sabretooth", true, { expiringGrants: [...grants] }));
    expect(won.seats[0]!.grants).toEqual([]); // MC32 p. 5: "for that game"
  });

  it("Victory records Frightened Police, removes the upgrade that began in play and the Future Past cards in the victory display", () => {
    const { log: composed } = compose(newLog(STANDARD));
    const upgrades = [roleUpgradeOf(composed, 0)!, roleUpgradeOf(composed, 1)!];
    const stray = futurePastCardIds[0]!;
    const log = finish(
      composed,
      outcome("sabretooth", true, {
        records: [
          flagWrite("mc32.s1.victory.frightened-police", "frightenedPolice", true),
          listWrite("mc32.s1.victory.future-past-display", "futurePastVictoryDisplay", [stray]),
        ],
      }),
    );
    expect(log.position.nextNodeId).toBe("project-wideawake");
    expect(log.shared.frightenedPolice).toEqual({ kind: "flag", value: true });
    const removed = log.removedFromCampaign.map((face) => face.cardId as string);
    expect(removed).toEqual(expect.arrayContaining([...upgrades, stray]));
    expect(roleUpgradeOf(log, 0)).toBeUndefined();
    expect(roleUpgradeOf(log, 1)).toBeUndefined();
  });
});

describe("MUT_GEN_CAMPAIGN_DEFINITION: the walk (standard campaign)", () => {
  it("plays all five scenarios, with a lost-and-retried Project Wideawake that keeps the log", () => {
    let log = newLog(STANDARD);
    const first = compose(log);
    const upgrade1 = [roleUpgradeOf(first.log, 0)!, roleUpgradeOf(first.log, 1)!];
    log = finish(
      first.log,
      outcome("sabretooth", true, {
        records: [flagWrite("mc32.s1.victory.frightened-police", "frightenedPolice", true)],
      }),
    );
    const rolesAfterOne = log.seats.map((seat) => seat.fields.role);
    expect(rolesAfterOne).toEqual([
      { kind: "choice", option: "brawler" },
      { kind: "choice", option: "defender" },
    ]);

    // Scenario 2, lost. Frightened Police was defeated, so each player takes a new upgrade (MC32 p. 10) and the retry
    // keeps the role, the flag and the removal of scenario 1's upgrades.
    const second = compose(log);
    expect(ids(second.start)).toContain("mc32.s2.setup.role-upgrade");
    expect(ids(second.start)).toContain("mc32.s2.setup.future-past");
    const used = roleUpgradeOf(second.log, 0)!;
    expect(upgrade1).not.toContain(used); // the pool shrank: scenario 1's removed upgrade is not dealt again
    expect(second.asked.filter((choice) => choice.slot === "role")).toHaveLength(0); // roles are chosen once, in scenario 1

    // Q12: the used upgrade removed itself in game (its own "Remove this card from the game and the campaign pool");
    // the unused one is not removed. Both facts survive the loss.
    log = finish(second.log, outcome("project-wideawake", false, { removedFromCampaign: [{ cardId: cardId(used) }] }));
    expect(log.position.nextNodeId).toBe("project-wideawake");
    expect(log.history.at(-1)?.outcome).toBe("lost");
    expect(log.shared.frightenedPolice).toEqual({ kind: "flag", value: true });
    expect(log.seats.map((seat) => seat.fields.role)).toEqual(rolesAfterOne);
    expect(log.removedFromCampaign.map((face) => face.cardId as string)).toEqual(
      expect.arrayContaining([...upgrade1, used]),
    );

    // The retry is composed from that log: the removed upgrade is never dealt again; the unused one is redealt.
    const retry = compose(log);
    expect(roleUpgradeOf(retry.log, 0)).not.toBe(used);
    expect(setOfCard(roleUpgradeOf(retry.log, 0)!)).toBe("brawler");
    expect(roleUpgradeOf(retry.log, 1)).toBeDefined();
    expect(retry.start.input.removedFromCampaign.map((face) => face.cardId as string)).toContain(used);
    expect(ids(retry.start)).toContain("mc32.s2.setup.role-upgrade");

    // Scenario 2, won: Enemy of My Enemy defeated, Jubilee in play, two Captive allies entered play.
    log = finish(
      retry.log,
      outcome("project-wideawake", true, {
        records: [
          flagWrite("mc32.s2.victory.enemy-of-my-enemy", "enemyOfMyEnemy", true),
          flagWrite("mc32.s2.victory.jubilee", "jubilee", true),
          listWrite("mc32.s2.victory.captives", "captives", ["32089", "32091"]),
        ],
      }),
    );
    expect(log.position.nextNodeId).toBe("master-mold");
    expect(log.shared.jubilee).toEqual({ kind: "flag", value: true });
    expect(log.shared.captives).toEqual({ kind: "cardList", cardIds: ["32089", "32091"] });

    // Scenario 3: Jubilee and the recorded Captive allies are set aside and offered; Enemy of My Enemy earns upgrades.
    const third = compose(log);
    expect(third.start.input.setAsideCards).toEqual(expect.arrayContaining(["32088b", "32089", "32091"]));
    expect(third.start.input.setAsideCards).not.toContain("32090");
    expect(ids(third.start)).toEqual(
      expect.arrayContaining(["mc32.s3.setup.jubilee", "mc32.s3.setup.captives", "mc32.s3.setup.role-upgrade"]),
    );
    const heldAlly = "01009";
    log = finish(
      third.log,
      outcome("master-mold", true, {
        records: [
          flagWrite("mc32.s3.victory.find-the-prisoners", "findThePrisoners", true),
          flagWrite("mc32.s3.victory.jubilee", "jubilee", false), // MC32 p. 12: not in play, so removed from the log
          listWrite("mc32.s3.victory.held-allies", "heldAllies", [heldAlly]),
        ],
      }),
    );
    expect(log.shared.jubilee).toEqual({ kind: "flag", value: false });
    expect(log.removedFromCampaign.map((face) => face.cardId as string)).toContain(heldAlly);

    // Scenario 4: Jubilee is gone, Find the Prisoners earns upgrades; the Surprise Attack flag is recorded.
    const fourth = compose(log);
    expect(fourth.start.input.setAsideCards).not.toContain("32088b");
    expect(ids(fourth.start)).not.toContain("mc32.s4.setup.jubilee");
    expect(ids(fourth.start)).toContain("mc32.s4.setup.role-upgrade");
    log = finish(
      fourth.log,
      outcome("mansion-attack", true, {
        records: [flagWrite("mc32.s4.victory.surprise-attack", "surpriseAttack", false)],
      }),
    );
    expect(log.shared.surpriseAttack).toEqual({ kind: "flag", value: false });

    // Scenario 5: Surprise Attack was not defeated, so no upgrades are dealt (role-building is still offered).
    const fifth = compose(log);
    expect(ids(fifth.start)).not.toContain("mc32.s5.setup.role-upgrade");
    expect(fifth.asked.some((choice) => choice.slot === "roleEvent")).toBe(true);
    expect(roleUpgradeOf(fifth.log, 0)).toBeUndefined();
    expect(ids(fifth.start)).toContain("mc32.s5.setup.magnetos-fortress");
    log = finish(fifth.log, outcome("magneto", true));
    expect(log.status).toBe("won");
    expect(log.position.nextNodeId).toBeNull();
    expect(log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "sabretooth:won",
      "project-wideawake:lost",
      "project-wideawake:won",
      "master-mold:won",
      "mansion-attack:won",
      "magneto:won",
    ]);
  });

  it("an unused role upgrade is redealt on a retry, and nothing of the lost game's grants stays", () => {
    const first = compose(newLog(STANDARD));
    const unused = roleUpgradeOf(first.log, 0)!;
    const log = finish(first.log, outcome("sabretooth", false));
    expect(log.position.nextNodeId).toBe("sabretooth");
    expect(log.removedFromCampaign).toEqual([]);
    const retry = compose(log);
    const redealt = roleUpgradeOf(retry.log, 0)!;
    expect(setOfCard(redealt)).toBe("brawler");
    expect(log.removedFromCampaign.map((face) => face.cardId as string)).not.toContain(unused);
    // The retry is a fresh scenario 1: roles are chosen again from all four (nothing was struck by the lost game).
    expect(retry.asked.filter((choice) => choice.slot === "role")[0]?.options).toHaveLength(4);
  });
});

describe("MUT_GEN_CAMPAIGN_DEFINITION: expert campaign (MC32 p. 5)", () => {
  it("records remaining hit points after a win and restores them, with a token to heal, at the next setup", () => {
    const first = compose(newLog(EXPERT));
    expect(ids(first.start)).not.toContain("mc32.s1.setup.hp-set");
    const log = finish(
      first.log,
      outcome("sabretooth", true, {
        records: [
          {
            instructionId: "mc32.s1.victory.hp",
            write: {
              field: "remainingHp",
              seatNumber: 1,
              mode: "set" as const,
              value: { kind: "number" as const, value: 6 },
            },
          },
          {
            instructionId: "mc32.s1.victory.hp",
            write: {
              field: "remainingHp",
              seatNumber: 2,
              mode: "set" as const,
              value: { kind: "number" as const, value: 0 },
            },
          },
        ],
      }),
    );
    expect(log.seats.map((seat) => seat.fields.remainingHp)).toEqual([
      { kind: "number", value: 6 },
      { kind: "number", value: 0 },
    ]);
    const second = compose(log);
    expect(ids(second.start)).toEqual(expect.arrayContaining(["mc32.s2.setup.hp-set", "mc32.s2.setup.heal"]));
    // The standard campaign skips both.
    const standard = compose(finish(compose(newLog(STANDARD)).log, outcome("sabretooth", true)));
    expect(ids(standard.start)).not.toContain("mc32.s2.setup.hp-set");
    expect(ids(standard.start)).not.toContain("mc32.s2.setup.heal");
  });

  it("losing Magneto loses the campaign in an expert campaign and only retries in a standard one", () => {
    const winThrough = (modes: PlayModes): CampaignLog => {
      let log = newLog(modes);
      for (const node of NODES.slice(0, 4)) log = finish(compose(log).log, outcome(node, true));
      return log;
    };
    const expert = finish(compose(winThrough(EXPERT)).log, outcome("magneto", false));
    expect(expert.status).toBe("lost");
    expect(expert.position.nextNodeId).toBeNull();
    const standard = finish(compose(winThrough(STANDARD)).log, outcome("magneto", false));
    expect(standard.status).toBe("active");
    expect(standard.position.nextNodeId).toBe("magneto");
  });
});

describe("MUT_GEN_CAMPAIGN_DEFINITION: known gaps", () => {
  it.todo(
    "Victory's 'Add each Future Past card found in the encounter deck, discard pile, and in play to the campaign log' (MC32 pp. 7/10/12/16): needs a CampaignGameQuery over the encounter deck and discard pile",
  );
  it.todo(
    "role-building skips a card the seat's deck already includes (MC32 p. 5): needs a CollectionFilter 'not in own deck'",
  );
});
