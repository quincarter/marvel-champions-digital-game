import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import { buildPack } from "@mc/mod-sdk/build";
// @ts-expect-error: a plain .mjs script with no declarations
import { stagePackSource } from "../../../../scripts/lib/stage-pack.mjs";
import { buildScenarioWithLoadedPacks } from "../content/pool.js";
import { gameDeps, setGamePacks } from "../content/game-deps.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { boardModel } from "../view/board-model.js";
import { loadActivePacks } from "./active-packs.js";
import { loadedPacks, setLoadedPacks } from "./pack-registry.js";
import { IdbPackStore } from "./pack-store.js";

const COMMUNITY = fileURLToPath(new URL("../../../../content-packs/community", import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const outDirs: string[] = [];
afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  setLoadedPacks([]);
  setGamePacks(undefined);
});

/** Every community pack, built the way the store publishes it, installed and started through the client's own path. */
for (const packId of readdirSync(COMMUNITY).filter((name) => statSync(join(COMMUNITY, name)).isDirectory())) {
  describe(`community pack ${packId}`, () => {
    it("starts a one-seat game with its precon and builds the board model for the seat", async () => {
      const outDir = mkdtempSync(join(tmpdir(), "mc-community-"));
      outDirs.push(outDir);
      // CI has no pack pictures: build from a copy without the alternate-art list when the images are missing.
      const staged = stagePackSource(join(COMMUNITY, packId), packId);
      outDirs.push(staged.root);
      await buildPack(staged.src, outDir);
      const manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
      const files = new Map<string, Uint8Array>();
      for (const full of walk(outDir)) {
        const path = relative(outDir, full).split(sep).join("/");
        if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
          files.set(path, new Uint8Array(readFileSync(full)));
      }
      const store = new IdbPackStore({ factory: new IDBFactory() });
      await store.install(manifest, files);
      const [status] = await loadActivePacks(store);
      expect(status).toMatchObject({ id: packId, loaded: true });
      const decks = loadedPacks()[0]!.decks ?? [];
      expect(decks.length).toBeGreaterThan(0);
      for (const deck of decks) {
        // The setup screen's preview builds the scenario on the main thread first: it threw "no playable starter deck"
        // for a pack's precon and left a blank screen behind "Play 1 hero".
        const preview = buildScenarioWithLoadedPacks("rhino", {
          difficulty: "standard",
          players: [{ starterDeckId: deck.id }],
          seed: 11,
        });
        expect(preview.players).toHaveLength(1);
        const session = new SessionStore(new LocalEngineHost());
        await session.start({
          scenarioId: "rhino",
          difficulty: "standard",
          players: [{ starterDeckId: deck.id }],
          seed: 11,
        });
        for (let step = 0; step < 40; step++) {
          const legal = session.state.legal;
          if (!legal || legal.actions.kind !== "choice") break;
          const { choice } = legal.actions;
          await session.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
        }
        const game = session.state.game!;
        const seat = game.players[0]!.playerId;
        const model = boardModel(game, seat, gameDeps(), session.state.legal?.actions ?? null);
        expect(model.hand.length).toBeGreaterThan(0);
      }
    }, 60_000);
  });
}
