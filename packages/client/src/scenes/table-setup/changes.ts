/** Turns each `mc-setup` event the page raises into a change to the setup draft (the view models decide; this applies and redraws). */
import type { Scenario } from "@mc/content";
import { currentCardsById } from "../../content/pool.js";
import { installedSetupHouseRules } from "../../packs/game-packs.js";
import { progressionScope } from "../../progression/progression-scope.js";
import { toggleHoodIncludedSet } from "../../view/hood-modular-sets.js";
import { withRandomModularSets } from "../../view/modular-random.js";
import { toggleModularSet } from "../../view/modular-sets.js";
import { rollFirstPlayerIndex } from "../../view/seed.js";
import {
  rerollSeed,
  setDifficulty,
  setFirstPlayerIndex,
  toggleTowerDefenseSetupDamage,
  type SetupDraft,
} from "../../view/setup-draft.js";
import { applySetupOption } from "../../view/setup-options.js";
import type { SetupEventDetail } from "../../components/table-setup/shared/setup-events.types.js";
import { reportRoomSetup } from "../room-setup-report.js";

/** What the changes need of the screen. */
export interface ChangeHost {
  readonly draft: () => SetupDraft;
  readonly setDraft: (draft: SetupDraft) => void;
  readonly scenario: () => Scenario;
  readonly allowMoreModular: () => boolean;
  readonly redraw: () => void;
  readonly openGroups: () => Map<string, boolean>;
  readonly rerolled: (seed: number) => void;
  readonly toggleWatch: () => void;
  readonly openSetCards: (setId: string) => void;
  readonly openSetsSheet: () => void;
  readonly editScenario: () => void;
  readonly deal: () => void;
  readonly back: () => void;
  readonly seedInput: (value: string) => void;
  readonly seedFocus: (focused: boolean) => void;
}

export function applySetupEvent(h: ChangeHost, event: SetupEventDetail): void {
  /** Applies a draft change, then redraws. */
  const change = (next: (draft: SetupDraft) => SetupDraft): void => {
    h.setDraft(next(h.draft()));
    h.redraw();
  };
  switch (event.type) {
    case "back":
      return h.back();
    case "difficulty":
      return change((d) => setDifficulty(d, event.id as never));
    case "option":
      return change((d) =>
        applySetupOption(d, event.action, undefined, installedSetupHouseRules(), progressionScope()),
      );
    case "sets-sheet":
      return h.openSetsSheet();
    case "tower-defense":
      return change(toggleTowerDefenseSetupDamage);
    case "modular-toggle":
      change((d) => toggleModularSet(d, h.scenario(), event.id, undefined, h.allowMoreModular()));
      return reportRoomSetup("modular", h.draft().scenarioId as string);
    case "modular-random":
      return change((d) =>
        withRandomModularSets(d, h.scenario(), currentCardsById(), Math.random, { scope: progressionScope() }),
      );
    case "modular-cards":
      return h.openSetCards(event.id);
    case "hood-toggle":
      return change((d) => toggleHoodIncludedSet(d, h.scenario(), event.id));
    case "edit-scenario":
      return h.editScenario();
    case "group-toggle":
      h.openGroups().set(event.id, event.open);
      return h.redraw();
    case "seat-pick":
      return change((d) => setFirstPlayerIndex(d, event.index));
    case "seat-roll":
      return change((d) => setFirstPlayerIndex(d, rollFirstPlayerIndex(d.seed, d.seats.length)));
    case "reroll":
      h.setDraft(rerollSeed(h.draft()));
      h.rerolled(h.draft().seed);
      return h.redraw();
    case "watch":
      return h.toggleWatch();
    case "deal":
      return h.deal();
    case "seed-input":
      return h.seedInput(event.value);
    case "seed-focus":
      return h.seedFocus(event.focused);
  }
}
