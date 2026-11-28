import { describe, expect, it } from "vitest";
import { termTextRunsOf } from "./term-text-runs.js";

describe("termTextRunsOf", () => {
  it("turns a sentence with a glossary term into runs, with a tip for the term", () => {
    const { runs, tips } = termTextRunsOf("The plan reaches 7 [[threat|threat]].", "RULES GLOSSARY ▸");
    expect(runs).toEqual([
      { kind: "text", text: "The plan reaches 7 " },
      { kind: "term", id: "threat", label: "threat" },
      { kind: "text", text: "." },
    ]);
    expect(Object.keys(tips)).toEqual(["threat"]);
    expect(tips.threat!.heading.toLowerCase()).toContain("threat");
    expect(tips.threat!.linkLabel).toBe("RULES GLOSSARY ▸");
    expect(tips.threat!.body).toMatch(/\(.+\)$/);
  });

  it("keeps paragraph and line breaks and gives plain words no tips", () => {
    const { runs, tips } = termTextRunsOf("One.\n\nTwo\nthree", "x");
    expect(runs.map((run) => run.kind)).toEqual(["text", "break", "text", "break", "text"]);
    expect(runs.filter((run) => run.kind === "break")).toEqual([
      { kind: "break", paragraph: true },
      { kind: "break", paragraph: false },
    ]);
    expect(tips).toEqual({});
  });
});
