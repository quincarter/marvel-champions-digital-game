/**
 * A player card type's word on a card row ("ally", "side scheme"), in the current language (#390). Shared by Deck
 * check's card tiles and the name-conflict sheet's rows. A type with no catalog word reads as its code, spaced.
 */
import { t, type MessageKey } from "../i18n/translate.js";

const TYPE_KEYS: Readonly<Record<string, MessageKey>> = {
  ally: "cardType.ally",
  event: "cardType.event",
  upgrade: "cardType.upgrade",
  support: "cardType.support",
  resource: "cardType.resource",
  player_side_scheme: "cardType.sideScheme",
};

export function cardTypeWordOf(type: string): string {
  const key = TYPE_KEYS[type];
  return key ? t(key).toLowerCase() : type.replace(/_/g, " ");
}
