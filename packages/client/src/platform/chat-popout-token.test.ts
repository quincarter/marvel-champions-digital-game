import { describe, expect, it } from "vitest";
import {
  ChatPopoutRelay,
  popoutChannelName,
  type PopoutChannel,
  type PopoutToRoom,
  type RoomToPopout,
} from "../live/chat-popout-protocol.js";
import { NO_ROOM, type RoomState } from "../live/room-state.js";
import {
  clearPopoutToken,
  loadPopoutToken,
  PopoutRearm,
  savePopoutToken,
  type TokenStorage,
} from "./chat-popout-token.js";

const TOKEN = "0123456789abcdef0123456789abcdef";

/** One tab sessionStorage. */
const tabStorage = (): TokenStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

describe("the owning tab pop-out token", () => {
  it("is kept per room, and only for the room it was saved for", () => {
    const storage = tabStorage();
    savePopoutToken("r1", TOKEN, storage);
    expect(loadPopoutToken("r1", storage)).toBe(TOKEN);
    expect(loadPopoutToken("r2", storage)).toBeNull();
    clearPopoutToken(storage);
    expect(loadPopoutToken("r1", storage)).toBeNull();
  });

  it("ignores a malformed record and survives no storage", () => {
    const storage = tabStorage();
    storage.setItem("mc-chat-popout", "{nope");
    expect(loadPopoutToken("r1", storage)).toBeNull();
    storage.setItem("mc-chat-popout", JSON.stringify({ roomId: "r1", token: "short" }));
    expect(loadPopoutToken("r1", storage)).toBeNull();
    expect(() => savePopoutToken("r1", TOKEN, null)).not.toThrow();
    expect(loadPopoutToken("r1", null)).toBeNull();
  });

  const joined = (over: Partial<RoomState> = {}): RoomState => ({
    ...NO_ROOM,
    role: "guest",
    connection: "connected",
    roomId: "r1",
    ...over,
  });

  it("arms the saved token once per room on the first state of that room, not on others", () => {
    const storage = tabStorage();
    savePopoutToken("r1", TOKEN, storage);
    const armed: string[] = [];
    const rearm = new PopoutRearm((t) => armed.push(t), storage);
    rearm.onState(joined({ connection: "connecting", roomId: null }));
    expect(armed).toEqual([]);
    rearm.onState(joined());
    rearm.onState(joined());
    expect(armed).toEqual([TOKEN]);
    const other = new PopoutRearm((t) => armed.push(t), storage);
    other.onState(joined({ roomId: "r2" }));
    expect(armed).toEqual([TOKEN]);
  });

  it("drops the saved token when the room is left or over", () => {
    const storage = tabStorage();
    savePopoutToken("r1", TOKEN, storage);
    new PopoutRearm(() => undefined, storage).onState(NO_ROOM);
    expect(loadPopoutToken("r1", storage)).toBeNull();
    savePopoutToken("r1", TOKEN, storage);
    new PopoutRearm(() => undefined, storage).onState(joined({ connection: "ended", problem: "closed-host" }));
    expect(loadPopoutToken("r1", storage)).toBeNull();
  });
});

/** A browser BroadcastChannel namespace: every channel of one name hears the others posts, never its own. */
function bus() {
  const channels = new Map<string, Set<PopoutChannel<unknown, unknown>>>();
  return {
    open<In, Out>(name: string): PopoutChannel<In, Out> {
      const set = channels.get(name) ?? new Set();
      channels.set(name, set);
      const channel: PopoutChannel<In, Out> = {
        onmessage: null,
        postMessage: (message) => {
          for (const other of set)
            if (other !== channel) (other as PopoutChannel<unknown, unknown>).onmessage?.({ data: message });
        },
        close: () => void set.delete(channel as PopoutChannel<unknown, unknown>),
      };
      set.add(channel as PopoutChannel<unknown, unknown>);
      return channel;
    },
  };
}

describe("a pop-out window across a reload of its owning tab", () => {
  const room = (): RoomState => ({
    ...NO_ROOM,
    role: "guest",
    connection: "connected",
    roomId: "r1",
    code: "ABC123",
    settings: { chat: true } as RoomState["settings"],
  });

  /** A tab room worker: a relay over the shared bus, its lines recorded. */
  function worker(b: ReturnType<typeof bus>, id: string) {
    const said: string[] = [];
    const relay = new ChatPopoutRelay({
      open: (name) => b.open(name) as PopoutChannel<PopoutToRoom, RoomToPopout>,
      say: (t) => said.push(`${id}:${t}`),
      onOpenChange: () => undefined,
      now: () => 0,
      every: () => () => undefined,
    });
    relay.onState(room());
    return { relay, said };
  }

  it("gets a snapshot for its hello from the new worker, and one line is sent exactly once", () => {
    const b = bus();
    const storage = tabStorage();
    // Tab A pops the chat out: its token is saved for the tab, its worker armed.
    const before = worker(b, "A");
    savePopoutToken("r1", TOKEN, storage);
    before.relay.arm(TOKEN);
    const heard: RoomToPopout[] = [];
    const popout = b.open<RoomToPopout, PopoutToRoom>(popoutChannelName("r1", TOKEN));
    popout.onmessage = (e) => heard.push(e.data);
    popout.postMessage({ kind: "hello" });
    expect(heard.some((m) => m.kind === "snapshot")).toBe(true);

    // Tab A reloads: its old worker is gone, a new one joins the same room and is handed the saved token.
    before.relay.close();
    heard.length = 0;
    const after = worker(b, "A2");
    new PopoutRearm((t) => after.relay.arm(t), storage).onState(room());
    // The window that was already open keeps saying hello (a beat counts as one): the new worker answers.
    popout.postMessage({ kind: "hello" });
    expect(heard.filter((m) => m.kind === "snapshot")).toHaveLength(1);
    popout.postMessage({ kind: "say", text: "hi" });
    expect(after.said).toEqual(["A2:hi"]);
  });

  it("leaves a second tab in the same room isolated", () => {
    const b = bus();
    const storageA = tabStorage();
    const storageB = tabStorage();
    savePopoutToken("r1", TOKEN, storageA);
    const a = worker(b, "A");
    const other = worker(b, "B");
    new PopoutRearm((t) => a.relay.arm(t), storageA).onState(room());
    // Tab B has no token of its own (sessionStorage is per tab): it arms nothing and hears nothing from the window.
    new PopoutRearm((t) => other.relay.arm(t), storageB).onState(room());
    const popout = b.open<RoomToPopout, PopoutToRoom>(popoutChannelName("r1", TOKEN));
    popout.postMessage({ kind: "hello" });
    popout.postMessage({ kind: "say", text: "only once" });
    expect(a.said).toEqual(["A:only once"]);
    expect(other.said).toEqual([]);
    expect(other.relay.isOpen).toBe(false);
  });
});
