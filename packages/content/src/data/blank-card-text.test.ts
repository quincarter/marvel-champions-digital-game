/**
 * Cards whose text box is blank (issue #807), across every card in `PLAYABLE_CARDS`. MarvelCDB has left `text` empty
 * on cards that do print rules text (Shawarma; earlier Nova's "Bring the War!" and Phoenix's Burning Hunger, both
 * fixed by curation), and the game then shows an empty box and runs no ability. Each blank card below was checked against its scan (`assets/card-art/bundles/cards/<id>.png`) and prints
 * no rules text, only resource or scheme icons, traits and flavour. A new blank card fails here until someone reads
 * its scan: add it to the list if it really is textless, or supply its text with a curation `textReplace`.
 */
import { describe, expect, it } from "vitest";
import { PLAYABLE_CARDS } from "./index.js";

const TEXTLESS_ON_THE_SCAN: ReadonlySet<string> = new Set([
  "01014", // Energy Absorption (resource)
  "01044", // Vibranium (resource)
  "01156", // Usurp the Throne (side scheme, hazard icon only)
  "16054", // Vendetta (side scheme, amplify icon only)
  "40196", // Pouches (resource)
  "45010", // Stored Energy (resource, Temporal trait)
  "47010a", // Plasmoid Energy (resource)
  "47010b",
  "47010c",
  "49011", // Master of Magnetism (resource, Magnetic trait)
  "51006", // Vibranium (resource)
]);

describe("blank card text", () => {
  it("only cards that print no rules text have a blank text box", () => {
    const blank = PLAYABLE_CARDS.filter((c) => "text" in c && c.text.printed.trim() === "").map((c) => c.id);
    expect(blank.filter((id) => !TEXTLESS_ON_THE_SCAN.has(id))).toEqual([]);
  });

  it("Shawarma prints Max 1 per deck (21183, MarvelCDB sends no text and deck_limit 3)", () => {
    const card = PLAYABLE_CARDS.find((c) => c.id === "21183");
    expect(card?.type).toBe("resource");
    expect(card && "text" in card ? card.text.printed : undefined).toBe("Max 1 per deck.");
    expect(card?.type === "resource" ? card.deckLimit : undefined).toBe(1);
  });
});
