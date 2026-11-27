/**
 * Guards a panel's `mc-activate` at the point it is dispatched. A region's `pointer-events` is only updated in the
 * scene's `postupdate`, so it is no synchronous guard: a tap that lands between a scene turning its input off or being
 * told to stop and the next frame would still run the action (a second Send, Concede, Confirm). The scene's own state
 * is read at the dispatch instead.
 */

/** The slice of a scene the gate reads. */
export interface GatedScene {
  readonly sys: { isActive(): boolean };
  readonly input?: { readonly enabled: boolean };
  readonly events: {
    on(event: string, fn: () => void): unknown;
    off?(event: string, fn: () => void): unknown;
  };
}

/** Whether the scene takes a press right now: running, with its input on (an exit that turns it off is playing). */
export function sceneTakesPresses(scene: GatedScene): boolean {
  return scene.sys.isActive() && scene.input?.enabled !== false;
}

/**
 * Lets one activation through until the scene's next frame, and none while it isn't taking presses. A scene told to
 * stop (or one that starts closing) does not step again, so the gate stays shut for a tap that arrives before the
 * stop is processed; a scene that stays up (a Send that redraws) opens it again with the next frame.
 */
export class ActivationGate {
  readonly #scene: GatedScene;
  #taken = false;
  readonly #reopen = (): void => {
    this.#taken = false;
  };

  constructor(scene: GatedScene) {
    this.#scene = scene;
    scene.events.on("postupdate", this.#reopen);
  }

  /** True once per frame, and only while the scene takes presses; the caller runs its action on true. */
  take(): boolean {
    if (this.#taken || !sceneTakesPresses(this.#scene)) return false;
    this.#taken = true;
    return true;
  }

  destroy(): void {
    this.#scene.events.off?.("postupdate", this.#reopen);
  }
}
