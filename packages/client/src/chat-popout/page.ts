/**
 * The chat's pop-out window (`chat-popout.html`): the room code, the messages, a field and Send, in plain DOM. It joins the
 * room's BroadcastChannel (`live/chat-popout-protocol.ts`), says hello, beats while open, and says bye when it closes. It
 * never opens a socket: the game window's room worker is the only one, and this page only shows what it relays and
 * hands a line back.
 */
import "@fontsource/bangers/400.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/700.css";
import { en } from "../i18n/en.js";
import { es } from "../i18n/es.js";
import {
  Heartbeat,
  isPopoutToken,
  POPOUT_BEAT_MS,
  parseRoomToPopout,
  popoutChannelName,
  type PopoutSnapshot,
  type PopoutToRoom,
} from "../live/chat-popout-protocol.js";
import { detectPlatform } from "../platform/platform.js";
import { popoutCanSay, popoutOffersClose, popoutStatusOf, type PopoutStatus } from "../live/chat-popout-view.js";

const params = new URLSearchParams(location.search);
const catalog: Readonly<Record<string, string | undefined>> = params.get("lang") === "es" ? es : {};
const text = (key: keyof typeof en): string => catalog[key] ?? en[key];
document.documentElement.lang = params.get("lang") === "es" ? "es" : "en";
document.title = text("popout.title");

const INK = "#14110e";
const PAPER = "#f2ece0";
const PARCHMENT = "#e9e1d0";
const RED = "#c8102e";

const css = document.createElement("style");
css.textContent = `
  #chat { display: flex; flex-direction: column; box-sizing: border-box; height: 100%; padding: 12px; gap: 10px;
    background: ${INK}; color: ${PAPER}; font: 14px/1.35 "Public Sans", system-ui, sans-serif; }
  #chat header { display: flex; align-items: baseline; justify-content: space-between; border: 2px solid ${PAPER}; padding: 8px 12px; }
  #chat header small { letter-spacing: .12em; text-transform: uppercase; opacity: .7; font-weight: 700; }
  #chat header b { font: 34px/1 Bangers, Impact, sans-serif; letter-spacing: .12em; font-style: italic; }
  #lines { flex: 1; overflow-y: auto; background: ${PARCHMENT}; color: ${INK}; border: 3px solid ${PAPER}; padding: 8px;
    display: flex; flex-direction: column; gap: 4px; }
  .line { border: 1px solid rgba(20,17,14,.35); padding: 4px 8px; overflow-wrap: anywhere; }
  .line.mine { border: 2px solid ${INK}; font-weight: 700; }
  .note { opacity: .75; padding: 4px; }
  #notice { border: 2px solid ${PAPER}; padding: 8px 12px; display: none; gap: 10px; align-items: center; justify-content: space-between; }
  form { display: flex; gap: 8px; }
  input { flex: 1; min-width: 0; padding: 10px 12px; font: inherit; background: ${PAPER}; color: ${INK}; border: 3px solid ${PAPER}; }
  input:focus { outline: 3px solid ${RED}; }
  button { font: 700 13px "Public Sans", system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 10px 16px;
    cursor: pointer; border: 3px solid ${PAPER}; background: ${INK}; color: ${PAPER}; }
  button.send { background: ${RED}; }
  button:disabled, input:disabled { opacity: .5; cursor: default; }
`;
document.head.append(css);

const root = document.getElementById("chat") as HTMLElement;
root.innerHTML = `
  <header><div><small></small></div><b></b></header>
  <div id="lines" role="log" aria-live="polite"></div>
  <div id="notice"><span></span><button type="button"></button></div>
  <form><input type="text" maxlength="280" autocomplete="off" /><button class="send" type="submit"></button></form>`;
const q = <T extends Element>(selector: string): T => root.querySelector(selector) as T;
const roomLabel = q<HTMLElement>("header small");
const codeEl = q<HTMLElement>("header b");
const linesEl = q<HTMLElement>("#lines");
const notice = q<HTMLElement>("#notice");
const noticeText = q<HTMLElement>("#notice span");
const noticeButton = q<HTMLButtonElement>("#notice button");
const input = q<HTMLInputElement>("input");
const send = q<HTMLButtonElement>("button.send");
roomLabel.textContent = text("room.title");
send.textContent = text("room.chat.send");
input.placeholder = text("room.chat.placeholder");
noticeButton.textContent = text("popout.closeWindow");
/**
 * Closes this window. A script-opened browser window closes itself; a Tauri window needs the window API's own close
 * (`platform/desktop-window.ts` does the same for the game window), and `window.close()` may do nothing there.
 */
async function closeThisWindow(): Promise<void> {
  if (detectPlatform() === "tauri") {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
      return;
    } catch {
      // Falls through to the browser's close.
    }
  }
  window.close();
}
noticeButton.addEventListener("click", () => void closeThisWindow());

let snapshot: PopoutSnapshot | null = null;
let left = false;
let silent = false;
const heartbeat = new Heartbeat();

const roomId = params.get("room") ?? "";
const token = params.get("token");
// The channel belongs to the tab that opened this window: without its token there is no channel to join.
const channel = roomId && isPopoutToken(token) ? new BroadcastChannel(popoutChannelName(roomId, token)) : null;
const post = (message: PopoutToRoom): void => channel?.postMessage(message);

function statusWords(status: PopoutStatus): string {
  switch (status) {
    case "connecting":
      return text("popout.connecting");
    case "off":
      return text("room.chat.off");
    case "ended":
      return text("popout.ended");
    case "left":
      return text("popout.left");
    case "lost":
      return text("popout.lost");
    case "live":
      return "";
  }
}

/** The lines on screen are out of date: a snapshot arrived, or nothing has been drawn yet. */
let dirty = true;
function render(): void {
  const status = popoutStatusOf({ snapshot, left, silent });
  codeEl.textContent = snapshot?.code ?? "";
  const words = statusWords(status);
  notice.style.display = words ? "flex" : "none";
  noticeText.textContent = words;
  noticeButton.style.display = popoutOffersClose(status) ? "" : "none";
  const can = popoutCanSay(status);
  input.disabled = !can;
  send.disabled = !can;
  const lines = snapshot?.lines ?? [];
  if (!dirty) return;
  const first = linesEl.childElementCount === 0;
  dirty = false;
  const nearEnd = linesEl.scrollHeight - linesEl.scrollTop - linesEl.clientHeight < 40;
  linesEl.replaceChildren(
    ...(lines.length === 0 && can
      ? [Object.assign(document.createElement("div"), { className: "note", textContent: text("room.chat.empty") })]
      : lines.map((line) => {
          const row = document.createElement("div");
          row.className = line.mine ? "line mine" : "line";
          row.textContent = `${line.name}: ${line.text}`;
          return row;
        })),
  );
  if (first || nearEnd) linesEl.scrollTop = linesEl.scrollHeight;
}

function hear(raw: unknown): void {
  // Anything on the channel that is not a known message (or a snapshot of the right shape) is dropped unrendered.
  const message = parseRoomToPopout(raw);
  if (!message) return;
  heartbeat.beat(Date.now());
  silent = false;
  if (message.kind === "snapshot") {
    snapshot = message.snapshot;
    dirty = true;
  } else if (message.kind === "recall") {
    void closeThisWindow();
    return;
  } else if (message.kind === "left") {
    left = true;
  }
  render();
}

document.querySelector("form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (value === "" || input.disabled) return;
  post({ kind: "say", text: value });
  input.value = "";
});

if (channel) {
  channel.onmessage = (event: MessageEvent<unknown>) => hear(event.data);
  heartbeat.beat(Date.now());
  post({ kind: "hello" });
  setInterval(() => {
    if (left) return;
    // Heard nothing for a while (the game window reloaded, or was throttled past the timeout and wrote this window off):
    // say hello again rather than beat, so the room takes this window back and sends the snapshot.
    const quiet = !heartbeat.alive(Date.now());
    post(snapshot && !quiet ? { kind: "beat" } : { kind: "hello" });
    if (quiet !== silent) {
      silent = quiet;
      render();
    }
  }, POPOUT_BEAT_MS);
  addEventListener("pagehide", () => post({ kind: "bye" }));
} else if (import.meta.env.DEV && params.get("demo") === "1") {
  // Dev only: a made-up room to look at (no game window needed).
  snapshot = {
    code: "8F2CH9",
    live: 0,
    chatOn: true,
    ended: false,
    lines: Array.from({ length: 12 }, (_, i) => ({
      name: ["Ava", "Ben", "Cleo"][i % 3] ?? "Ava",
      text: `Message number ${i + 1}: who takes which hero, and are we playing the standard Rhino set?`,
      mine: i % 3 === 0,
    })),
  };
}
render();
input.focus();
