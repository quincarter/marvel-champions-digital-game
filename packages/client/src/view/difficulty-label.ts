/** The words for a game's difficulty, wherever one is shown: Pause, Game over, Table setup, Discord. */
import type { SessionConfig } from "../engine/host.js";

/** "Standard", "Expert", "Extreme", "Heroic 2", "Expert Heroic 2", "Expert Skirmish": the modes the game was set up with. */
export function difficultyLabelOf(config: Pick<SessionConfig, "difficulty" | "modes"> | null): string | null {
  if (!config) return null;
  const base =
    config.modes?.expert || config.difficulty === "expert"
      ? "Expert"
      : config.difficulty === "extreme"
        ? "Extreme"
        : "Standard";
  const heroic = config.modes?.heroic ?? 0;
  const added = [...(heroic > 0 ? [`Heroic ${heroic}`] : []), ...(config.modes?.skirmish ? ["Skirmish"] : [])];
  return added.length === 0 ? base : [...(base === "Standard" ? [] : [base]), ...added].join(" ");
}
