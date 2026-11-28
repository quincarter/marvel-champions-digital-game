import { describe, expect, it } from "vitest";
import { rankInputOf, titlePageInputOf, type TitleFacts } from "./title-page-model.js";
import { titleRankBadgeOf } from "./title-rank-badge.js";

const facts = (over: Partial<TitleFacts> = {}): TitleFacts => ({
  mode: "wide",
  starting: false,
  continue: null,
  games: [],
  gamesPanel: true,
  removing: null,
  removeBusy: false,
  removeError: null,
  civilWar: null,
  quit: false,
  promo: "art",
  online: { available: true, liveCount: null },
  packUpdates: 0,
  notice: { version: "v1.2.3" },
  banner: null,
  rank: titleRankBadgeOf(0),
  rankUp: null,
  footer: { cards: "1 / 2 cards live", version: "v1", discordLink: false, aside: null },
  status: null,
  problem: null,
  focused: null,
  theme: "moon",
  languageCode: "EN",
  languageOpen: false,
  musicOpen: false,
  topRowExtras: true,
  glyph: () => undefined,
  ...over,
});

const keys = (input: ReturnType<typeof titlePageInputOf>): string[] => input.menu.rows.map((row) => row.key);

describe("titlePageInputOf", () => {
  it("lists the menu in reading order, with Campaign alone where the Play online panel stands in", () => {
    expect(keys(titlePageInputOf(facts()))).toEqual([
      "new-game",
      "decks",
      "campaign",
      "extras",
      "past-games",
      "trophies",
      "stats",
      "how-to-play",
      "mod-store",
      "settings",
    ]);
    const wide = titlePageInputOf(facts());
    expect(wide.menu.rows.find((row) => row.key === "campaign")!.width).toBe("full");
    expect(wide.promo?.variant).toBe("art");
  });

  it("pairs Campaign with a Play online button on a phone, which has no panel, and no top row extras", () => {
    const phone = titlePageInputOf(facts({ mode: "phone", promo: "none", topRowExtras: false, gamesPanel: false }));
    const rows = phone.menu.rows;
    expect(rows.filter((row) => row.width === "half").map((row) => row.key)).toEqual([
      "campaign",
      "play-online",
      "extras",
      "past-games",
      "trophies",
      "stats",
      "how-to-play",
      "mod-store",
    ]);
    expect(rows.every((row) => row.key === "new-game" || row.kind === "onInk")).toBe(true);
    expect(phone.promo).toBeNull();
    expect(phone.icons.buttons.map((button) => button.key)).toEqual([
      "chrome:theme",
      "chrome:language",
      "chrome:music",
      "chrome:report",
    ]);
    expect(phone.rank.compact).toBe(true);
  });

  it("keeps the focus stop keys of the top row, with the store and Discord icons first on a wide screen", () => {
    const input = titlePageInputOf(facts({ packUpdates: 12, theme: "sun", languageCode: "ES", languageOpen: true }));
    const buttons = input.icons.buttons;
    expect(buttons.map((button) => button.key)).toEqual([
      "chrome:mod-store",
      "chrome:discord",
      "chrome:theme",
      "chrome:language",
      "chrome:music",
      "chrome:report",
    ]);
    expect(buttons[0]!.badge).toBe("9+");
    expect(buttons[2]!.icon).toBe("sun");
    expect(buttons[3]).toMatchObject({ label: "ES", lit: true });
  });

  it("says a Mod Store badge, a disabled Continue while starting, and Starting on the New game button", () => {
    const input = titlePageInputOf(
      facts({
        packUpdates: 2,
        starting: true,
        continue: { label: "Continue: Rhino", mark: null },
      }),
    );
    const rows = input.menu.rows;
    expect(rows.find((row) => row.key === "mod-store")!.badge).toBe("2");
    expect(rows.find((row) => row.key === "continue")).toMatchObject({ disabled: true, tall: true, kind: "primary" });
    expect(rows.find((row) => row.key === "new-game")!.disabled).toBe(true);
  });

  it("hangs the press glyph under the focused icon and on the notice bar only while they have focus", () => {
    const glyph = { specs: [], height: 16, ground: "ink" as const, openness: 1 };
    const on = titlePageInputOf(facts({ focused: "chrome:report", glyph: () => glyph }));
    expect(on.icons.buttons.find((button) => button.key === "chrome:report")!.glyph).toBe(glyph);
    expect(on.icons.buttons.find((button) => button.key === "chrome:music")!.glyph).toBeUndefined();
    expect(on.notice!.glyph).toBeUndefined();
    const notice = titlePageInputOf(facts({ focused: "release-notice", glyph: () => glyph }));
    expect(notice.notice!.glyph).toBe(glyph);
  });

  it("puts the games row in the menu only where there is no panel, and the footer's Discord link where the row has no icon", () => {
    expect(titlePageInputOf(facts({ gamesPanel: true })).games).toBeNull();
    const phone = titlePageInputOf(
      facts({
        mode: "phone",
        promo: "none",
        gamesPanel: false,
        topRowExtras: false,
        footer: { ...facts().footer, discordLink: true },
      }),
    );
    expect(phone.footer.links.map((link) => link.key)).toEqual(["discord", "release-notes"]);
    expect(phone.notice!.message).toContain("v1.2.3");
  });
});

describe("rankInputOf", () => {
  it("is one line with the points beside it when compact, and names the new rank in place of the bar on a rank-up", () => {
    const badge = titleRankBadgeOf(0);
    const compact = rankInputOf(badge, null, true);
    expect(compact.label).toContain(badge.rankLabel);
    expect(compact.label).toContain(badge.title);
    expect(compact.points).toBe(badge.pointsLabel);
    const up = rankInputOf(badge, "Rank up: Costumed Vigilante", false);
    expect(up).toMatchObject({ up: true, title: "Costumed Vigilante", points: null, next: null });
  });
});

describe("gamesInputOf through the page", () => {
  const save = (id: string, lastPlayedOn?: object) =>
    ({
      id,
      config: { scenarioId: "rhino", difficulty: "standard", players: [] },
      round: 2,
      updatedAt: 0,
      campaignId: null,
      ...(lastPlayedOn ? { lastPlayedOn } : {}),
    }) as never;
  const row = (id: string, needsUpdate: boolean) =>
    ({ id, title: id, kicker: null, detail: "Round 2", needsUpdate, save: save(id) }) as never;

  it("says a game needs an update only when a newer build wrote it, and lists the rows", () => {
    const input = titlePageInputOf(facts({ games: [row("a", false), row("b", true)] }));
    expect(input.games!.rows.map((r) => r.needsUpdate !== null)).toEqual([false, true]);
    expect(input.games!.enabled).toBe(true);
    expect(input.games!.confirming).toBeNull();
    const asking = titlePageInputOf(facts({ games: [row("a", false)], removing: "a", removeError: "x" }));
    expect(asking.games!.confirming).toMatchObject({ id: "a", error: "x" });
  });
});
