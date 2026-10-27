/**
 * #431: every interrupt or response in the card pool that needs one of your allies or characters of a kind, to pay
 * with ("exhaust another Avenger ally you control →") or to choose ("choose another Dora Milaje ally"), is worded when
 * none is there: in the not-offered notice, the log and Inspect (`queryNounOf`, `noMatchClause`). A new card of a new
 * shape fails the first test until it is worded or named below with why not; and every ally trait reads as printed.
 */
import { describe, expect, test } from "vitest";
import { inPlayPicksOf, type TargetQuery } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { queryNounOf } from "./ability-refusal.js";

/** The shapes not worded, each with why: the card itself is always there, and so is the ally it is attached to. */
const NOT_WORDED: Readonly<Record<string, string>> = {
  "04004.mockingbird-interrupt": "returns Mockingbird herself (`self: true`)",
  "32011.nightcrawler-interrupt": "returns Nightcrawler himself (`self: true`)",
  "53024.wingman-interrupt": "exhausts the ally Wingman is attached to (`hostOfSelf`)",
};

/** Each optional interrupt or response's ally or character queries: its cost's picks and its opening target. */
function allyShapes(): { readonly abilityId: string; readonly query: TargetQuery; readonly payer: boolean }[] {
  return Object.entries(POOL_DEPS.abilities).flatMap(([abilityId, definition]) => {
    const trigger = definition?.trigger;
    if (!definition || !trigger || (trigger.kind !== "interrupt" && trigger.kind !== "response") || trigger.forced)
      return [];
    const isAlly = (query: TargetQuery) => (query.categories ?? []).includes("ally");
    const picks = inPlayPicksOf(definition.cost)
      .filter(({ pick }) => isAlly(pick.query))
      .map(({ pick }) => ({ abilityId, query: pick.query, payer: true }));
    const first = definition.effects.slice(definition.costEffects ?? 0)[0];
    const target =
      first?.kind === "chooseTarget" && isAlly(first.query) ? [{ abilityId, query: first.query, payer: false }] : [];
    return [...picks, ...target];
  });
}

describe("not-offered wording covers the card pool (#431)", () => {
  test("every ally or character an interrupt or response needs is worded, or named here with why not", () => {
    const shapes = allyShapes();
    const unworded = shapes.filter(({ query, payer }) => !queryNounOf(query, payer)).map((s) => s.abilityId);
    expect([...new Set(unworded)].sort()).toEqual(Object.keys(NOT_WORDED).sort());
    const worded = shapes.flatMap(({ abilityId, query, payer }) => {
      const kind = queryNounOf(query, payer);
      return kind ? [`${abilityId}: ${kind.other ? "other " : ""}${kind.noun}${kind.anyone ? " (anyone's)" : ""}`] : [];
    });
    // The cards it accounts for today, so a change in what one says is seen here.
    expect([...new Set(worded)].sort()).toEqual([
      "06032.teamwork-constant: ally",
      "21053.major-victory-interrupt: Guardian character",
      "21058.innovation-response: ally",
      "23021.innovation-response: ally",
      "23034.stand-together-interrupt: Avenger character",
      "23034.stand-together-interrupt: Guardian character",
      "27049.spider-man-response: other Web-Warrior character",
      "29015.falcon-response: other Champion character",
      "29016.patriot-response: Champion character (anyone's)",
      "33017.teamwork-constant: ally",
      "42011.elixir-response: other character (anyone's)",
      "47029.serve-and-protect-interrupt: X-Force character",
      "47029.serve-and-protect-interrupt: X-Men character",
      "49014.phoenix-response: X-Men ally (anyone's)",
      "49019.you-got-this-response: ally",
      "51022.aneka-response: other Dora Milaje ally (anyone's)",
      "51023.ayo-response: other Dora Milaje ally (anyone's)",
      "51024.okoye-response: other Dora Milaje ally (anyone's)",
      "52022.spider-man-response: other Web-Warrior character",
      "52032.spider-man-2099-response: Web-Warrior ally (anyone's)",
      "53020.flight-squadron-granted-response: ally",
      "56052.iron-lad-interrupt: other Avenger ally",
      "59021.teamwork-interrupt: ally",
      "62016.innovation-response: ally",
    ]);
  });

  test("every trait an ally carries reads as printed in the wording", () => {
    const traits = new Set<string>();
    for (const card of POOL_CARDS) {
      if (card.type === "ally" && "traits" in card) for (const trait of card.traits) traits.add(trait as string);
    }
    expect(traits.size).toBeGreaterThan(20);
    const noun = (trait: string) =>
      queryNounOf({ categories: ["ally"], controller: "you", trait } as unknown as TargetQuery)?.noun;
    for (const trait of traits) {
      const worded = noun(trait);
      expect(worded?.toLowerCase(), trait).toBe(`${trait.toLowerCase()} ally`);
      expect(worded?.charAt(0), trait).toBe(worded?.charAt(0).toUpperCase());
    }
    expect(noun("AVENGER")).toBe("Avenger ally");
    expect(noun("X-MEN")).toBe("X-Men ally");
    expect(noun("X-FORCE")).toBe("X-Force ally");
    expect(noun("WEB-WARRIOR")).toBe("Web-Warrior ally");
    expect(noun("MUTANT")).toBe("Mutant ally");
    expect(noun("DORA MILAJE")).toBe("Dora Milaje ally");
    expect(noun("GUARDIAN")).toBe("Guardian ally");
    expect(noun("S.H.I.E.L.D.")).toBe("S.H.I.E.L.D. ally");
    expect(noun("HERO FOR HIRE")).toBe("Hero for Hire ally");
  });
});
