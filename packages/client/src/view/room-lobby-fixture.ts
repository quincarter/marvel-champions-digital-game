/**
 * A made-up room for the lobby's dev preview (`?screen=room-lobby&as=host|guest`, `scenes/boot-dev-jump.ts`): four seats,
 * a pending request, a seat held by someone away and one on another version, a dozen people and enough chat to scroll.
 * Screenshots and the e2e specs use it, so no room service has to run. Dev only: a production build never loads it.
 */
import {
  NO_ROOM,
  type RoomChatLine,
  type RoomDevice,
  type RoomParticipant,
  type RoomSeat,
  type RoomState,
} from "../live/room-state.js";

const NAMES = ["Ava", "Ben", "Cleo", "Dev", "Esi", "Finn", "Gus", "Hana", "Ivo", "Jun", "Kai"];

/** Varied devices for the made-up people (the last one sent none: an older client shows nothing). */
const DEVICES: readonly (RoomDevice | undefined)[] = [
  { platform: "android", form: "phone" },
  { platform: "web", form: "tablet" },
  { platform: "macos", form: "desktop" },
  { platform: "ios", form: "tablet" },
  undefined,
];

export function roomLobbyFixture(as: "host" | "guest"): RoomState {
  const host = as === "host";
  const participants: RoomParticipant[] = [
    {
      id: "p0",
      name: host ? "Mara (host)" : "Ava the host",
      role: "host",
      me: host,
      buildMatches: true,
      device: { platform: "windows", form: "desktop" },
      seats: [],
    },
    ...NAMES.map((name, i): RoomParticipant => ({
      id: `p${i + 1}`,
      name,
      role: "watcher",
      me: !host && i === 0,
      buildMatches: i !== 3,
      ...(DEVICES[i] ? { device: DEVICES[i] } : {}),
      seats: i === 0 ? ["s1"] : [],
    })),
  ];
  const seats: RoomSeat[] = [
    {
      id: "s1",
      label: "Spider-Man (Justice) — Core Set starter deck|01001a",
      holder: "p1",
      holderName: "Ava",
      holderConnected: true,
      mismatch: false,
      mine: !host,
      requests: [],
      requestedByMe: false,
      deck: null,
      deckProblem: null,
    },
    {
      id: "s2",
      label: "She-Hulk (Aggression) — Core Set starter deck|01019a",
      holder: null,
      holderName: null,
      holderConnected: false,
      mismatch: false,
      mine: false,
      requests: [
        { participant: "p2", name: "Ben" },
        { participant: "p4", name: "Dev" },
      ],
      requestedByMe: false,
      deck: null,
      deckProblem: null,
    },
    {
      id: "s3",
      label: "Captain Marvel (Leadership) — Core Set starter deck|01010a",
      holder: "gone",
      holderName: "Cleo",
      holderConnected: false,
      mismatch: false,
      mine: false,
      requests: [],
      requestedByMe: false,
      deck: null,
      deckProblem: null,
    },
    {
      id: "s4",
      label: "Iron Man (Aggression) — Core Set starter deck|01029a",
      holder: "p5",
      holderName: "Esi",
      holderConnected: true,
      mismatch: true,
      mine: false,
      requests: [],
      requestedByMe: false,
      deck: null,
      deckProblem: null,
    },
  ];
  const chat: RoomChatLine[] = Array.from({ length: 40 }, (_, i) => ({
    from: `p${i % 3}`,
    name: NAMES[i % 3] ?? "Ava",
    text: `Message number ${i + 1}: who takes which hero, and are we playing the standard Rhino set?`,
    at: i,
    mine: i % 3 === 0,
  }));
  return {
    ...NO_ROOM,
    role: host ? "host" : "guest",
    connection: "connected",
    roomId: "preview",
    code: "8F2CH9",
    link: "https://marvel.champions-digital-game.com/#join=8F2CH9",
    me: { id: host ? "p0" : "p1", name: host ? "Mara (host)" : "Ava" },
    participants,
    settings: {
      playMode: "strict",
      tableRules: {},
      mods: [{ id: "fan-pack", version: "1.2.0" }],
      multiSeat: false,
      chat: true,
      appVersion: "preview",
      contentVersion: "preview",
    },
    seats,
    mySeats: host ? [] : ["s1"],
    chat,
    buildMatches: true,
  };
}
