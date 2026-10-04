import { describe, expect, test } from "vitest";
import { briefingSpeakerOf } from "./campaign-briefing-speaker.js";

const ISSUE = { scenarioId: "magog", villainName: "MaGog" };

describe("the briefing's speaker portrait", () => {
  test("a hero speaks as that hero and is not named on the bubble", () => {
    const view = briefingSpeakerOf({ kind: "hero", identityId: "37001a", name: "Gambit" }, ISSUE, "38001a");
    expect(view).toMatchObject({ heroIdentityId: "37001a", villainScenarioId: null, name: null });
  });

  test("narration borrows the first seat's portrait", () => {
    expect(briefingSpeakerOf({ kind: "narrator" }, ISSUE, "38001a").heroIdentityId).toBe("38001a");
  });

  test("a villain speaks over the issue's own villain picture", () => {
    expect(
      briefingSpeakerOf({ kind: "villain" }, { scenarioId: "spiral", villainName: "Spiral" }, "38001a"),
    ).toMatchObject({ heroIdentityId: null, villainScenarioId: "spiral", name: "Spiral" });
  });

  test("an NPC with a portrait scenario borrows its villain picture and is named", () => {
    expect(briefingSpeakerOf({ kind: "npc", name: "Mojo", portraitScenarioId: "mojo" }, ISSUE, "38001a")).toMatchObject(
      { heroIdentityId: null, villainScenarioId: "mojo", name: "Mojo" },
    );
  });

  test("an NPC with no portrait gets a letter, never the first seat's face", () => {
    expect(
      briefingSpeakerOf({ kind: "npc", name: "Major Domo" }, { scenarioId: "spiral", villainName: "Spiral" }, "38001a"),
    ).toMatchObject({
      heroIdentityId: null,
      villainScenarioId: null,
      name: "Major Domo",
      initial: "M",
    });
  });
});
