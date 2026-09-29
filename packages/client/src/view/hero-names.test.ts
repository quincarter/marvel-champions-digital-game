import { describe, expect, it } from "vitest";
import { DATA_ONLY_CARDS, type HeroIdentityCard } from "@mc/content";
import { CARDS_BY_ID } from "../content/pool.js";
import { cardDisplayName, heroFaceDisplayName, qualifiedHeroName } from "./hero-names.js";

const identity = (id: string): HeroIdentityCard => {
  // Shuri's pack isn't playable yet, so her identity comes from the data-only catalog.
  const card = CARDS_BY_ID.get(id) ?? DATA_ONLY_CARDS.find((candidate) => (candidate.id as string) === id);
  if (card?.type !== "hero_identity") throw new Error(`${id} is not a hero identity`);
  return card;
};

describe("hero display names", () => {
  it("tells the two Spider-Men apart by alter ego", () => {
    expect(cardDisplayName(identity("01001a"))).toBe("Spider-Man (Peter Parker)");
    expect(cardDisplayName(identity("27030a"))).toBe("Spider-Man (Miles Morales)");
    expect(heroFaceDisplayName(identity("27030a"))).toBe("Spider-Man (Miles Morales)");
  });

  it("tells the two Black Panthers apart by alter ego", () => {
    expect(cardDisplayName(identity("01040a"))).toBe("Black Panther (T'Challa)");
    expect(cardDisplayName(identity("51001a"))).toBe("Black Panther (Shuri)");
  });

  it("leaves every other hero, and an alter-ego face name, as printed", () => {
    expect(cardDisplayName(identity("27001a"))).toBe("Ghost-Spider");
    expect(qualifiedHeroName(identity("01001a"), "Peter Parker")).toBe("Peter Parker");
  });

  it("leaves a Spider-Man ally card alone", () => {
    expect(cardDisplayName(CARDS_BY_ID.get("27011")!)).toBe("Spider-Man");
  });
});
