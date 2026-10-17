import { describe, expect, test } from "vitest";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, packNameOf } from "../content/pool.js";
import { prepareDocuments, rankDocuments } from "./deck-search.js";
import { scenarioSearchDocumentOf } from "./scenario-search.js";

const docs = POOL_SCENARIOS.map((s) => scenarioSearchDocumentOf(s, CARDS_BY_ID, POOL_ENCOUNTER_SETS, packNameOf));
const rank = (query: string): string[] => rankDocuments(prepareDocuments(docs), query).map((r) => r.id);

describe("scenarioSearchDocumentOf", () => {
  test("one document per scenario, named by its scenario and villain", () => {
    expect(docs.map((d) => d.id)).toEqual(POOL_SCENARIOS.map((s) => s.id as string));
    const first = POOL_SCENARIOS[0]!;
    expect(docs[0]!.primary).toContain(first.name);
  });

  test("searching a scenario's own name ranks it first", () => {
    const target = POOL_SCENARIOS[Math.floor(POOL_SCENARIOS.length / 2)]!;
    expect(rank(target.name)[0]).toBe(target.id as string);
  });

  test("a pack name finds its scenarios", () => {
    const target = POOL_SCENARIOS[0]!;
    expect(rank(packNameOf(target.packCode as string))).toContain(target.id as string);
  });
});
