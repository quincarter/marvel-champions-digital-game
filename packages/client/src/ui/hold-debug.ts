/**
 * `?holddebug=1`: a log in the corner of what a press does, for a long press that only inspects once the finger lifts
 * on a real phone (the owner, 2026-10-24; a phone emulator inspects mid-hold). It lists the browser's own touch and
 * pointer events, Phaser's press, the hold timer firing (with whether the press still counted as down and how far it
 * had moved) and Inspect opening, each with its time since the finger went down.
 *
 * Off unless asked for; `noteHold` is a no-op then.
 */

let log: ((line: string) => void) | null = null;

export function holdDebugWanted(search: string): boolean {
  return new URLSearchParams(search).get("holddebug") === "1";
}

/** A step of the hold gesture, from `ui/hold-target.ts`. */
export function noteHold(line: string): void {
  log?.(line);
}

export function installHoldDebug(onSceneStart: (listener: (key: string) => void) => void): void {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;bottom:0;z-index:20;pointer-events:none;padding:2px 6px;max-width:90vw;" +
    "font:11px/1.3 monospace;color:#0f0;background:rgba(0,0,0,0.8);white-space:pre";
  document.body.appendChild(box);
  const lines: string[] = [];
  let downAt = 0;
  let moves = 0;
  let startX = 0;
  let startY = 0;
  let far = 0;
  const write = (line: string): void => {
    lines.push(
      `${Math.round(performance.now() - downAt)
        .toString()
        .padStart(5)} ms  ${line}`,
    );
    while (lines.length > 14) lines.shift();
    box.textContent = lines.join("\n");
  };
  log = write;
  const opts = { capture: true, passive: true } as const;
  window.addEventListener(
    "touchstart",
    (event) => {
      downAt = performance.now();
      moves = 0;
      far = 0;
      const touch = event.touches[0];
      startX = touch?.clientX ?? 0;
      startY = touch?.clientY ?? 0;
      lines.length = 0;
      write("touchstart");
    },
    opts,
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      moves++;
      const touch = event.touches[0];
      if (touch) far = Math.max(far, Math.hypot(touch.clientX - startX, touch.clientY - startY));
      if (moves === 1 || moves % 10 === 0) write(`touchmove x${moves}, ${far.toFixed(1)} px from start`);
    },
    opts,
  );
  window.addEventListener("touchend", () => write(`touchend (${moves} moves, ${far.toFixed(1)} px)`), opts);
  window.addEventListener("touchcancel", () => write("touchcancel"), opts);
  window.addEventListener("pointercancel", () => write("pointercancel"), opts);
  window.addEventListener("contextmenu", () => write("contextmenu"), { capture: true });
  onSceneStart((key) => write(`scene start: ${key}`));
}
