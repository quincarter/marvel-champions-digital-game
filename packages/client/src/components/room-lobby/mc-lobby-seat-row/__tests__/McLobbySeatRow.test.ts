// @vitest-environment happy-dom
import "@mc/ui";
import type { LitElement } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-seat-row.js";
import type { McLobbySeatRow } from "../McLobbySeatRow.js";
import type { LobbyButtonModel, LobbyEvent, LobbySeatRowModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (stop: string, label: string, command: LobbyEvent): LobbyButtonModel => ({
  stop,
  label,
  kind: "secondary",
  command,
});

const ROW: LobbySeatRowModel = {
  id: "s1",
  mine: true,
  tag: "SEAT 1 · PRESET",
  deck: {
    cardId: "01001a",
    hero: "Spider-Man",
    detail: "Justice · Spidey's deck · 40 cards",
    mods: "pack v1",
    picture: { src: "/spidey.png" },
  },
  noDeck: "No deck yet",
  holder: { text: "Ana (you)", held: true, connected: true },
  requestedByMe: null,
  mismatch: "Different build",
  action: button("seat:s1", "Leave", { type: "seat", seat: "s1", action: "leave" }),
  play: button("play:s1", "Take over", { type: "seat-play", seat: "s1", kind: "takeOver" }),
  give: {
    toggle: button("give:s1", "Give to...", { type: "seat-give", seat: "s1" }),
    open: true,
    candidates: [button("give:s1:p2", "Ben", { type: "seat-give", seat: "s1", participant: "p2" })],
    nobody: "Nobody to give it to",
  },
  problem: { heading: "Deck turned down", title: "Spidey's deck", reason: "Too few cards" },
  missingMods: [
    {
      text: "Needs pack v1",
      store: button("modstore:s1:pack", "Mod Store", { type: "mod-store", mod: "pack", seat: "s1" }),
    },
  ],
  deckButton: button("deck:s1", "Change deck", { type: "seat-deck", seat: "s1", kind: "choose" }),
  requests: [
    {
      text: "Ben asks for this seat",
      approve: button("approve:s1:p2", "Approve", {
        type: "seat-answer",
        seat: "s1",
        participant: "p2",
        answer: "approve",
      }),
      deny: button("deny:s1:p2", "Deny", { type: "seat-answer", seat: "s1", participant: "p2", answer: "deny" }),
    },
  ],
};

async function mount(model: LobbySeatRowModel): Promise<McLobbySeatRow> {
  const element = document.createElement("mc-lobby-seat-row") as McLobbySeatRow;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

/** Every lobby button in the row, through the nested button rows, in document order. */
const lobbyButtons = (root: ParentNode): LitElement[] =>
  [...root.querySelectorAll("*")].flatMap((node) => [
    ...(node.localName === "mc-lobby-button" ? [node as LitElement] : []),
    ...(node.shadowRoot ? lobbyButtons(node.shadowRoot) : []),
  ]);

const stops = (element: McLobbySeatRow): string[] =>
  lobbyButtons(element.shadowRoot!).map((b) => (b as unknown as { stop: string }).stop);

describe("mc-lobby-seat-row", () => {
  it("shows every part of a full seat, with every button on its own stop", async () => {
    const element = await mount(ROW);
    const root = element.shadowRoot!;
    expect(root.querySelector(".tag")?.textContent).toBe("SEAT 1 · PRESET");
    expect(root.querySelector(".hero")?.textContent).toBe("Spider-Man");
    expect(root.querySelector(".who")?.textContent).toBe("Ana (you)");
    expect(root.querySelector(".dot")?.hasAttribute("data-filled")).toBe(true);
    expect(root.querySelector(".mismatch")?.textContent).toBe("Different build");
    expect(root.querySelector(".problem-heading")?.textContent).toBe("Deck turned down");
    expect(root.querySelector(".row")?.hasAttribute("data-mine")).toBe(true);
    expect(stops(element)).toEqual([
      "seat:s1",
      "play:s1",
      "give:s1",
      "give:s1:p2",
      "modstore:s1:pack",
      "deck:s1",
      "approve:s1:p2",
      "deny:s1:p2",
    ]);
  });

  it("draws a bare open seat: a ? frame, the no-deck words, a hollow dot, no buttons", async () => {
    const element = await mount({
      ...ROW,
      mine: false,
      deck: null,
      holder: { text: "Open", held: false, connected: false },
      mismatch: null,
      action: null,
      play: null,
      give: null,
      problem: null,
      missingMods: [],
      deckButton: null,
      requests: [],
    });
    const root = element.shadowRoot!;
    expect(root.querySelector(".blank")?.textContent).toBe("?");
    expect(root.querySelector(".hero")?.textContent).toBe("No deck yet");
    expect(root.querySelector(".dot")?.hasAttribute("data-filled")).toBe(false);
    expect(root.querySelector(".buttons")).toBeNull();
    expect(root.querySelector("mc-lobby-button")).toBeNull();
  });

  it("says nobody when the Give list is open with no candidates", async () => {
    const element = await mount({ ...ROW, give: { ...ROW.give!, candidates: [] } });
    expect(element.shadowRoot!.querySelector(".nobody")?.textContent).toBe("Nobody to give it to");
  });

  it("raises each button's command", async () => {
    const element = await mount(ROW);
    const seen: unknown[] = [];
    const pressed: unknown[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push(event.detail));
    document.body.addEventListener("mc-pressed", (event) => pressed.push(event));
    const buttons = lobbyButtons(element.shadowRoot!);
    await Promise.all(buttons.map((b) => b.updateComplete));
    for (const b of buttons) b.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(pressed).toEqual([]);
    expect(seen).toHaveLength(8);
    expect(seen[0]).toEqual({ type: "seat", seat: "s1", action: "leave" });
    expect(seen[6]).toEqual({ type: "seat-answer", seat: "s1", participant: "p2", answer: "approve" });
  });

  it("raises the card hover for the hero's picture", async () => {
    const element = await mount(ROW);
    const seen: string[] = [];
    element.addEventListener("mc-card-hover", (event) => seen.push((event as CustomEvent).detail.cardId));
    const enter = new Event("pointerenter") as Event & { pointerType?: string };
    enter.pointerType = "mouse";
    element.shadowRoot!.querySelector("mc-picture-tile")!.dispatchEvent(enter);
    expect(seen).toEqual(["01001a"]);
  });
});
