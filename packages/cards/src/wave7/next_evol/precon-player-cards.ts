import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "./precon-cable-deck.js";
import { NEXT_EVOL_PRECON_DOMINO_DECK } from "./precon-domino-deck.js";

/**
 * The NeXt Evolution precons' aspect and basic cards no hero folder owns, one module per precon so two agents never
 * share a file: Cable's deck (40014-40030) and Domino's (40050-40064, plus the basic ally Hope Summers 40204).
 */
export const NEXT_EVOL_PRECON_PLAYER_CARDS: AbilityRegistry = mergeRegistries(
  NEXT_EVOL_PRECON_CABLE_DECK,
  NEXT_EVOL_PRECON_DOMINO_DECK,
);
