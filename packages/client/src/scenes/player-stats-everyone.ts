/**
 * Everyone's side of Your stats: the numbers (read on first use, never at launch; once per visit unless the read failed)
 * and "Share my games" (one press turns sharing on, as the Settings row does).
 */
import { loadGlobalStats } from "../global-stats/global-stats-client.js";
import { readConsent } from "../global-stats/global-consent.js";
import { shareFinishedGamesNow } from "../global-stats/share-now.js";
import { askAnswerAllowed } from "../view/global-ask.js";
import type { GlobalState } from "../view/global-stats-ui.js";

export class StatsEveryone {
  /** Everyone's numbers, as far as they have been read. */
  global: GlobalState = { kind: "idle" };
  /** The last press on "Share my games" failed. */
  shareFailed = false;
  #busy = false;
  /** When "Share my games" first appeared (ms), so a press in its first moments is ignored; null while it is not shown. */
  #shownAt: number | null = null;

  /** A new visit. */
  reset(): void {
    this.global = { kind: "idle" };
    this.shareFailed = false;
    this.#busy = false;
    this.#shownAt = null;
  }

  /** A failed read is tried again each time Everyone is chosen. */
  retryIfUnavailable(): void {
    if (this.global.kind === "unavailable") this.global = { kind: "idle" };
  }

  /** Whether the numbers still have to be read (Everyone is on show and nothing has asked yet). */
  get wantsRead(): boolean {
    return this.global.kind === "idle";
  }

  /** Reads everyone's numbers; `done` is called when they arrive. */
  async read(done: () => void): Promise<void> {
    this.global = { kind: "reading" };
    this.global = await loadGlobalStats();
    done();
  }

  /** Whether the share control is on show now (Everyone, sharing off): its first moments ignore a press. */
  noteShare(shown: boolean): void {
    if (!shown) this.#shownAt = null;
    else this.#shownAt ??= performance.now();
  }

  /** One press on "Share my games": true when sharing was turned on, false when saving failed, null when ignored. */
  async share(): Promise<boolean | null> {
    if (this.#busy || readConsent() === "on") return null;
    // A tap meant for a tab that lands as the button appears is not an answer (the same grace as the Title's ask).
    if (this.#shownAt === null || !askAnswerAllowed(this.#shownAt, performance.now())) return null;
    this.#busy = true;
    const saved = await shareFinishedGamesNow();
    this.#busy = false;
    this.shareFailed = !saved;
    return saved;
  }
}
