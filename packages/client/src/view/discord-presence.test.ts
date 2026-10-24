import { describe, expect, test } from "vitest";
import {
  PRESENCE_DOWNLOAD_URL,
  PRESENCE_SITE_URL,
  clipText,
  heroesLabel,
  presenceOf,
  publicArtUrl,
  type PresenceGame,
} from "./discord-presence.js";

const GAME: PresenceGame = {
  kind: "oneOff",
  heroes: ["Spider-Man"],
  form: "hero",
  villain: "Rhino",
  villainStage: "Stage II",
  round: 3,
  phase: "player",
  difficulty: "Expert",
  villainArt: "/card-art/bundles/cards/01095.png",
  heroArt: "/card-art/bundles/cards/01001b.png",
};

describe("presenceOf", () => {
  test("nothing to show is null", () => expect(presenceOf(null)).toBeNull());

  test("the menus show the logo and a Get the game button", () => {
    expect(presenceOf({ screen: "menus", startedAt: 100 })).toEqual({
      details: "In the menus",
      startTimestamp: 100,
      largeImage: "logo",
      largeText: "Marvel Champions Digital Edition",
      buttons: [{ label: "Get the game", url: PRESENCE_DOWNLOAD_URL }],
    });
  });

  test("the deck builder and setup say what the player is doing", () => {
    expect(presenceOf({ screen: "deck", startedAt: 1 })?.state).toBe("Building a deck");
    expect(presenceOf({ screen: "setup", startedAt: 1 })?.state).toBe("Setting up a game");
  });

  test("a one-off game names the hero, villain, round, form and difficulty, with both pictures", () => {
    expect(presenceOf({ screen: "game", startedAt: 5, game: GAME })).toMatchObject({
      details: "One-off game · Spider-Man vs Rhino",
      state: "Round 3 · Hero form · Expert",
      startTimestamp: 5,
      largeImage: `${PRESENCE_SITE_URL}/card-art/bundles/cards/01095.png`,
      largeText: "Rhino · Stage II",
      smallImage: `${PRESENCE_SITE_URL}/card-art/bundles/cards/01001b.png`,
      smallText: "Spider-Man",
    });
  });

  test("alter-ego form and the villain phase", () => {
    expect(presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, form: "alterEgo" } })?.state).toBe(
      "Round 3 · Alter-ego form · Expert",
    );
    expect(presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, phase: "villain" } })?.state).toBe(
      "Round 3 · Villain phase · Expert",
    );
  });

  test("a campaign game names the box and the villain", () => {
    const activity = presenceOf({
      screen: "game",
      startedAt: 1,
      game: { ...GAME, kind: "campaign", campaignName: "The Mad Titan's Shadow", villain: "Thanos" },
    });
    expect(activity?.details).toBe("Campaign · The Mad Titan's Shadow · vs Thanos");
  });

  test("several heroes read as the lead and a count, and drop the form", () => {
    const activity = presenceOf({
      screen: "game",
      startedAt: 1,
      game: { ...GAME, heroes: ["Spider-Man", "Captain Marvel", "Hulk"], form: null },
    });
    expect(activity?.details).toBe("One-off game · Spider-Man +2 vs Rhino");
    expect(activity?.state).toBe("Round 3 · Expert");
    expect(activity?.smallText).toBe("Spider-Man +2");
  });

  test("setup before round one", () => {
    expect(presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, phase: "setup", round: 0 } })?.state).toBe(
      "Setting up the table · Expert",
    );
  });

  test("Game over reports the result", () => {
    const over = (result: "win" | "loss" | "conceded", round = 7) =>
      presenceOf({ screen: "gameOver", startedAt: 1, game: { ...GAME, result, round } })?.state;
    expect(over("win")).toBe("Won against Rhino in 7 rounds");
    expect(over("win", 1)).toBe("Won against Rhino in 1 round");
    expect(over("loss")).toBe("Lost to Rhino");
    expect(over("conceded")).toBe("Conceded against Rhino");
  });

  test("without villain art the hero is the big picture, and without either the logo", () => {
    const hero = presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, villainArt: null } });
    expect(hero?.largeImage).toBe(`${PRESENCE_SITE_URL}/card-art/bundles/cards/01001b.png`);
    expect(hero?.smallImage).toBeUndefined();
    const none = presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, villainArt: null, heroArt: null } });
    expect(none).toMatchObject({ largeImage: "logo", largeText: "Marvel Champions Digital Edition" });
  });

  test("the campaign screens name the box when known", () => {
    expect(presenceOf({ screen: "campaign", startedAt: 1, campaignName: "Sinister Motives" })).toMatchObject({
      details: "Campaign · Sinister Motives",
      state: "Between missions",
    });
    expect(presenceOf({ screen: "campaign", startedAt: 1 })?.details).toBe("Campaign");
  });

  test("every string fits Discord's 128 characters and none is under two", () => {
    const long = "A".repeat(300);
    const activity = presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, heroes: [long], villain: long } })!;
    for (const value of [activity.details, activity.state, activity.largeText, activity.smallText]) {
      expect([...(value ?? "")].length).toBeLessThanOrEqual(128);
    }
    const bare = presenceOf({ screen: "game", startedAt: 1, game: { ...GAME, difficulty: null, villain: null } });
    expect(bare?.details).toBe("One-off game · Spider-Man");
  });
});

describe("helpers", () => {
  test("clipText cuts whole code points", () => {
    const out = clipText("😀".repeat(200), 10);
    expect([...out]).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
    expect(clipText("short")).toBe("short");
  });

  test("heroesLabel", () => {
    expect(heroesLabel([])).toBe("");
    expect(heroesLabel(["Hulk"])).toBe("Hulk");
    expect(heroesLabel(["Hulk", "Thor"])).toBe("Hulk +1");
  });

  test("publicArtUrl", () => {
    expect(publicArtUrl("/card-art/a.png")).toBe(`${PRESENCE_SITE_URL}/card-art/a.png`);
    expect(publicArtUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(publicArtUrl("a.png")).toBeNull();
    expect(publicArtUrl(null)).toBeNull();
  });
});
