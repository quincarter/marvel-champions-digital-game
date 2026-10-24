/**
 * Tells a listener when a scene comes up or goes down, with no polling: the Scene Systems' own `start`, `wake`,
 * `shutdown` and `sleep` are wrapped once (the way `scenes/scene-loader.ts` wraps the Scene Plugin), so every scene,
 * including those registered later, reports through the same four hooks. The listener does the least possible (one
 * small `postMessage`); the work of making sense of it is in the presence worker.
 */
import type Phaser from "phaser";

export interface SceneSignal {
  readonly up: boolean;
  readonly key: string;
  readonly campaignId?: string;
  readonly runId?: string;
}

type SystemsMethod = (this: Phaser.Scenes.Systems, data?: object) => unknown;

/** Installs the hooks once. `systems` is Phaser's `Scenes.Systems` class (or any scene's `sys` prototype). */
export function watchScenes(systems: { readonly prototype: object }, listener: (signal: SceneSignal) => void): void {
  const proto = systems.prototype as unknown as Record<string, SystemsMethod>;
  const wrap = (name: "start" | "wake" | "shutdown" | "sleep", up: boolean): void => {
    const original = proto[name]!;
    proto[name] = function (this: Phaser.Scenes.Systems, data?: object): unknown {
      const result = original.call(this, data);
      const settings = this.settings as { key: string; data?: { campaignId?: unknown; runId?: unknown } };
      const extra = up ? settings.data : undefined;
      listener({
        up,
        key: settings.key,
        ...(typeof extra?.campaignId === "string" ? { campaignId: extra.campaignId } : {}),
        ...(typeof extra?.runId === "string" ? { runId: extra.runId } : {}),
      });
      return result;
    };
  };
  wrap("start", true);
  wrap("wake", true);
  wrap("shutdown", false);
  wrap("sleep", false);
}
