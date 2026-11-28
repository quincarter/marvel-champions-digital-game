/** Turns each section's events into changes to the setup draft (the view models decide; this applies and redraws). */
import { currentCardsById } from "../../../content/pool.js";
import { installedSetupHouseRules } from "../../../packs/game-packs.js";
import { progressionScope } from "../../../progression/progression-scope.js";
import { toggleHoodIncludedSet } from "../../../view/hood-modular-sets.js";
import { withRandomModularSets } from "../../../view/modular-random.js";
import { toggleModularSet } from "../../../view/modular-sets.js";
import { rollFirstPlayerIndex } from "../../../view/seed.js";
import { applySetupOption } from "../../../view/setup-options.js";
import {
  rerollSeed,
  setDifficulty,
  setFirstPlayerIndex,
  toggleTowerDefenseSetupDamage,
  type SetupDraft,
} from "../../../view/setup-draft.js";
import type { Scenario } from "@mc/content";
import { reportRoomSetup } from "../../room-setup-report.js";
import type { SectionEvents } from "./sections.js";

/** What the events need of the screen. */
export interface EventHost {
  readonly draft: () => SetupDraft;
  readonly setDraft: (draft: SetupDraft) => void;
  readonly scenario: () => Scenario;
  readonly allowMoreModular: () => boolean;
  readonly redraw: () => void;
  readonly openGroups: Map<string, boolean>;
  readonly rerolled: (seed: number) => void;
  readonly toggleWatch: () => void;
  readonly openSetCards: (setId: string) => void;
  readonly openSetsSheet: () => void;
  readonly editScenario: () => void;
  readonly deal: () => void;
  readonly back: () => void;
  readonly focusSeed: () => void;
}

export function eventsOf(h: EventHost): SectionEvents {
  /** Applies a draft change, then redraws. */
  const change = (next: (draft: SetupDraft) => SetupDraft): void => {
    h.setDraft(next(h.draft()));
    h.redraw();
  };
  const modular = (setId: string): void => {
    change((d) => toggleModularSet(d, h.scenario(), setId, undefined, h.allowMoreModular()));
    reportRoomSetup("modular", h.draft().scenarioId as string);
  };
  const roll = (): void => change((d) => setFirstPlayerIndex(d, rollFirstPlayerIndex(d.seed, d.seats.length)));
  return {
    difficulty: {
      pick: (id) => change((d) => setDifficulty(d, id as never)),
      option: (action) =>
        change((d) => applySetupOption(d, action, undefined, installedSetupHouseRules(), progressionScope())),
      setsSheet: h.openSetsSheet,
      toggleTowerDefense: () => change(toggleTowerDefenseSetupDamage),
    },
    modulars: {
      toggle: modular,
      random: () =>
        change((d) =>
          withRandomModularSets(d, h.scenario(), currentCardsById(), Math.random, { scope: progressionScope() }),
        ),
      cards: h.openSetCards,
      toggleHood: (id) => change((d) => toggleHoodIncludedSet(d, h.scenario(), id)),
      editScenario: h.editScenario,
      toggleGroup: (id, open) => {
        h.openGroups.set(id, open);
        h.redraw();
      },
    },
    seating: { pick: (index) => change((d) => setFirstPlayerIndex(d, index)), roll },
    summary: {
      reroll: () => {
        h.setDraft(rerollSeed(h.draft()));
        h.rerolled(h.draft().seed);
        h.redraw();
      },
      toggleWatch: h.toggleWatch,
      deal: h.deal,
      focusSeed: h.focusSeed,
    },
    back: h.back,
  };
}
