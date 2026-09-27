import { describe, expect, it } from "vitest";
import { parseTermText, termTextModelOf, tooltipContentOf, type TermTextTerm } from "./term-text-model.js";
import { everyGlossaryEntry, type RulesEntry } from "./rules-reference.js";

const glossary = new Map(everyGlossaryEntry().map((entry) => [entry.id, entry]));

describe("parseTermText", () => {
  it("splits plain text with no markup into one text run", () => {
    expect(parseTermText("no terms here")).toEqual([{ kind: "text", text: "no terms here" }]);
  });

  it("parses [[id]] and [[id|label]] with surrounding text preserved", () => {
    expect(parseTermText("He adds [[threat]] to it, then [[exhausted|exhaust]] you.")).toEqual([
      { kind: "text", text: "He adds " },
      { kind: "term", id: "threat" },
      { kind: "text", text: " to it, then " },
      { kind: "term", id: "exhausted", label: "exhaust" },
      { kind: "text", text: " you." },
    ]);
  });

  it("handles a term at the very start or end with no adjacent text run", () => {
    expect(parseTermText("[[threat]] is bad")).toEqual([
      { kind: "term", id: "threat" },
      { kind: "text", text: " is bad" },
    ]);
    expect(parseTermText("watch the [[threat]]")).toEqual([
      { kind: "text", text: "watch the " },
      { kind: "term", id: "threat" },
    ]);
  });

  it("trims whitespace inside the brackets", () => {
    expect(parseTermText("[[ threat | Threat ]]")).toEqual([{ kind: "term", id: "threat", label: "Threat" }]);
  });
});

describe("termTextModelOf", () => {
  it("resolves a known concept id to its glossary entry, using the entry's own display name with no explicit label", () => {
    const model = termTextModelOf("Watch the [[threat]].", glossary, false);
    const term = model.runs[1] as TermTextTerm;
    expect(term.kind).toBe("term");
    expect(term.entry?.id).toBe("threat");
    expect(term.label).toBe(term.entry?.displayName);
    expect(model.unknownIds).toEqual([]);
  });

  it("uses an explicit label over the entry's own display name", () => {
    const model = termTextModelOf("[[exhausted|exhaust]] the defender.", glossary, false);
    const term = model.runs[0] as TermTextTerm;
    expect(term.label).toBe("exhaust");
    expect(term.entry?.id).toBe("exhausted");
  });

  it("resolves the client-only exhausted/ready/facedown-boost-card entries alongside content entries", () => {
    for (const id of ["exhausted", "ready", "facedownBoostCard"]) {
      const model = termTextModelOf(`[[${id}]]`, glossary, false);
      const term = model.runs[0] as TermTextTerm;
      expect(term.entry?.id).toBe(id);
    }
  });

  it("throws in dev mode on an unknown id, naming it", () => {
    expect(() => termTextModelOf("[[not-a-real-id]] warning", glossary, true)).toThrow(/not-a-real-id/);
  });

  it("falls back to plain text (null entry, label = the raw id) for an unknown id outside dev", () => {
    const model = termTextModelOf("[[not-a-real-id]] warning", glossary, false);
    const term = model.runs[0] as TermTextTerm;
    expect(term.entry).toBeNull();
    expect(term.label).toBe("not-a-real-id");
    expect(model.unknownIds).toEqual(["not-a-real-id"]);
  });

  it("defaults to the full client glossary lookup when none is passed", () => {
    const model = termTextModelOf("[[mainScheme]]", undefined, false);
    expect(model.runs[0]).toMatchObject({ kind: "term", id: "mainScheme" });
    expect((model.runs[0] as TermTextTerm).entry).not.toBeNull();
  });
});

describe("tooltipContentOf", () => {
  it("returns title/definition/citeLabel for a resolved term", () => {
    const entry: RulesEntry = {
      id: "threat",
      displayName: "Threat",
      definition: "A measure of how close a scheme is to completing.",
      citeLabel: "RRG 1.8 p. 1",
      unverified: false,
      cardRefs: [],
    };
    const term: TermTextTerm = { kind: "term", id: "threat", label: "threat", entry };
    expect(tooltipContentOf(term)).toEqual({
      title: "Threat",
      definition: "A measure of how close a scheme is to completing.",
      citeLabel: "RRG 1.8 p. 1",
    });
  });

  it("returns null for a production-fallback term with no entry", () => {
    const term: TermTextTerm = { kind: "term", id: "nope", label: "nope", entry: null };
    expect(tooltipContentOf(term)).toBeNull();
  });
});
