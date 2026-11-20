import { describe, expect, it } from "vitest";
import { RoomModel } from "./room-model.js";

const model = (role: "guest" | "host"): RoomModel =>
  new RoomModel({
    role,
    name: "Ava",
    build: { appVersion: "1", contentVersion: "1" },
    linkBase: "https://example.test/",
    roomId: "room",
  });

describe("a guest's request to the host", () => {
  it("waits, then shows the host's answer, and can be dismissed", () => {
    const guest = model("guest");
    expect(guest.state().myRequest).toBeNull();
    guest.noteAsk("undo");
    expect(guest.state().myRequest).toMatchObject({ what: "undo", status: "waiting" });
    expect(guest.onMessage({ v: 1, ch: "game", kind: "request-answer", table: "t1", accepted: true })).toBe(true);
    expect(guest.state().myRequest?.status).toBe("accepted");
    guest.clearAsk();
    expect(guest.state().myRequest).toBeNull();
  });

  it("is never shown to a host", () => {
    const host = model("host");
    host.noteAsk("adjust");
    expect(host.state().myRequest).toBeNull();
  });
});
