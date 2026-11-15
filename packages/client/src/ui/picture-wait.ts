/**
 * Waiting for pictures a screen drew without (issue #716): a screen that holds itself on the void until its pictures
 * are in (`holdScreenFor`) needs a promise that settles when they arrive. `ensurePictureLoaded` tells a waiter once a
 * batch of pictures has arrived, through the callback it was given; `PictureWait` turns that callback into a promise.
 * Plain TypeScript, no Phaser: the scenes own the drawing.
 */
export class PictureWait {
  #pending = false;
  #promise: Promise<void> | null = null;
  #resolve: (() => void) | null = null;

  /** Something was drawn without its picture, which is on its way. */
  expect(): void {
    this.#pending = true;
  }

  /**
   * The pictures being waited for have arrived: settles the wait. An arrow property, so the same function can be
   * handed to `ensurePictureLoaded` for every picture, which then tells it once per batch.
   */
  readonly arrived = (): void => {
    this.#pending = false;
    const resolve = this.#resolve;
    this.#promise = null;
    this.#resolve = null;
    resolve?.();
  };

  /** True while a picture expected since the last arrival is still on its way. */
  get pending(): boolean {
    return this.#pending;
  }

  /** Settles when the pictures expected so far have arrived, or at once when none are expected. */
  settled(): Promise<void> {
    if (!this.#pending) return Promise.resolve();
    this.#promise ??= new Promise<void>((resolve) => {
      this.#resolve = resolve;
    });
    return this.#promise;
  }
}

/**
 * `promise`, but settled (never rejected) after `ms` at the latest: a picture that fails to load is never announced,
 * so whatever waits on it moves on anyway.
 */
export function settleWithin(
  promise: Promise<unknown>,
  ms: number,
  timer: (callback: () => void, ms: number) => unknown = setTimeout,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (): void => resolve();
    timer(done, ms);
    promise.then(done, done);
  });
}
