import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test as base, type Page } from "@playwright/test";
import { WebSocket, WebSocketServer } from "ws";
import { GameRoomLogic, sha256Hex, type RoomSocket } from "../../sync-worker/src/game-room.js";
import type { Participant } from "../../sync-worker/src/room-protocol.js";
import { MemoryStorage } from "../../sync-worker/src/test-support.js";

/**
 * A real room server for the live-watch specs (issue #876, docs/live-game-rooms.md). The e2e suite does not run the
 * sync Worker, and Playwright's `route` / `routeWebSocket` do not see the sockets and fetches the client makes from its
 * dedicated workers, so this listens on the address the dev build already uses for the sync service
 * (`DEV_SYNC_URL`, `http://localhost:8787`) and answers `POST /room` and the `/room/:id/ws` upgrade. Behind it is the
 * Worker's own room logic (`GameRoomLogic`, over an in-memory storage), so the specs run the true protocol: ordering,
 * rosters, resend, `closed`.
 *
 * One port means one server at a time across Playwright's workers: `startRoomServer` waits for the port to free up
 * (another spec of this kind is using it) and fails with a clear message if it never does (a `wrangler dev` of the
 * real Worker, say). `E2E_ROOM_PORT` overrides the port, which only helps when the dev server was started with a
 * matching `VITE_SYNC_URL`.
 */

export const ROOM_PORT = Number(process.env.E2E_ROOM_PORT ?? "8787");
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** A message as a client sent it: the parsed JSON, plus whether its socket said hello with a token (the host). */
export interface Sent {
  readonly v: number;
  readonly ch: string;
  readonly kind: string;
  readonly host: boolean;
  readonly [key: string]: unknown;
}

export interface RoomServerOptions {
  /** The room's participant cap (host included); a joiner past it is turned away `full`. */
  readonly maxParticipants?: number;
}

export interface ServerRoom {
  readonly id: string;
  /** Commands the room holds of the first table. */
  logLength(): number;
  /** Closes the room the way its idle or end rule does: everyone is told `closed`. */
  shutdown(reason?: "ended" | "idle" | "disabled"): Promise<void>;
}

export interface RoomServer {
  /** `POST /room` calls so far. */
  creates(): number;
  /** WebSocket connections opened so far. */
  sockets(): number;
  /** Everything clients sent, in order. */
  readonly sent: Sent[];
  /** The newest room created, or null before the first. */
  room(): ServerRoom | null;
  /** A raw watcher in `roomId` (it counts in the roster); `leave()` drops it. */
  joinWatcher(roomId: string): Promise<{ leave(): void }>;
  stop(): Promise<void>;
}

const tryListen = (server: Server, port: number): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.off("listening", onListening);
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve(true);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });

/** Starts the room server, waiting up to `waitMs` for the port to be free. */
export async function startRoomServer(options: RoomServerOptions = {}, waitMs = 240_000): Promise<RoomServer> {
  const rooms = new Map<string, { logic: GameRoomLogic; token: string }>();
  const sent: Sent[] = [];
  const clients = new Set<{ close(code?: number, reason?: string): void }>();
  let creates = 0;
  let sockets = 0;
  let newest: string | null = null;

  const roomOf = (id: string): ServerRoom => ({
    id,
    logLength: () => rooms.get(id)?.logic.logLength() ?? 0,
    shutdown: async (reason = "ended") => {
      await rooms.get(id)?.logic.shutdown(reason);
      rooms.delete(id);
    },
  });

  const codes = new Map<string, string>();
  const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const pickCode = (): string => [...randomBytes(6)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  const pick = (n: number): string => [...randomBytes(n)].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://x").pathname;
    if (request.method === "OPTIONS") {
      response.writeHead(204, CORS).end();
    } else if (request.method === "POST" && path === "/room") {
      creates++;
      let text = "";
      request.on("data", (chunk) => (text += chunk));
      request.on("end", () => {
        // A lobby room (`{ "lobby": true }`, what Host makes) gets a 6-character code that `GET /room/code/:code` resolves.
        let lobby = false;
        try {
          lobby = (JSON.parse(text) as { lobby?: unknown } | null)?.lobby === true;
        } catch {
          lobby = false;
        }
        const roomId = pick(12);
        const code = lobby ? pickCode() : null;
        const hostToken = pick(32);
        const limits = {
          maxParticipants: options.maxParticipants ?? 25,
          maxMessageBytes: 64 * 1024,
          maxLogBytes: 8 * 1024 * 1024,
        };
        const logic = new GameRoomLogic(new MemoryStorage(), limits);
        void sha256Hex(hostToken)
          .then((hash) => logic.create(hash, Date.now(), code ? { code, roomId } : undefined))
          .then(() => {
            rooms.set(roomId, { logic, token: hostToken });
            if (code) codes.set(code, roomId);
            newest = roomId;
            response.writeHead(201, { ...CORS, "Content-Type": "application/json" });
            response.end(JSON.stringify({ roomId, hostToken, table: "t1", ...(code ? { code } : {}) }));
          });
      });
    } else if (request.method === "GET" && /^\/room\/code\/[^/]+$/.test(path)) {
      const code = decodeURIComponent(path.slice("/room/code/".length)).replace(/[\s-]+/g, "").toUpperCase();
      const roomId = codes.get(code);
      if (roomId && rooms.has(roomId)) {
        response.writeHead(200, { ...CORS, "Content-Type": "application/json" });
        response.end(JSON.stringify({ roomId }));
      } else {
        response.writeHead(404, { ...CORS, "Content-Type": "application/json" });
        response.end(JSON.stringify({ reason: "not-found", error: "not found" }));
      }
    } else {
      response.writeHead(404, { ...CORS, "Content-Type": "application/json" });
      response.end(JSON.stringify({ reason: "not-found", error: "not found" }));
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const match = /^\/room\/([^/]+)\/ws$/.exec(new URL(request.url ?? "/", "http://x").pathname);
    wss.handleUpgrade(request, socket, head, (ws) => {
      sockets++;
      const room = match ? rooms.get(match[1]!) : undefined;
      if (!room) {
        ws.close(1011, "no such room");
        return;
      }
      let participant: Participant | null = null;
      let isHost = false;
      const adapter: RoomSocket = {
        send: (text) => ws.send(text),
        close: (code, reason) => ws.close(code, reason),
        getParticipant: () => participant,
        setParticipant: (p) => {
          participant = p;
        },
        clearParticipant: () => {
          participant = null;
        },
      };
      clients.add(ws);
      // Messages are handled one at a time per socket, as the Durable Object does.
      let chain: Promise<void> = Promise.resolve();
      ws.on("message", (data) => {
        const text = data.toString();
        const parsed = JSON.parse(text) as Omit<Sent, "host">;
        if (parsed.kind === "hello") isHost = typeof parsed.token === "string";
        sent.push({ ...parsed, host: isHost });
        chain = chain.then(() => room.logic.message(adapter, text));
      });
      ws.on("close", () => {
        clients.delete(ws);
        chain = chain.then(() => room.logic.close(adapter));
      });
    });
  });

  const deadline = Date.now() + waitMs;
  while (!(await tryListen(server, ROOM_PORT))) {
    if (Date.now() > deadline) {
      throw new Error(
        `Port ${ROOM_PORT} stayed busy for ${waitMs / 1000}s: the live-room e2e fixture needs it for its fake sync ` +
          `service (the dev build's DEV_SYNC_URL). Stop whatever listens there (a wrangler dev?) or wait for the other live spec.`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    creates: () => creates,
    sockets: () => sockets,
    sent,
    room: () => (newest ? roomOf(newest) : null),
    joinWatcher: (roomId) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${ROOM_PORT}/room/${roomId}/ws`);
        ws.on("error", reject);
        ws.on("open", () => ws.send(JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: ["watch"] })));
        ws.on("message", (data) => {
          if ((JSON.parse(data.toString()) as { kind: string }).kind === "welcome") {
            resolve({ leave: () => ws.close() });
          }
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        for (const client of clients) client.close();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Replaces the clipboard and share sheet with recorders: `window.__copied` holds what was copied last. */
export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied?: string | null };
    w.__copied = null;
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          w.__copied = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
}

export const copiedText = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window as unknown as { __copied?: string | null }).__copied ?? null);

/**
 * `test` with a `room` fixture: a room server for the length of one test, released for the next (one at a time).
 *
 * The fixture is `auto`: a spec that never names `room` (a two-browser room game starts its own room through the dev
 * jumps) still needs the server up, and it holds the port while it runs, so another spec's server never counts this
 * spec's `POST /room` calls (the dev build points every page at the same address).
 */
export const test = base.extend<{ room: RoomServer }>({
  room: [
    // eslint-disable-next-line no-empty-pattern -- Playwright needs the destructuring to see there are no dependencies
    async ({}, use) => {
      const server = await startRoomServer();
      try {
        await use(server);
      } finally {
        await server.stop();
      }
    },
    { timeout: 300_000, auto: true },
  ],
});
