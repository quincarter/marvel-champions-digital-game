/**
 * Loads screens on demand (issue #226): only Boot, Title and the always-on chrome are registered at start
 * (`EAGER_SCENES`); every other scene is a dynamic import (`scene-table.ts`) registered with `scene.add` the first
 * time something starts, launches or runs it, or ahead of time in idle slots (`startIdlePreload`).
 *
 * The ~300 call sites that start a scene do not change. `installSceneLoader` wraps the Scene Plugin's `start`,
 * `launch`, `run`, `switch` and `bringToTop` once: a call that names a scene which is not registered yet waits for its
 * chunk, then makes the original call. While any such call is waiting, later calls queue behind it, so a
 * `launch(A)` then `bringToTop(A)` (or a `start(Board)` then `launch(Pause)`) still run in the order they were made.
 * `start` defers the whole call, including the stop of the calling scene, so the screen being left stays up (it is
 * already faded out by `goToScreen`) until the next one can begin: no black gap beyond the fade.
 *
 * Phaser's own answers for an unregistered key are harmless for the rest: `scene.get` is null, `isActive` and
 * `isVisible` are null, `stop`, `sleep` and `getIndex` do nothing. The few sites that read a scene they just launched
 * (`scene.get(SCENES.unlocks).events…`) are covered by `COMPANIONS` (`scene-order.ts`): the screen that does it only
 * starts once its sheets are registered.
 */

import type Phaser from "phaser";
import {
  DEV_ONLY_SCENES,
  EAGER_SCENES,
  IdlePreloader,
  idleSlot,
  insertionIndex,
  needed,
  preloadOrder,
} from "./scene-order.js";
import { SCENE_LOADERS } from "./scene-table.js";

type Key = string | Phaser.Scene | undefined;
type PluginMethod = (this: Phaser.Scenes.ScenePlugin, key: Key, ...rest: unknown[]) => unknown;

/** The keys that load on demand. */
export const LAZY_SCENE_KEYS: readonly string[] = Object.keys(SCENE_LOADERS);

/** Plugins with a `start` waiting on a chunk, so `goToScreen` can ignore a second tap during the wait. */
const startPending = new WeakSet<Phaser.Scenes.ScenePlugin>();

export function isStartPending(plugin: Phaser.Scenes.ScenePlugin): boolean {
  return startPending.has(plugin);
}

export interface SceneLoader {
  /** Loads and registers `key`; resolves at once when it already is. */
  load(key: string): Promise<void>;
  isRegistered(key: string): boolean;
}

let installed: SceneLoader | null = null;

/** The loader `installSceneLoader` made, or null before it ran (and in tests). */
export function sceneLoader(): SceneLoader | null {
  return installed;
}

export function installSceneLoader(game: Phaser.Game, ScenePlugin: typeof Phaser.Scenes.ScenePlugin): SceneLoader {
  const manager = game.scene;
  const loading = new Map<string, Promise<void>>();

  const isRegistered = (key: string): boolean => manager.getScene(key) !== null;
  const isLazy = (key: unknown): key is string => typeof key === "string" && key in SCENE_LOADERS;
  const missing = (keys: readonly string[]): string[] => keys.filter((key) => isLazy(key) && !isRegistered(key));

  const register = (key: string, scene: new () => Phaser.Scene): void => {
    if (isRegistered(key)) return;
    manager.add(key, scene, false);
    const added = manager.getScene(key);
    if (!added) return;
    // `add` appends; slot it back where `main.ts` used to register it, so overlays draw over their screens.
    const list = manager.scenes;
    list.splice(list.indexOf(added), 1);
    list.splice(
      insertionIndex(
        list.map((other) => other.sys.settings.key),
        key,
      ),
      0,
      added,
    );
  };

  const load = (key: string): Promise<void> => {
    if (isRegistered(key)) return Promise.resolve();
    const loader = SCENE_LOADERS[key];
    if (!loader) return Promise.resolve();
    let pending = loading.get(key);
    if (!pending) {
      pending = loader()
        .then((scene) => register(key, scene))
        .finally(() => loading.delete(key));
      loading.set(key, pending);
    }
    return pending;
  };

  // Deferred calls run one after another in the order they were made.
  let waiting = 0;
  let tail: Promise<void> = Promise.resolve();
  const defer = (keys: readonly string[], run: () => void, onSettled?: () => void): void => {
    waiting++;
    tail = tail
      .then(() => Promise.all(keys.map(load)))
      .then(
        () => undefined,
        (error: unknown) => console.error("[mc] loading a screen failed:", error),
      )
      .then(() => {
        try {
          run();
        } catch (error) {
          console.error("[mc] a deferred scene call failed:", error);
        }
      })
      .finally(() => {
        waiting--;
        onSettled?.();
      });
  };

  const proto = ScenePlugin.prototype as unknown as Record<string, PluginMethod>;
  const wrap = (name: "start" | "launch" | "run" | "switch" | "bringToTop"): void => {
    const original = proto[name]!;
    proto[name] = function (this: Phaser.Scenes.ScenePlugin, key: Key, ...rest: unknown[]): unknown {
      const target = key === undefined && name === "start" ? this.key : key;
      if (typeof target === "string") {
        const keys = name === "bringToTop" ? [target] : needed(target);
        if (waiting > 0 || missing(keys).length > 0) {
          if (name === "start") startPending.add(this);
          defer(
            keys,
            () => original.call(this, key, ...rest),
            name === "start" ? () => startPending.delete(this) : undefined,
          );
          return this;
        }
      }
      return original.call(this, key, ...rest);
    };
  };
  for (const name of ["start", "launch", "run", "switch", "bringToTop"] as const) wrap(name);

  // `game.scene.start("X")` from the console or a test reaches the manager directly.
  for (const name of ["start", "run"] as const) {
    const original = manager[name].bind(manager) as (key: Key, data?: object) => unknown;
    (manager as unknown as Record<string, unknown>)[name] = (key: Key, data?: object): unknown => {
      if (isLazy(key) && !isRegistered(key)) {
        void load(key).then(() => original(key, data));
        return manager;
      }
      return original(key, data);
    };
  }

  installed = { load, isRegistered };
  return installed;
}

/**
 * Loads the screens nobody has asked for yet, one per idle slot, likeliest-next first. Call once Title has drawn.
 */
export function startIdlePreload(loader: SceneLoader): IdlePreloader {
  const preloader = new IdlePreloader({
    keys: preloadOrder(LAZY_SCENE_KEYS.filter((key) => !EAGER_SCENES.includes(key) && !DEV_ONLY_SCENES.has(key))),
    load: (key) => loader.load(key),
    schedule: idleSlot,
    done: (key) => loader.isRegistered(key),
  });
  preloader.start();
  return preloader;
}
