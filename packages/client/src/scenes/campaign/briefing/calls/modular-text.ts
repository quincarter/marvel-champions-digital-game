/**
 * The modular-set call's words in the player's language. `modularSetCallOf` (`view/campaign-modular-call-model.ts`) words the
 * question, its explanation, the checked-off rule, each tile's card count and status in English; here each is matched and said in
 * Spanish. English passes through, and a sentence this table does not know (the model changed) reads in English, never blank:
 * `calls.test.ts` feeds every branch of the model through it, so a changed English sentence fails there.
 */
import type { CardLanguage } from "../../../../art/card-language.js";
import { artLanguageNow } from "../../../../art/art-source.js";
import type { ModularSetCallView, ModularSetTile } from "../../../../view/campaign-modular-call-model.js";

const SENTENCES_ES: Readonly<Record<string, string>> = {
  "Choose this issue's genre set.": "Elige el conjunto de género de este número.",
  "The sets you choose are set aside until setup brings them in, first pick first.":
    "Los conjuntos que elijas se apartan hasta que la preparación los incorpora, el primero elegido primero.",
  "Each set you choose is shuffled into the encounter deck for this issue.":
    "Cada conjunto que elijas se baraja en el mazo de encuentro de este número.",
  "A genre set is a themed pack of extra encounter cards that changes what this issue throws at you.":
    "Un conjunto de género es un paquete temático de cartas de encuentro extra que cambia lo que te lanza este número.",
  "Every set that was not checked off is already chosen, so a checked-off set may be reused.":
    "Todos los conjuntos que no están tachados ya están elegidos, así que se puede reutilizar uno tachado.",
  "A set used in an earlier issue is checked off in the campaign log and can't be chosen again.":
    "Un conjunto usado en un número anterior queda tachado en el registro de la campaña y no se puede elegir de nuevo.",
  "Nothing is checked off yet, so any of these sets may be chosen.":
    "Todavía no hay ninguno tachado, así que se puede elegir cualquiera de estos conjuntos.",
  "CHECKED OFF": "TACHADO",
  "CHECKED OFF · REUSABLE": "TACHADO · SE PUEDE REUTILIZAR",
};

/** The dominant card type a tile names (`SET_TYPE_LABELS` in `view/modular-sets.ts`, lowercased by the model). */
const TYPES_ES: Readonly<Record<string, string>> = {
  minions: "esbirros",
  "side schemes": "planes secundarios",
  treacheries: "traiciones",
  attachments: "anexos",
  environment: "entorno",
  obligations: "obligaciones",
};

const sentenceIn = (text: string): string => SENTENCES_ES[text] ?? text;

/** "Choose genre set 2 of 3." and its siblings, and the sentences of the table. */
function questionIn(text: string): string {
  const numbered = /^Choose genre set (\d+) of (\d+)\.$/.exec(text);
  return numbered ? `Elige el conjunto de género ${numbered[1]} de ${numbered[2]}.` : sentenceIn(text);
}

/** "6 cards · side schemes" as "6 cartas · planes secundarios". */
function detailIn(text: string): string {
  const match = /^(\d+) cards?(?: · (.+))?$/.exec(text);
  if (!match) return text;
  const count = Number(match[1]);
  const kind = match[2] ? (TYPES_ES[match[2]] ?? match[2]) : null;
  return [`${count} ${count === 1 ? "carta" : "cartas"}`, kind].filter(Boolean).join(" · ");
}

/** "CHOSEN · PICK 2" as "ELEGIDO · ELECCIÓN 2". */
function statusIn(text: string): string {
  const chosen = /^CHOSEN · PICK (\d+)$/.exec(text);
  return chosen ? `ELEGIDO · ELECCIÓN ${chosen[1]}` : sentenceIn(text);
}

const tileIn = (tile: ModularSetTile): ModularSetTile => ({
  ...tile,
  detail: detailIn(tile.detail),
  statusLabel: statusIn(tile.statusLabel),
});

/** `view` with its English sentences said in `lang`. */
export function modularViewIn(view: ModularSetCallView, lang: CardLanguage = artLanguageNow()): ModularSetCallView {
  if (lang === "en") return view;
  return {
    ...view,
    question: questionIn(view.question),
    explain: sentenceIn(view.explain),
    whatIs: sentenceIn(view.whatIs),
    rule: view.rule === null ? null : sentenceIn(view.rule),
    tiles: view.tiles.map(tileIn),
  };
}
