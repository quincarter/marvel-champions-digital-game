/**
 * Starts a hero-mechanic "Try it" game (guided mode §3.14): the call `scenes/new-in-box.ts` (and Title's resume
 * prompt) use, the same shape as `guide/start-aspect-tryit.ts` — loads `guide/mechanic-tryit-config.ts`'s own
 * `SessionConfig`, keeps the dealt opening hand, answers every later setup choice with its first option, and marks
 * `appSession().guidedRun`/`guidedRunKind` so `BoardGuideMount` runs `guide/mechanic-lessons.ts`'s lesson.
 *
 * Forces Full guidance for this run only (`setGuideRunLevelOverride`), as the tutorial and aspect runs do.
 */
import { appSession } from "../session.js";
import { setGuideRunLevelOverride } from "./guide-store.js";
import { MECHANIC_TRYIT_CONFIGS } from "./mechanic-tryit-config.js";
import type { MechanicTryItId } from "./mechanic-tryits.js";

export async function startMechanicTryItGame(mechanic: MechanicTryItId): Promise<void> {
  setGuideRunLevelOverride("full");
  const { store } = appSession();
  const { config } = MECHANIC_TRYIT_CONFIGS[mechanic];
  // Stamped on the config so `SaveMeta.guided` (§3.12) records it at `create` time, as the aspect run does.
  await store.start({ ...config, guided: { kind: "mechanic", mechanic } });
  for (let pending = store.state.game?.pendingChoice; pending; pending = store.state.game?.pendingChoice) {
    const answer = pending.minSelections > 0 ? [pending.options[0]!.optionId] : [];
    const ok = await store.resolveChoice(answer);
    if (!ok) break;
  }

  appSession().guidedRun = true;
  appSession().guidedRunKind = { kind: "mechanic", mechanic };
  appSession().guidedRunAlreadyDone = undefined;
}
