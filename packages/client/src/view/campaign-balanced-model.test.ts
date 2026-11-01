import { describe, expect, it } from "vitest";
import {
  BALANCED_CREDIT,
  NORMAL_CHOICE,
  balancedPaneOf,
  balancedScreenOf,
  balancedStartOf,
  balancedStopOrder,
  balancedTagOf,
  hasBalancedPrompt,
  isToggleOn,
  withBalanced,
  withToggle,
} from "./campaign-balanced-model.js";

describe("the Balanced prompt's model", () => {
  it("asks only for Galaxy's Most Wanted", () => {
    expect(hasBalancedPrompt("gmw")).toBe(true);
    expect(hasBalancedPrompt("trors")).toBe(false);
  });

  it("starts on Play as normal, with every toggle off", () => {
    const screen = balancedScreenOf(NORMAL_CHOICE, false);
    expect(screen.normal.selected).toBe(true);
    expect(screen.rebalance.selected).toBe(false);
    expect(screen.toggles).toHaveLength(4);
    expect(screen.toggles.every((row) => !row.on)).toBe(true);
    expect(balancedStartOf(NORMAL_CHOICE)).toBeUndefined();
  });

  it("says it is unofficial, locked for the run, and costs nothing", () => {
    const screen = balancedScreenOf(NORMAL_CHOICE, false);
    expect(screen.unofficial).toMatch(/unofficial/);
    expect(screen.unofficial).toMatch(/locked/);
    expect(screen.cost).toMatch(/full points and achievements/);
  });

  it("credits Gideon's Gaming and links the write-up", () => {
    expect(BALANCED_CREDIT.line).toBe("Based on fixes by Gideon's Gaming");
    expect(BALANCED_CREDIT.url).toBe("https://gideonsgaming.com/marvel-champions-fixing-galaxys-most-wanted/");
    expect(balancedScreenOf(NORMAL_CHOICE, false).credit).toBe(BALANCED_CREDIT);
  });

  it("carries Rebalance and the toggles chosen, in the screen's order", () => {
    let choice = withBalanced(NORMAL_CHOICE, true);
    choice = withToggle(choice, "milanoExhausted");
    choice = withToggle(choice, "spacePirates");
    expect(choice.toggles).toEqual(["spacePirates", "milanoExhausted"]);
    expect(balancedStartOf(choice)).toEqual({ toggles: ["spacePirates", "milanoExhausted"] });
    expect(isToggleOn(choice, "expertGallery")).toBe(false);
    expect(withToggle(choice, "spacePirates").toggles).toEqual(["milanoExhausted"]);
    expect(balancedScreenOf(choice, false).toggles.filter((row) => row.on)).toHaveLength(2);
  });

  it("carries nothing when Normal is picked again, though the toggles are remembered", () => {
    const choice = withBalanced(withToggle(withBalanced(NORMAL_CHOICE, true), "trimStandard"), false);
    expect(balancedStartOf(choice)).toBeUndefined();
    expect(withBalanced(choice, true).toggles).toEqual(["trimStandard"]);
  });

  it("lists the always-on changes for the Museum, Nebula and Ronan", () => {
    const groups = balancedPaneOf(withBalanced(NORMAL_CHOICE, true)).groups;
    expect(groups.map((group) => group.heading)).toEqual(["The Museum", "Nebula", "Ronan"]);
  });

  it("reaches the toggles by controller only once Rebalance is picked, Continue last", () => {
    expect(balancedStopOrder(NORMAL_CHOICE)).toEqual(["back", "mode-normal", "mode-rebalance", "credit", "cta"]);
    const order = balancedStopOrder(withBalanced(NORMAL_CHOICE, true));
    expect(order).toHaveLength(9);
    expect(order.filter((key) => key.startsWith("toggle-"))).toHaveLength(4);
    expect(order.at(-1)).toBe("cta");
  });

  it("marks a run as Balanced only when its modes say so", () => {
    expect(balancedTagOf({ campaign: { campaignId: "gmw" as never, balanced: true } })).toBe("Balanced");
    expect(balancedTagOf({ campaign: { campaignId: "gmw" as never } })).toBeNull();
    expect(balancedTagOf(undefined)).toBeNull();
  });

  it("names Expert in the title of an Expert signing", () => {
    expect(balancedScreenOf(NORMAL_CHOICE, true).title).toContain("Expert");
    expect(balancedScreenOf(NORMAL_CHOICE, false).title).not.toContain("Expert");
  });

  it("tells the pane what Play as normal means, and which three scenarios bite", () => {
    const pane = balancedPaneOf(NORMAL_CHOICE);
    expect(pane.heading).toBe("Play as normal");
    expect(pane.intro).toMatch(/exactly as written/);
    expect(pane.groups.map((group) => group.heading)).toEqual(["The Museum", "Nebula", "Ronan"]);
    expect(pane.groups.flatMap((group) => group.lines).join(" ")).toMatch(/Collection.*evasion.*threat/);
    expect(pane.footnote).toMatch(/full points and achievements/);
    expect(pane.showToggles).toBe(false);
  });

  it("tells the pane what changes under Rebalance, by scenario, with the toggles", () => {
    const pane = balancedPaneOf(withBalanced(NORMAL_CHOICE, true));
    expect(pane.heading).toBe("Rebalance the campaign");
    expect(pane.groupsHeading).toBe("What changes");
    expect(pane.groups.map((group) => group.heading)).toEqual(["The Museum", "Nebula", "Ronan"]);
    expect(pane.groups.every((group) => group.lines.length >= 1)).toBe(true);
    expect(pane.footnote).toMatch(/same points and achievements/);
    expect(pane.showToggles).toBe(true);
  });

  it("changes the pane with the selection, and back again", () => {
    const rebalanced = withBalanced(NORMAL_CHOICE, true);
    expect(balancedPaneOf(rebalanced)).not.toEqual(balancedPaneOf(NORMAL_CHOICE));
    expect(balancedPaneOf(withBalanced(rebalanced, false))).toEqual(balancedPaneOf(NORMAL_CHOICE));
  });
});
