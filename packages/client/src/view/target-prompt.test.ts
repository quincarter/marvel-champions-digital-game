import type { EngineDeps } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { promptTitleOf } from "./choice-source.js";
import { targetPromptOf } from "./target-prompt.js";

/** Maria Hill's Reassignment (50001a) as `@mc/cards` scripts it: a FROM pick, then a TO pick (issue #911). */
const REASSIGNMENT = "50001a.reassignment";
const deps = {
  abilities: {
    [REASSIGNMENT]: {
      effects: [
        { kind: "chooseTarget", slot: "from", query: {}, chooser: { kind: "controller" }, prompt: "Move FROM?" },
        { kind: "chooseTarget", slot: "to", query: {}, chooser: { kind: "controller" }, prompt: "Move TO?" },
        { kind: "moveCounters" },
      ],
    },
    plain: { effects: [{ kind: "chooseTarget", slot: "enemy", query: {}, chooser: { kind: "controller" } }] },
  },
} as unknown as EngineDeps;

describe("a card's own target prompt (issue #911)", () => {
  it("names each pick by its slot, and the first pick when no slot is given", () => {
    expect(targetPromptOf(deps, REASSIGNMENT, "from")).toBe("Move FROM?");
    expect(targetPromptOf(deps, REASSIGNMENT, "to")).toBe("Move TO?");
    expect(targetPromptOf(deps, REASSIGNMENT)).toBe("Move FROM?");
  });

  it("is null for a pick without a prompt, an unknown ability or no ability", () => {
    expect(targetPromptOf(deps, "plain", "enemy")).toBeNull();
    expect(targetPromptOf(deps, "missing", "from")).toBeNull();
    expect(targetPromptOf(deps, null)).toBeNull();
  });

  it("titles the choose-a-target sheet with it, and keeps the plain title otherwise", () => {
    expect(promptTitleOf({ kind: "chooseTarget", slot: "to", abilityId: REASSIGNMENT as never }, deps)).toBe(
      "Move TO?",
    );
    expect(promptTitleOf({ kind: "chooseTarget", slot: "enemy", abilityId: "plain" as never }, deps)).toBe(
      "Choose a target",
    );
  });
});
