import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AbilityRegistry } from "@mc/engine";
import { heroAction, thwartAScheme } from "@mc/cards";
import { dslFeatures, SUPPORTED_DSL_FEATURES, TARGET_QUERY_FIELDS } from "./features.js";
import { definePackAbilities } from "./define.js";
import tiny from "./fixtures/tiny-pack/abilities/index.js";

describe("dslFeatures", () => {
  it("lists the features of a known registry, sorted", () => {
    const features = dslFeatures(tiny);
    expect(features).toEqual([...features].sort());
    expect(features).toContain("trigger:action");
    expect(features).toContain("effect:thwart");
    expect(features.every((f) => /^[a-z-]+:[A-Za-z0-9]+(.[A-Za-z0-9]+)?$/.test(f))).toBe(true);
  });

  it("is deterministic and independent of key order", () => {
    const a = definePackAbilities({
      "x.p.01.a": heroAction({ label: "thwart" }, thwartAScheme(2)),
      "x.p.01.b": heroAction({ label: "thwart" }, thwartAScheme(3)),
    });
    const b = definePackAbilities({ "x.p.01.b": a["x.p.01.b"], "x.p.01.a": a["x.p.01.a"] });
    expect(dslFeatures(a)).toEqual(dslFeatures(b));
  });

  it("an empty registry uses nothing", () => {
    expect(dslFeatures({})).toEqual([]);
  });

  it("the supported list covers the fixture and is non-trivial", () => {
    const supported = new Set(SUPPORTED_DSL_FEATURES);
    expect(dslFeatures(tiny).every((f) => supported.has(f))).toBe(true);
    expect(SUPPORTED_DSL_FEATURES.length).toBeGreaterThan(100);
    expect(SUPPORTED_DSL_FEATURES).toContain("effect:dealDamage");
  });

  const raw = (definition: object): AbilityRegistry => ({ "x.p.01.a": definition }) as unknown as AbilityRegistry;

  it("records a nested kind in generates, and its fields", () => {
    const features = dslFeatures(
      raw({ trigger: { kind: "resource" }, effects: [], generates: { kind: "wildFor", n: 1 } }),
    );
    expect(features).toContain("ability:generates");
    expect(features).toContain("expr:wildFor");
    expect(features).toContain("expr:wildFor.n");
  });

  it("records limit and label", () => {
    const features = dslFeatures(
      raw({ trigger: { kind: "action" }, effects: [], limit: { per: "round", count: 1 }, label: ["thwart"] }),
    );
    expect(features).toEqual(expect.arrayContaining(["ability:limit", "ability:limit.per", "ability:label"]));
  });

  it("records the parts of a cost's either branches and conditional branches", () => {
    const features = dslFeatures(
      raw({
        trigger: { kind: "action" },
        effects: [],
        cost: {
          either: [{ exhaustSelf: true }, { discardFromHand: { min: 1 } }],
          conditional: { then: { resources: 1 }, else: { healCharacter: { amount: 1 } } },
        },
      }),
    );
    expect(features).toEqual(
      expect.arrayContaining([
        "cost:either",
        "cost:exhaustSelf",
        "cost:discardFromHand",
        "cost:discardFromHand.min",
        "cost:resources",
        "cost:healCharacter",
      ]),
    );
  });

  it("records an effect inside a chooseOne option and inside an if", () => {
    const features = dslFeatures(
      raw({
        trigger: { kind: "action" },
        effects: [
          { kind: "chooseOne", options: [{ label: "a", effects: [{ kind: "drawCards", amount: 1 }] }] },
          {
            kind: "if",
            condition: { kind: "gameMode", is: "competitive" },
            then: [{ kind: "heal" }],
            otherwise: [{ kind: "stun" }],
          },
        ],
      }),
    );
    expect(features).toEqual(
      expect.arrayContaining([
        "effect:chooseOne",
        "effect:drawCards",
        "effect:drawCards.amount",
        "effect:heal",
        "effect:stun",
        "expr:gameMode",
        "expr:gameMode.is",
      ]),
    );
  });

  it("tags effect: only for effect slots", () => {
    const features = dslFeatures(
      raw({
        trigger: { kind: "action" },
        effects: [
          { kind: "replaceTriggeringEvent", with: [{ kind: "heal" }] },
          {
            kind: "dealDamage",
            amount: { kind: "orElse", value: { kind: "const" }, otherwise: { kind: "const" } },
            to: { kind: "chosen" },
          },
          { kind: "findCard", with: { kind: "cardQuery" } },
        ],
      }),
    );
    expect(features).toContain("effect:heal");
    expect(features).toContain("expr:orElse");
    expect(features).toContain("expr:cardQuery");
    expect(features).not.toContain("effect:const");
    expect(features).not.toContain("effect:cardQuery");
  });

  it("reports the unlabeled-attack opt-out as a feature", () => {
    const features = dslFeatures(
      raw({ trigger: { kind: "action" }, effects: [], unlabeledAttack: { citation: "FAQ" } }),
    );
    expect(features).toContain("ability:unlabeledAttack");
  });

  it("records the fields of a TargetQuery wherever it sits, and keeps its other keys", () => {
    const features = dslFeatures(
      raw({
        trigger: {
          kind: "constant",
          rules: [
            {
              kind: "costModifier",
              delta: 2,
              appliesTo: { categories: ["upgrade"], hasTaggedAbility: "pinkBubble", controller: "you" },
            },
          ],
        },
        effects: [],
      }),
    );
    expect(features).toContain("query:categories");
    expect(features).toContain("query:hasTaggedAbility");
    expect(features).toContain("query:controller");
    expect(features).toContain("rule:costModifier.appliesTo");
  });

  it("a query without categories counts, and an object holding only shared field names does not", () => {
    const features = dslFeatures(
      raw({
        trigger: { kind: "action" },
        effects: [{ kind: "x", target: { hasCounter: "c", name: "A" }, keyword: { name: "guard" } }],
      }),
    );
    expect(features).toContain("query:hasCounter");
    expect(features).toContain("query:name");
    expect(features.filter((f) => f === "query:name")).toHaveLength(1);
    expect(
      dslFeatures(raw({ trigger: { kind: "action" }, effects: [{ kind: "x", keyword: { name: "guard" } }] })),
    ).not.toContain("query:name");
  });

  it("the supported list has the query fields the engine-only examples use, and a lasting flip lock", () => {
    expect(SUPPORTED_DSL_FEATURES).toContain("query:hasTaggedAbility");
    expect(SUPPORTED_DSL_FEATURES).toContain("query:categories");
    expect(SUPPORTED_DSL_FEATURES).toContain("expr:cannotFlip");
    expect(SUPPORTED_DSL_FEATURES).toContain("expr:cannotFlip.target");
  });

  it("TARGET_QUERY_FIELDS is every field of the engine's TargetQuery interface", () => {
    const source = readFileSync(fileURLToPath(new URL("../../engine/src/spec.ts", import.meta.url)), "utf8");
    const body = source.slice(source.indexOf("export interface TargetQuery {"));
    const declared = [...body.slice(0, body.indexOf("\n}")).matchAll(/^ {2}readonly (\w+)\??:/gm)].map((m) => m[1]);
    expect([...TARGET_QUERY_FIELDS].sort()).toEqual([...declared].sort());
  });
});
