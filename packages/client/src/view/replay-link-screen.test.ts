import { describe, expect, it } from "vitest";
import {
  REPLAY_LINK_MARGIN,
  REPLAY_LINK_PANEL_MAX_WIDTH,
  replayLinkBodyWidth,
  replayLinkScreenLayout,
} from "./replay-link-screen.js";

const input = { spinner: true, headingHeight: 24, bodyHeight: 40, buttonHeight: 52 };

describe("replayLinkScreenLayout (issue #858)", () => {
  it("centres a capped panel on a wide screen", () => {
    const layout = replayLinkScreenLayout({ ...input, width: 1280, height: 720 });
    expect(layout.panel.width).toBe(REPLAY_LINK_PANEL_MAX_WIDTH);
    expect(layout.panel.x + layout.panel.width / 2).toBe(640);
    expect(layout.panel.y + layout.panel.height / 2).toBeCloseTo(360, 0);
  });

  it("keeps a margin on a phone and wraps the body inside the panel", () => {
    const layout = replayLinkScreenLayout({ ...input, width: 375, height: 667 });
    expect(layout.panel.x).toBe(REPLAY_LINK_MARGIN);
    expect(layout.panel.width).toBe(375 - REPLAY_LINK_MARGIN * 2);
    expect(layout.body.width).toBe(replayLinkBodyWidth(375));
    expect(layout.button.x).toBeGreaterThan(layout.panel.x);
    expect(layout.button.x + layout.button.width).toBeLessThan(layout.panel.x + layout.panel.width);
  });

  it("stacks spinner, heading, body and button in order inside the panel", () => {
    const layout = replayLinkScreenLayout({ ...input, width: 768, height: 1024 });
    expect(layout.spinner).not.toBeNull();
    expect(layout.spinner!.y).toBeLessThan(layout.heading.y);
    expect(layout.heading.y + input.headingHeight).toBeLessThanOrEqual(layout.body.y);
    expect(layout.body.y + input.bodyHeight).toBeLessThanOrEqual(layout.button.y);
    expect(layout.button.y + layout.button.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height);
  });

  it("drops the spinner once loading failed", () => {
    const loading = replayLinkScreenLayout({ ...input, width: 1024, height: 768 });
    const failed = replayLinkScreenLayout({ ...input, spinner: false, width: 1024, height: 768 });
    expect(failed.spinner).toBeNull();
    expect(failed.panel.height).toBeLessThan(loading.panel.height);
  });

  it("never starts above the top margin on a short screen", () => {
    const layout = replayLinkScreenLayout({ ...input, bodyHeight: 600, width: 400, height: 300 });
    expect(layout.panel.y).toBe(REPLAY_LINK_MARGIN);
  });
});

describe("replayLinkScreenLayout without a button (issue #858)", () => {
  it("ends the panel at the body when there is no button", () => {
    const layout = replayLinkScreenLayout({ ...input, buttonHeight: 0, width: 1024, height: 768 });
    expect(layout.panel.y + layout.panel.height).toBe(layout.body.y + input.bodyHeight + 24);
  });
});
