import { describe, expect, it } from "vitest";
import { popoutCanSay, popoutOffersClose, popoutStatusOf } from "./chat-popout-view.js";
import type { PopoutSnapshot } from "./chat-popout-protocol.js";

const snap = (extra: Partial<PopoutSnapshot> = {}): PopoutSnapshot => ({
  code: "ABC123",
  lines: [],
  live: 0,
  chatOn: true,
  ended: false,
  ...extra,
});

describe("popoutStatusOf", () => {
  it("waits for the first snapshot, then is live", () => {
    expect(popoutStatusOf({ snapshot: null, left: false, silent: false })).toBe("connecting");
    expect(popoutStatusOf({ snapshot: snap(), left: false, silent: false })).toBe("live");
  });
  it("says so when chat is off, the room closed, this device left, or the game window went quiet", () => {
    expect(popoutStatusOf({ snapshot: snap({ chatOn: false }), left: false, silent: false })).toBe("off");
    expect(popoutStatusOf({ snapshot: snap({ ended: true }), left: false, silent: false })).toBe("ended");
    expect(popoutStatusOf({ snapshot: snap(), left: true, silent: false })).toBe("left");
    expect(popoutStatusOf({ snapshot: snap(), left: false, silent: true })).toBe("lost");
  });
  it("sends only while live, and offers to close once the room is gone", () => {
    expect(popoutCanSay("live")).toBe(true);
    expect(popoutCanSay("ended")).toBe(false);
    expect(popoutOffersClose("left")).toBe(true);
    expect(popoutOffersClose("ended")).toBe(true);
    expect(popoutOffersClose("lost")).toBe(true);
    expect(popoutOffersClose("live")).toBe(false);
  });
});
