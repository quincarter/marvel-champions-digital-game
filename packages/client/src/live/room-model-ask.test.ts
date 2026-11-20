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

  it("answers land on the ask they name: an answer to an earlier ask does not settle a later one", () => {
    const guest = model("guest");
    const undo = guest.noteAsk("undo");
    const adjust = guest.noteAsk("adjust");
    const answer = (rid: number, accepted: boolean) =>
      guest.onMessage({ v: 1, ch: "game", kind: "request-answer", table: "t1", accepted, rid });
    // The undo's answer arrives after the adjust was asked: it is not the adjust's.
    expect(answer(undo, true)).toBe(false);
    expect(guest.state().myRequest).toMatchObject({ what: "adjust", status: "waiting" });
    expect(answer(adjust, false)).toBe(true);
    expect(guest.state().myRequest).toMatchObject({ what: "adjust", status: "declined" });
  });

  it("a refusal of an earlier ask does not drop the later one", () => {
    const guest = model("guest");
    const first = guest.noteAsk("undo");
    guest.noteAsk("adjust");
    guest.onMessage({ v: 1, ch: "room", kind: "refused", reason: "strict", rid: first });
    expect(guest.state().myRequest).toMatchObject({ what: "adjust", status: "waiting" });
  });

  it("is never shown to a host", () => {
    const host = model("host");
    host.noteAsk("adjust");
    expect(host.state().myRequest).toBeNull();
  });
});
