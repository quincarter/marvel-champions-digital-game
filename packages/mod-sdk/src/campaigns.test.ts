import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, type PackManifest } from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignGameResult,
} from "@mc/engine";
import { buildPack } from "./build.js";
import { PLAYABLE_DEPS } from "@mc/cards";
import type { PackCampaign } from "./campaigns.js";
import { SUPPORTED_DSL_FEATURES, campaignDefinitionsOf, dslFeatures } from "./features.js";
import {
  campaignDepsWithPacks,
  gameDepsWithPack,
  packCampaignDefinitionOf,
  packCampaignDefinitions,
  packCampaignRecords,
} from "./game.js";
import { playCampaign, smokeTestPack } from "./smoke.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";

/**
 * Pack campaigns (docs/custom-content-packs.md §11.10) on the sample scenario pack's "Clockwork Crisis": built and
 * validated, each rule of validation broken one at a time, the features it declares, the seams a client lists it by,
 * and a headless run through the real campaign runner.
 */
const SAMPLE_DIR = fileURLToPath(new URL("../../../content-packs/sample-scenario", import.meta.url));
const CAMPAIGN = "sample-scenario-crisis";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

let outDir: string;
let pack: PackInput;
beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-sample-campaign-"));
  await buildPack(SAMPLE_DIR, outDir);
  const manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
  }
  pack = readPackInput(manifest, files);
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** The pack with its campaign changed (`campaigns[0]`) or replaced; hash and size issues are filtered out. */
function issuesWith(change: (campaign: any, copy: { scenarios: any[] }) => void, extra: object = {}): string {
  const campaigns = structuredClone(pack.campaigns ?? []) as any[];
  const scenarios = structuredClone(pack.scenarios ?? []) as any[];
  change(campaigns[0], { scenarios });
  const input = { ...pack, campaigns, scenarios, ...extra } as unknown as PackInput;
  return validatePack(input)
    .filter(
      (issue) =>
        !/sha256|size is|listed in pack.json|not listed|totalBytes|dslFeatures/.test(issue.message + issue.path),
    )
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
}

describe("the sample pack's campaign", () => {
  it("builds, validates and lists as a pack campaign with its content record and story", () => {
    expect(validatePack(pack)).toEqual([]);
    expect(pack.manifest.contents.campaigns).toBe("data/campaigns.json");
    const [campaign] = packCampaignRecords([pack]);
    expect(campaign?.id).toBe(CAMPAIGN);
    expect(campaign?.name).toBe("Clockwork Crisis");
    expect(campaign?.record.scenarioIds).toEqual(["sample-scenario-clockwork", "rhino"]);
    expect(campaign?.story?.issues?.map((issue) => issue.nodeId)).toEqual(["clockmaker", "street-fight"]);
    expect(packCampaignDefinitionOf([pack], CAMPAIGN)?.campaignId).toBe(CAMPAIGN);
    expect(packCampaignDefinitionOf([pack], "nope")).toBeUndefined();
    expect(Object.keys(packCampaignDefinitions([pack]))).toEqual([CAMPAIGN]);
  });

  it("declares the features its instructions use, all ones this game version has", () => {
    const declared = pack.manifest.requires.dslFeatures;
    expect(declared).toContain("campaign:setField");
    expect(declared).toContain("campaign:addToField");
    expect(declared).toContain("campaign-graph:linear");
    expect(declared).toContain("campaign-field:flag");
    expect(declared).toContain("campaign-window:afterScenarioSetup");
    expect(declared).toContain("expr:campaignLog");
    expect(dslFeatures(pack.abilities, campaignDefinitionsOf(pack.campaigns))).toEqual(declared);
    for (const feature of declared) expect(SUPPORTED_DSL_FEATURES, feature).toContain(feature);
    // The abilities alone no longer account for them: a manifest that left the campaign out is refused.
    const stale = structuredClone(pack.manifest) as any;
    stale.requires.dslFeatures = [...dslFeatures(pack.abilities)];
    expect(validatePack({ ...pack, manifest: stale }).map((issue) => issue.message)).toContainEqual(
      expect.stringMatching(/must list exactly the features/),
    );
  });

  it("hands the client the campaign runner's card pool with the pack's cards added", () => {
    const deps = campaignDepsWithPacks(PLAYABLE_CARDS, [pack]);
    expect((deps.pool as readonly unknown[]).length).toBe(PLAYABLE_CARDS.length + pack.cards.length);
  });

  it("writes the log between games and freezes it into the next game's input, where its setup reads it", () => {
    const definition = packCampaignDefinitionOf([pack], CAMPAIGN)!;
    const deps = campaignDepsWithPacks(PLAYABLE_CARDS, [pack]);
    const starter = CORE_STARTER_DECKS.find((deck) => String(deck.id) === "core-spider-man-justice")!;
    const settle = <T>(run: () => { kind: string; value?: T }): T => {
      const result = run();
      if (result.kind !== "done") throw new Error("the runner asked a question");
      return result.value as T;
    };
    let log = createCampaignLog(definition, {
      id: "t",
      seats: [
        {
          seatNumber: 1,
          identityCardId: starter.identityCardId,
          deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
        },
      ],
      modes: { campaign: { campaignId: definition.campaignId } },
      poolVersion: "t",
      seed: 7,
    });
    const first = settle(() => resolveBetweenGames(definition, log, deps, log.modes, []));
    expect(startGameFromLog(definition, first).input.instructions).toEqual([]);
    const won: CampaignGameResult = {
      nodeId: "clockmaker",
      outcome: "won",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    log = settle(() => applyCampaignResult(definition, first, won, { at: 1 }, deps, []));
    expect(log.shared.cogs).toMatchObject({ kind: "number", value: 1 });
    expect(log.shared.stopped).toMatchObject({ kind: "flag", value: true });
    const second = startGameFromLog(
      definition,
      settle(() => resolveBetweenGames(definition, log, deps, log.modes, [])),
    );
    expect(second.nodeId).toBe("street-fight");
    expect(second.input.log.shared.cogs).toMatchObject({ value: 1 });
    expect(second.input.instructions.map((i) => i.instructionId)).toEqual(["crisis.s2.setup.cogs"]);
  });

  it("plays headlessly through the real campaign runner: every node, to an outcome, with log fields written", () => {
    const result = smokeTestPack(pack, { games: 2 });
    const played = result.games.filter((game) => game.campaign === CAMPAIGN);
    expect(played.filter((game) => !game.ok).map((game) => game.error)).toEqual([]);
    expect(new Set(played.map((game) => game.node))).toEqual(new Set(["clockmaker", "street-fight"]));
    expect(played.every((game) => game.outcome !== undefined)).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("validatePack: campaigns", () => {
  it("is clean as it is", () => {
    expect(issuesWith(() => {})).toBe("");
  });

  it("holds the id rules: the pack's prefix, not a base campaign, one per campaign, definition and version agreeing", () => {
    expect(issuesWith((c) => (c.id = "other-crisis"))).toMatch(/campaign id must be "sample-scenario-<name>"/);
    expect(issuesWith((c) => (c.id = "sample-scenario-"))).toMatch(/campaign id must be/);
    expect(issuesWith((c) => (c.definition.campaignId = "sample-scenario-else"))).toMatch(
      /definition.campaignId must equal/,
    );
    expect(issuesWith((c) => (c.version = "2"))).toMatch(/definition.version must equal/);
    expect(issuesWith((c) => (c.name = ""))).toMatch(/name must be a non-empty string/);
    const twice = issuesWith(() => {}, { campaigns: [...(pack.campaigns ?? []), ...(pack.campaigns ?? [])] });
    expect(twice).toMatch(/used by two campaigns/);
  });

  it("refuses a base campaign's id", () => {
    const campaigns = [{ ...(pack.campaigns?.[0] as object), id: "trors" }];
    const issues = validatePack({ ...pack, campaigns } as unknown as PackInput).map((issue) => issue.message);
    expect(issues.join("\n")).toMatch(/base-game campaign id/);
  });

  it("holds every instruction, log field and node id unique", () => {
    expect(issuesWith((c) => c.definition.logFields.push({ ...c.definition.logFields[0] }))).toMatch(
      /log field id "cogs" is used twice/,
    );
    expect(
      issuesWith((c) => (c.definition.graph.nodes[1].victory[0].id = c.definition.graph.nodes[0].victory[0].id)),
    ).toMatch(/is used twice/);
    expect(issuesWith((c) => (c.definition.graph.nodes[1].id = "clockmaker"))).toMatch(
      /node id "clockmaker" is used twice/,
    );
  });

  it("holds every field an instruction reads or writes to be declared", () => {
    expect(issuesWith((c) => (c.definition.graph.nodes[1].victory[0].step.ops[0].field = "nope"))).toMatch(
      /reads or writes log field "nope", which is not declared/,
    );
    expect(issuesWith((c) => (c.definition.graph.nodes[1].setup[0].step.effects[0].condition.field = "nope"))).toMatch(
      /log field "nope"/,
    );
  });

  it("resolves conditional instruction keys and fixed scenarios (pack, base or required pack)", () => {
    expect(
      issuesWith((c) => {
        c.definition.conditionalInstructions = { wrong: { ...c.definition.graph.nodes[1].victory[0] } };
      }),
    ).toMatch(/conditionalInstructions key "wrong"/);
    expect(
      issuesWith((c) => {
        c.definition.graph.nodes[1].scenario.scenarioId = "no-such-scenario";
        c.record.scenarioIds[1] = "no-such-scenario";
      }),
    ).toMatch(/scenario "no-such-scenario" is not a scenario the game has/);
    const required = pack.scenarios?.[0] as any;
    const borrowed = issuesWithRequired(
      (c) => {
        c.definition.graph.nodes[1].scenario.scenarioId = "friend-scenario";
        c.record.scenarioIds[1] = "friend-scenario";
      },
      [{ ...required, id: "friend-scenario" }],
    );
    expect(borrowed).toBe("");
  });

  it("checks every in-game effect with the DSL's validator", () => {
    expect(
      issuesWith((c) =>
        c.definition.graph.nodes[1].setup[0].step.effects.push({ kind: "dealDamage", target: undefined }),
      ),
    ).toMatch(/instruction "crisis.s2.setup.cogs"/);
    expect(issuesWith((c) => (c.definition.graph.nodes[1].scenarioRuleSpecs = [{ kind: "noSuchRule" }]))).not.toBe("");
    expect(issuesWith((c) => (c.definition.graph.nodes[1].scenarioRuleSpecs = "x"))).toMatch(
      /scenarioRuleSpecs must be a list/,
    );
  });

  it("holds the content record to the definition", () => {
    expect(issuesWith((c) => (c.record.scenarioIds = ["rhino"]))).toMatch(/record.scenarioIds must list the nodes'/);
    expect(issuesWith((c) => (c.record.campaignSetIds = ["sample-scenario-nope"]))).toMatch(
      /"sample-scenario-nope" is not an encounter set of this pack/,
    );
    expect(issuesWith((c) => (c.record.campaignSetIds = ["standard"]))).toMatch(/is a base-game set/);
    expect(
      issuesWith((c) => {
        c.definition.graph.nodes[0].victory[0].step = {
          kind: "betweenGames",
          ops: [
            {
              kind: "choose",
              slot: "x",
              chooser: "group",
              from: { kind: "campaignSet", encounterSetId: "sample-scenario-gears" },
            },
          ],
        };
      }),
    ).toMatch(/draws from "sample-scenario-gears", which is not in record.campaignSetIds/);
  });

  it("is plain JSON", () => {
    expect(
      issuesWith((c) => {
        c.definition.logFields[0].label = undefined;
        c.definition.logFields[0].type.min = Number.NaN;
      }),
    ).toMatch(/must be plain JSON/);
  });

  it("checks the story's node ids and speakers, and the art's file", () => {
    expect(issuesWith((c) => (c.story.issues[0].nodeId = "nowhere"))).toMatch(/names node "nowhere"/);
    expect(issuesWith((c) => c.story.issues.push({ ...c.story.issues[0] }))).toMatch(/two issues for node/);
    expect(issuesWith((c) => (c.story.issues[0].briefing.speaker = { kind: "hero" }))).toMatch(
      /narrator \| villain \| npc/,
    );
    expect(issuesWith((c) => (c.story.blurb = ""))).toMatch(/story.blurb/);
    expect(issuesWith((c) => (c.art = { cover: "art/cover.webp" }))).toMatch(/not a listed file/);
    expect(issuesWith((c) => (c.art = { cover: "../x.webp" }))).toMatch(/art must be/);
  });

  describe("the first version's limits", () => {
    it("allows a linear graph of fixed scenarios only", () => {
      expect(issuesWith((c) => (c.definition.graph.kind = "choice"))).toMatch(/graph must be "linear"/);
      expect(issuesWith((c) => (c.definition.graph.nodes[0].scenario = { kind: "composed" }))).toMatch(
        /scenario must be "fixed"/,
      );
      expect(
        issuesWith((c) => (c.definition.graph.nodes[0].composition = [c.definition.graph.nodes[0].victory[0]])),
      ).toMatch(/composition .* is not available yet/);
      expect(issuesWith((c) => (c.definition.graph.nodes[0].requiredModularSetIds = ["standard"]))).toMatch(
        /requiredModularSetIds is not available yet/,
      );
    });

    it("leaves out a market (spend, a Unit Cost filter) and a log field gated by modes", () => {
      expect(
        issuesWith((c) =>
          c.definition.graph.nodes[0].victory[0].step.ops.push({
            kind: "spend",
            field: "cogs",
            seat: "self",
            amount: { kind: "const", value: 1 },
          }),
        ),
      ).toMatch(/spending a currency/);
      expect(
        issuesWith((c) =>
          c.definition.graph.nodes[0].victory[0].step.ops.push({
            kind: "choose",
            slot: "m",
            chooser: "group",
            from: { kind: "collection", filter: { unitCostExactly: 1 } },
          }),
        ),
      ).toMatch(/Unit Cost filter/);
      expect(issuesWith((c) => (c.definition.logFields[0].whenModes = { expert: true }))).toMatch(/whenModes/);
    });

    it("leaves out expert campaign rules and an elimination policy", () => {
      expect(issuesWith((c) => (c.definition.graph.nodes[0].victory[0].whenModes = { expertCampaign: true }))).toMatch(
        /expertCampaign is not available yet/,
      );
      expect(issuesWith((c) => (c.definition.elimination = { id: "e", text: "e", citation: "e" }))).toMatch(
        /elimination policy is not available yet/,
      );
    });
  });
});

/** `issuesWith`, with another pack's scenarios made known as a required pack's. */
function issuesWithRequired(change: (campaign: any) => void, scenarios: object[]): string {
  const campaigns = structuredClone(pack.campaigns ?? []) as any[];
  change(campaigns[0]);
  return validatePack({ ...pack, campaigns } as unknown as PackInput, {
    requiredPackContent: { cards: [], encounterSets: [], scenarios: scenarios as never },
  })
    .filter(
      (issue) =>
        !/sha256|size is|listed in pack.json|not listed|totalBytes|dslFeatures/.test(issue.message + issue.path),
    )
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
}

/** The first node's victory block, whose between-games ops a test adds to. */
const victoryOps = (c: any): any[] => c.definition.graph.nodes[0].victory[0].step.ops;
const addField = (c: any, field: any): void =>
  void c.definition.logFields.push({ scope: "shared", citation: "t", ...field });
const doom = {
  id: "crisis.s1.setup.doom",
  text: "Place 99 threat on the main scheme.",
  citation: "test",
  step: {
    kind: "inGame",
    window: "afterScenarioSetup",
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 99 } }],
  },
};

describe("validatePack: campaigns the runner would throw on", () => {
  it("checks each write's mode against its field's type", () => {
    expect(
      issuesWith((c) =>
        victoryOps(c).push({ kind: "appendToList", field: "stopped", value: { kind: "const", value: "x" } }),
      ),
    ).toMatch(/appendToList needs a cardList, instructionList or strikeList field, "stopped" is flag/);
    expect(
      issuesWith((c) =>
        victoryOps(c).push({ kind: "addToField", field: "stopped", value: { kind: "const", value: 1 } }),
      ),
    ).toMatch(/addToField needs a number field, "stopped" is a flag field/);
    expect(
      issuesWith((c) => victoryOps(c).push({ kind: "strike", field: "cogs", option: { kind: "const", value: "x" } })),
    ).toMatch(/strike needs a strikeList field, "cogs" is a number field/);
    const record = (mode: string, field: string) => (c: any) => {
      c.definition.graph.nodes[0].victory[0].step = {
        kind: "record",
        writes: [{ field, mode, value: { kind: "countersOn", query: {}, counter: "x" } }],
      };
    };
    expect(issuesWith(record("append", "cogs"))).toMatch(
      /an append write needs a list field, "cogs" is a number field/,
    );
    expect(issuesWith(record("add", "stopped"))).toMatch(/an add write needs a number field/);
    expect(issuesWith(record("strike", "cogs"))).toMatch(/a strike write needs a strikeList field/);
    expect(issuesWith(record("mash", "cogs"))).toMatch(/unknown mode "mash"/);
  });

  it("refuses between-games writes to a cardState field", () => {
    const cardState = (c: any) =>
      addField(c, { id: "board", label: "Board", type: { kind: "cardState", cardIds: ["01001"] } });
    expect(
      issuesWith((c) => {
        cardState(c);
        victoryOps(c).push({ kind: "setField", field: "board", value: { kind: "const", value: "x" } });
      }),
    ).toMatch(/setField writes cardState field "board"/);
    expect(
      issuesWith((c) => {
        cardState(c);
        c.definition.graph.nodes[0].victory[0].step = {
          kind: "record",
          writes: [{ field: "board", mode: "set", value: { kind: "countersOn", query: {}, counter: "x" } }],
        };
      }),
    ).toMatch(/cardState field "board" can only be set from a cardStateOf query/);
  });

  it("validates card choices, and checks every card of a choice that reaches a grant", () => {
    const choose = (from: any, grant: boolean) => (c: any) => {
      victoryOps(c).push({ kind: "choose", slot: "pick", chooser: "group", from });
      if (grant)
        victoryOps(c).push({
          kind: "grantCard",
          seat: "each",
          card: { kind: "choice", slot: "pick" },
          permanence: "campaign",
        });
    };
    expect(issuesWith(choose({ kind: "cards", cardIds: ["99999"] }, false))).toMatch(
      /names "99999", which the game does not have/,
    );
    expect(issuesWith(choose({ kind: "cards", cardIds: ["accept", "decline"] }, false))).toBe("");
    expect(issuesWith(choose({ kind: "cards", cardIds: ["accept"] }, true))).toMatch(
      /names "accept", which the game does not have/,
    );
    expect(issuesWith(choose({ kind: "cards", cardIds: ["01001a"] }, true))).toBe("");
    expect(
      issuesWith((c) => {
        choose({ kind: "cards", cardIds: ["accept"] }, false)(c);
        victoryOps(c).push({
          kind: "choose",
          slot: "second",
          chooser: "group",
          from: { kind: "values", of: { kind: "choice", slot: "pick" } },
        });
        victoryOps(c).push({
          kind: "grantCard",
          seat: "each",
          card: { kind: "choice", slot: "second" },
          permanence: "campaign",
        });
      }),
    ).toMatch(/names "accept"/);
    expect(
      issuesWith((c) =>
        victoryOps(c).push({
          kind: "grantCard",
          seat: "each",
          card: { kind: "const", value: "99999" },
          permanence: "campaign",
        }),
      ),
    ).toMatch(/grantCard names card "99999"/);
  });

  it("holds literal instruction list ids to conditionalInstructions keys", () => {
    const list = (c: any) => addField(c, { id: "later", label: "Later", type: { kind: "instructionList" } });
    expect(
      issuesWith((c) => {
        list(c);
        victoryOps(c).push({ kind: "appendToList", field: "later", value: { kind: "const", value: "crisis.nope" } });
      }),
    ).toMatch(/names "crisis.nope", which is not a conditionalInstructions key/);
    expect(
      issuesWith((c) => {
        list(c);
        c.definition.conditionalInstructions = {
          "crisis.later": { ...c.definition.graph.nodes[1].victory[0], id: "crisis.later" },
        };
        victoryOps(c).push({ kind: "appendToList", field: "later", value: { kind: "const", value: "crisis.later" } });
      }),
    ).toBe("");
  });

  it("checks field type shapes, node labels and nodeProgress nodes", () => {
    const type = (id: string, value: object) => (c: any) => addField(c, { id, label: id, type: value });
    expect(issuesWith(type("role", { kind: "choice" }))).toMatch(/choice field needs an options list/);
    expect(issuesWith(type("s", { kind: "strikeList", options: [] }))).toMatch(
      /strikeList field needs an options list/,
    );
    expect(issuesWith(type("b", { kind: "cardState" }))).toMatch(/cardState field needs a cardIds list/);
    expect(issuesWith(type("n", { kind: "number", min: "0" }))).toMatch(/min must be a number/);
    expect(issuesWith(type("w", { kind: "weird" }))).toMatch(/needs a type of kind/);
    expect(issuesWith((c) => delete c.definition.graph.nodes[0].label)).toMatch(/node "clockmaker" needs a label/);
    const progress = (node: string) => (c: any) =>
      victoryOps(c).push({ kind: "setField", field: "cogs", value: { kind: "nodeProgress", node } });
    expect(issuesWith(progress("nowhere"))).toMatch(/nodeProgress names node "nowhere"/);
    expect(issuesWith(progress("street-fight"))).toBe("");
  });

  it("never throws on a malformed definition: it reports it", () => {
    const shapes: ((c: any) => void)[] = [
      (c) => (c.definition.graph.nodes[0].setup = null),
      (c) => (c.definition.graph.nodes[0].composition = "x"),
      (c) => (c.definition.graph.nodes = [null, 3]),
      (c) => (c.definition.graph.nodes = "none"),
      (c) => (c.definition.graph = null),
      (c) => (c.definition.logFields = [null]),
      (c) => (c.definition.logFields = {}),
      (c) => (c.definition.everyNodeSetup = "x"),
      (c) => (c.definition.everyNodeVictory = [null]),
      (c) => (c.definition.conditionalInstructions = []),
      (c) => (c.definition.conditionalInstructions = { a: null }),
      (c) => (c.definition.loss = null),
      (c) => (c.definition.loss = { retry: "free", retryBaseline: "nodeStart", everyNodeDefeat: 5 }),
      (c) => (c.definition.graph.nodes[0].victory[0].step = null),
      (c) => (c.definition.graph.nodes[0].victory[0].step.ops = "x"),
      (c) => (c.definition.graph.nodes[0].scenario = null),
      (c) => (c.record = null),
      (c) => (c.story = { blurb: "x", issues: [null] }),
    ];
    for (const [index, shape] of shapes.entries()) expect(issuesWith(shape), `shape ${index}`).not.toBe("");
  });
});

describe("playCampaign: what the smoke run catches", () => {
  const deps = () => gameDepsWithPack(PLAYABLE_DEPS, pack);
  const record = (change: (c: any) => void): PackCampaign => {
    const campaign = structuredClone(pack.campaigns?.[0]) as any;
    change(campaign);
    return campaign as PackCampaign;
  };
  const loses = () => record((c) => c.definition.graph.nodes[0].setup.push(structuredClone(doom)));

  it("fails when a Victory instruction throws in the runner", () => {
    const broken = record((c) =>
      victoryOps(c).push({ kind: "appendToList", field: "stopped", value: { kind: "const", value: "x" } }),
    );
    const run = playCampaign(pack, broken, 1, deps(), 4000);
    const failed = run.games.filter((game) => !game.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.error).toMatch(/cannot be appended to/);
  });

  it("notes a staged win after a lost game and goes on to the next node", () => {
    const run = playCampaign(pack, loses(), 1, deps(), 4000);
    expect(run.games.filter((game) => !game.ok).map((game) => game.error)).toEqual([]);
    expect(run.lostAt).toBe("clockmaker");
    expect(run.games[0]?.outcome).toMatch(/^loss/);
    expect(run.notes.join("\n")).toMatch(/lost at "clockmaker", then advanced with a staged win/);
    expect(run.games.map((game) => game.node)).toContain("street-fight");
  });

  it("fails the campaign when every seed loses the same node, and says what the driver cannot cover", () => {
    const result = smokeTestPack({ ...pack, campaigns: [loses()] } as PackInput, { games: 2, failOnAlwaysLost: true });
    expect(result.ok).toBe(false);
    expect(result.games.filter((game) => !game.ok).map((game) => game.error)).toEqual([
      expect.stringMatching(/every seed lost at node "clockmaker"/),
    ]);
    expect(result.notes.join("\n")).toMatch(/Defeat block runs only if a game is lost/);
  });
});
