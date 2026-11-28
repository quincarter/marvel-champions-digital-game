// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-rewards-strip.js";
import type { McRewardsStrip } from "../McRewardsStrip.js";
import type { RewardsModel } from "../mc-rewards-strip.types.js";

afterEach(() => document.body.replaceChildren());

const model: RewardsModel = {
  label: "Rewards",
  rewards: [
    {
      cardId: "45001",
      name: "Shield",
      status: "In your deck",
      included: true,
      toggleLabel: "Leave out",
      disabled: null,
    },
    {
      cardId: "45002",
      name: "Cloak",
      status: "Left out",
      included: false,
      toggleLabel: "Put back",
      disabled: "Frozen",
    },
  ],
};

describe("mc-rewards-strip", () => {
  it("names each reward's button by its place and card", async () => {
    const el = await mount<McRewardsStrip>("mc-rewards-strip", { model });
    expect(stopKeys(el)).toEqual(["reward:0:45001", "reward:1:45002"]);
  });

  it("asks for the opposite of the reward's state", async () => {
    const el = await mount<McRewardsStrip>("mc-rewards-strip", { model });
    const seen = builderEvents(el);
    press(stop(el, "reward:0:45001"));
    expect(seen).toEqual([{ type: "reward", cardId: "45001", included: false }]);
  });

  it("marks status with a tick or a dash in words, and dims a frozen reward with its reason", async () => {
    const el = await mount<McRewardsStrip>("mc-rewards-strip", { model });
    const statuses = [...el.shadowRoot!.querySelectorAll(".status")].map((s) => s.textContent);
    expect(statuses).toEqual(["✓ In your deck", "– Left out"]);
    expect(stop(el, "reward:1:45002").hasAttribute("disabled")).toBe(true);
  });

  it("draws nothing for a seat with no reward", async () => {
    const el = await mount<McRewardsStrip>("mc-rewards-strip", { model: { label: "Rewards", rewards: [] } });
    expect(inner(el, ".label")).toBeNull();
  });
});
