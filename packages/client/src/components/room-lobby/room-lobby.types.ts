/**
 * The online room lobby's contract: the one `mc-room-lobby` event every section raises, the model each section takes, and
 * the focus-stop names. The page (`views/room-lobby/mc-room-lobby-page`) composes the sections; the scene
 * (`scenes/room-lobby.ts`, `scenes/room-lobby/*`) builds `LobbyPageModel` from the room's state and handles the events.
 * Every word arrives translated and every picture arrives as a `PictureSource` the scene leased; a section knows nothing of
 * the room, the engine or the settings. Sections are built to this file alone, in parallel: add to it (never reshape it) and say so.
 *
 * Every press in the lobby is a `LobbyEvent`. A pressable part is an `<mc-lobby-button>` carrying its `command` (the event it
 * raises); the section's `FeatureRelay<LobbyEvent>(this, LOBBY_EVENT)` turns the button's `mc-pressed` into `mc-room-lobby`.
 * Which focus stop a part is: `room-lobby.stops.ts`. Stop keys keep the names the specs and the pad route use.
 *
 * Panels that scroll expose `scroller` (their `list:<key>` element, which the pad's stick scrolls and the scene keeps the
 * position of): `mc-lobby-seats`, `mc-lobby-epic`, `mc-lobby-competitive` (all `list:seats`), `mc-lobby-settings`
 * (`list:settings`) and the chat's `mc-chat-lines` (`list:chat`).
 */
import type { ControlGlyph, PictureSource, TabRailTab } from "@mc/ui";
import type { ChatLinesModel } from "../room-chat/mc-chat-lines/mc-chat-lines.types.js";
import type { LobbyLayoutMode, LobbyPanelId } from "../../view/room-lobby-layout.js";

export type { ChatLinesModel, ControlGlyph, LobbyLayoutMode, LobbyPanelId, PictureSource, TabRailTab };

/** The one event the lobby's elements raise (composed, bubbling), `detail` discriminated by `type`. It is in `GUARDED_EVENTS`. */
export const LOBBY_EVENT = "mc-room-lobby";

export type LobbySeatActionKind = "ask" | "take" | "leave" | "withdraw" | "remove";

export type LobbyEvent =
  /** A disabled button that has a reason was pressed: the footer says why. */
  | { readonly type: "blocked"; readonly reason: string }
  /** The top bar's Leave (the host confirms first). */
  | { readonly type: "leave" }
  /** The header's Copy link. */
  | { readonly type: "copy-link" }
  /** A tab (or the stepped tab). */
  | { readonly type: "tab"; readonly tab: LobbyPanelId }
  /** The host's "Set up the table" / "Set up again". */
  | { readonly type: "setup" }
  /** The seat-count stepper: the count it would make (clamped by the scene). */
  | { readonly type: "seat-count"; readonly to: number }
  /** The start result's Dismiss. */
  | { readonly type: "dismiss-result" }
  /** A seat's own action (Ask, Take, Leave, Withdraw, Remove); `participant` is whose seat Remove takes it from. */
  | {
      readonly type: "seat";
      readonly seat: string;
      readonly action: LobbySeatActionKind;
      readonly participant?: string;
    }
  /** The host takes over an away seat, or gives a taken-over one back. */
  | { readonly type: "seat-play"; readonly seat: string; readonly kind: "takeOver" | "giveBack" }
  /** "Give to...": without `participant` it opens or shuts the seat's list; with one it gives the seat to them. */
  | { readonly type: "seat-give"; readonly seat: string; readonly participant?: string }
  /** The host's answer to a request for the seat. */
  | {
      readonly type: "seat-answer";
      readonly seat: string;
      readonly participant: string;
      readonly answer: "approve" | "deny";
    }
  /** Choose your deck / Change deck (mine), Set deck (the host on another's seat, `preset`). */
  | { readonly type: "seat-deck"; readonly seat: string; readonly kind: "choose" | "preset" }
  /** The Mod Store opened on a pack; from a seat (`seat`) or from the mods list. */
  | { readonly type: "mod-store"; readonly mod: string; readonly seat?: string }
  /** A settings row (toggle, choice, the mode card's Change, the header's Live now): `key` is its stop key. */
  | { readonly type: "setting"; readonly key: string }
  /** A plain button of the Epic panel, by stop key (`epic:fewer`, `rename:<table>`, `drop:<table>`). */
  | { readonly type: "epic"; readonly key: string }
  /** A plain button of the Competitive panel, by stop key (`comp:size1`, `team:<seat>`, `ready:<team>`). */
  | { readonly type: "competitive"; readonly key: string }
  /** The chat's window buttons: open the floating chat, shut it, pop it out, bring it back. */
  | { readonly type: "chat"; readonly what: "open" | "close" | "popout" | "bring-back" }
  /** The footer's buttons. */
  | { readonly type: "footer"; readonly action: "start" | "stay" | "close-room" | "back-title" };

export const lobbyEvent = (detail: LobbyEvent): CustomEvent<LobbyEvent> =>
  new CustomEvent(LOBBY_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-room-lobby": CustomEvent<LobbyEvent>;
  }
}

// ---- Shared parts -----------------------------------------------------------------------------------------------------

export type LobbyButtonKind = "primary" | "secondary" | "quiet" | "onInk";

/** A button's face and what it does: `<mc-lobby-button .model=${button}>`. */
export interface LobbyButtonModel {
  /** Its `data-stop` key. */
  readonly stop: string;
  readonly label: string;
  readonly kind: LobbyButtonKind;
  /** The event a press raises. */
  readonly command: LobbyEvent;
  /** On / chosen. */
  readonly selected?: boolean;
  /** False: dimmed; a press raises `{ type: "blocked", reason }` when there is a reason, else nothing. */
  readonly enabled?: boolean;
  readonly reason?: string;
  /** Its accessible name when the label is a symbol ("−"). */
  readonly aria?: string;
  /** A Bangers label (Start). */
  readonly display?: boolean;
}

/** One to three buttons across a row (a plus and a minus, a pair of choices). */
export type LobbyButtonRow = readonly LobbyButtonModel[];

// ---- Header, tabs, footer --------------------------------------------------------------------------------------------

/** The top bar (Leave, the title, the role) and the code strip under it. */
export interface LobbyHeaderModel {
  readonly title: string;
  /** "Leave" with its capitals, or "◂" on a phone (`backName` names it). */
  readonly backLabel: string;
  readonly backName: string;
  readonly backGlyph: ControlGlyph | null;
  /** The caption at the bar's right: the player's role. */
  readonly role: string;
  /** "ROOM", the strip's small heading, and the code as shown. */
  readonly eyebrow: string;
  readonly code: string;
  readonly copy: LobbyButtonModel;
  /** The host's Live now toggle, when the strip has room for it (else it leads the settings). */
  readonly listed: LobbyButtonModel | null;
  /** The connection line ("Reconnecting..."), or null. */
  readonly connection: string | null;
  /** The keyboard is up over the Chat tab: the strip gives way. */
  readonly hidden: boolean;
}

export interface LobbyTabsModel {
  readonly tabs: readonly TabRailTab[];
  readonly selected: LobbyPanelId;
}

export interface LobbyFooterModel {
  /** The footer's line of words. */
  readonly words: string;
  readonly bold: boolean;
  /** The host's Start, a Stay / Close pair, or Back to title; empty for a guest. */
  readonly buttons: LobbyButtonRow;
  readonly hidden: boolean;
}

// ---- The seats panel (standard) --------------------------------------------------------------------------------------

export interface LobbySeatCountModel {
  /** "Seats: 3". */
  readonly label: string;
  readonly less: LobbyButtonModel;
  readonly more: LobbyButtonModel;
  readonly hint: string;
}

export interface LobbyPlanItemModel {
  readonly key: string;
  /** "VILLAIN · Rhino" or a set's name. */
  readonly name: string;
  readonly picture: PictureSource;
  /** The card the hover popover and Inspect open on (`watchCard`); absent: none. */
  readonly cardId?: string;
  readonly face?: "front" | "back";
}

/** "The table": what the host picked. */
export interface LobbyPlanModel {
  readonly heading: string;
  /** "Expert difficulty · Heroic 2". */
  readonly facts: string;
  readonly items: readonly LobbyPlanItemModel[];
  /** What it says when no modular set was chosen. */
  readonly noSets: string | null;
}

export interface LobbyStartResultModel {
  readonly headline: string;
  readonly lines: readonly string[];
  readonly dismiss: LobbyButtonModel;
}

export interface LobbySeatDeckModel {
  readonly cardId: string;
  readonly hero: string;
  /** "Justice · Spidey's deck · 40 cards". */
  readonly detail: string;
  readonly mods: string | null;
  readonly picture: PictureSource;
}

export interface LobbySeatRowModel {
  readonly id: string;
  readonly mine: boolean;
  /** "SEAT 2 · PRESET", already joined. */
  readonly tag: string;
  readonly deck: LobbySeatDeckModel | null;
  /** What it says with no deck ("No deck yet"). */
  readonly noDeck: string;
  /** Who holds it: the words, a filled dot while connected, hollow otherwise. */
  readonly holder: { readonly text: string; readonly held: boolean; readonly connected: boolean };
  readonly requestedByMe: string | null;
  /** "Different build", boxed. */
  readonly mismatch: string | null;
  readonly action: LobbyButtonModel | null;
  readonly play: LobbyButtonModel | null;
  /** The host's "Give to..." with its open list. */
  readonly give: {
    readonly toggle: LobbyButtonModel;
    readonly open: boolean;
    readonly candidates: LobbyButtonRow;
    readonly nobody: string;
  } | null;
  /** The deck the host turned down: boxed and headed, never colour alone. */
  readonly problem: { readonly heading: string; readonly title: string; readonly reason: string } | null;
  readonly missingMods: readonly { readonly text: string; readonly store: LobbyButtonModel }[];
  readonly deckButton: LobbyButtonModel | null;
  readonly requests: readonly {
    readonly text: string;
    readonly approve: LobbyButtonModel;
    readonly deny: LobbyButtonModel;
  }[];
}

export interface LobbyPersonModel {
  readonly id: string;
  /** "Ana (you)". */
  readonly name: string;
  /** "HOST", "PLAYER", "WATCHER" (the words, in capitals as shown). */
  readonly role: string;
  readonly device: string | null;
  /** Which small icon the device line carries (`view/play-platform-mark.ts`); null: none. */
  readonly platform: string | null;
  /** "Seat 1, Seat 2 · Different build". */
  readonly more: string | null;
  /** The one-line form the Epic and Competitive panels show: "Ana (you) · Host · Seat 1". */
  readonly line: string;
}

export interface LobbyPeopleModel {
  readonly heading: string;
  readonly rows: readonly LobbyPersonModel[];
  /** The Epic and Competitive panels list people as one line each. */
  readonly compact: boolean;
}

/** The standard seats panel (`mc-lobby-seats`). */
export interface LobbySeatsModel {
  readonly kind: "seats";
  /** The panel's heading; null on a tabbed layout (the tab says it). */
  readonly title: string | null;
  readonly host: boolean;
  /** The host's hint line. */
  readonly hint: string | null;
  /** "Set up the table" / "Set up again"; host only. */
  readonly setup: LobbyButtonModel | null;
  readonly seatCount: LobbySeatCountModel | null;
  /** The table plan; null while nothing is chosen. */
  readonly plan: LobbyPlanModel | null;
  /** A guest's line while the host has not chosen ("The host has not set the table up yet"), or the build mismatch note. */
  readonly note: string | null;
  readonly result: LobbyStartResultModel | null;
  /** What it says when there are no seats at all. */
  readonly noSeats: string | null;
  readonly rows: readonly LobbySeatRowModel[];
  readonly people: LobbyPeopleModel;
}

// ---- Epic ------------------------------------------------------------------------------------------------------------

export interface LobbyEpicTableModel {
  readonly id: string;
  readonly mine: boolean;
  readonly name: string;
  /** "Pod: Bomb Scare · Standard · Waiting". */
  readonly facts: string;
  readonly hostLine: string;
  /** The organizer's rows (rename + pod, difficulty + host, fewer + more seats) and the single buttons (watch, retry, drop). */
  readonly controls: readonly LobbyButtonRow[];
  readonly seats: readonly LobbySeatRowModel[];
}

/** The Epic seats panel (`mc-lobby-epic`) and its tables (`mc-lobby-epic-table`). */
export interface LobbyEpicModel {
  readonly kind: "epic";
  readonly title: string | null;
  readonly hint: string;
  /** The organizer's fewer / more tables, and the time limit with its note; null for everyone else. */
  readonly organizer: {
    readonly tables: LobbyButtonRow;
    readonly limit: LobbyButtonModel;
    readonly note: string;
  } | null;
  /** The time limit as a line, for everyone else. */
  readonly limitLine: string | null;
  readonly tables: readonly LobbyEpicTableModel[];
  readonly people: LobbyPeopleModel;
}

// ---- Competitive -----------------------------------------------------------------------------------------------------

export interface LobbyTeamModel {
  readonly team: string;
  readonly mine: boolean;
  /** "Registration (you)". */
  readonly title: string;
  /** "Sealed · Not ready". */
  readonly status: string;
  readonly seats: readonly { readonly row: LobbySeatRowModel; readonly move: LobbyButtonModel | null }[];
  /** The host with no seat speaks for this side. */
  readonly speak: LobbyButtonModel | null;
  readonly seal: LobbyButtonModel;
  readonly ready: LobbyButtonModel;
}

/** The Competitive seats panel (`mc-lobby-competitive`) and its team card (`mc-lobby-team`). */
export interface LobbyCompetitiveModel {
  readonly kind: "competitive";
  readonly title: string | null;
  readonly detail: string;
  readonly result: LobbyStartResultModel | null;
  /** 1v1 / 2v2 (the host before the start). */
  readonly sizes: LobbyButtonRow | null;
  readonly teams: readonly LobbyTeamModel[];
  readonly people: LobbyPeopleModel;
}

export type LobbySeatsPanelModel = LobbySeatsModel | LobbyEpicModel | LobbyCompetitiveModel;

// ---- Settings --------------------------------------------------------------------------------------------------------

/** A row of the settings. */
export type LobbySettingsItem =
  /** On / Off: the host's button, or (not `pressable`, or a guest) a read-only mark. */
  | {
      readonly kind: "toggle";
      readonly stop: string;
      readonly title: string;
      readonly detail: string;
      readonly on: boolean;
      readonly onLabel: string;
      readonly offLabel: string;
      readonly pressable: boolean;
      readonly command: LobbyEvent;
    }
  /** One choice of a few: the host's button with its detail under it, everyone else just the chosen one. */
  | {
      readonly kind: "choice";
      readonly stop: string;
      readonly title: string;
      readonly detail: string;
      readonly selected: boolean;
      readonly pressable: boolean;
      readonly command: LobbyEvent;
    }
  /** The current game mode: its small box of pictures, name and tagline, and the host's Change. */
  | {
      readonly kind: "mode";
      readonly pictures: readonly PictureSource[];
      readonly title: string;
      readonly tagline: string;
      readonly change: LobbyButtonModel | null;
    }
  /** A guest's line for a mod: "id v1" with Have / Missing, and the Mod Store when missing. */
  | {
      readonly kind: "mod";
      readonly name: string;
      readonly state: string;
      readonly store: LobbyButtonModel | null;
    }
  /** A plain line of words. */
  | { readonly kind: "text"; readonly text: string; readonly bold?: boolean };

export interface LobbySettingsGroup {
  readonly id: string;
  /** The rule-headed title; null for the group that leads the list. */
  readonly heading: string | null;
  readonly items: readonly LobbySettingsItem[];
}

export interface LobbySettingsModel {
  readonly title: string | null;
  /** "Connecting..." while the room has sent no settings: nothing else shows. */
  readonly loading: string | null;
  /** "Only the host changes these." */
  readonly readOnly: string | null;
  readonly groups: readonly LobbySettingsGroup[];
}

// ---- Chat ------------------------------------------------------------------------------------------------------------

export interface LobbyChatModel {
  readonly title: string | null;
  /** The floating panel: opaque, a heavier border, with Close (and Pop out). */
  readonly floating: boolean;
  /** Chat is turned off in the settings: only `off` shows. */
  readonly enabled: boolean;
  readonly off: string;
  /** The chat is in its own window: only `poppedText` and Bring back show. */
  readonly popped: boolean;
  readonly poppedText: string;
  readonly bringBack: LobbyButtonModel;
  readonly popBlocked: string | null;
  readonly popout: LobbyButtonModel | null;
  readonly close: LobbyButtonModel | null;
  readonly lines: ChatLinesModel;
  readonly compose: {
    readonly value: string;
    readonly placeholder: string;
    readonly sendLabel: string;
    readonly disabled: boolean;
  };
}

/** The closed floating chat's pill (or, while the chat is in its own window, a small card in its place). */
export interface LobbyChatPillModel {
  readonly open: LobbyButtonModel;
  readonly unread: number;
  readonly popped: boolean;
  readonly poppedText: string;
  readonly bringBack: LobbyButtonModel;
}

// ---- The page --------------------------------------------------------------------------------------------------------

export interface LobbyPageModel {
  readonly mode: LobbyLayoutMode;
  readonly phone: boolean;
  /** The panel the tabs show (the stacked layout's "seats" is already "settings"). */
  readonly active: LobbyPanelId;
  readonly header: LobbyHeaderModel;
  readonly tabs: LobbyTabsModel | null;
  readonly seats: LobbySeatsPanelModel;
  readonly settings: LobbySettingsModel;
  /** Null when the room has no chat panel on this layout. */
  readonly chat: LobbyChatModel | null;
  readonly pill: LobbyChatPillModel | null;
  readonly footer: LobbyFooterModel;
  /** The soft keyboard is up over the Chat tab: the chat takes every pixel, the header and footer give way. */
  readonly compact: boolean;
  /** Whether the floating chat is open (float mode). */
  readonly chatOpen: boolean;
}
