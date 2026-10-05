import { expect, test, type Page } from "@playwright/test";
import { activeScenes, focusRect, handInstanceFor, pressAt, pressUntil, settle, tapAt, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";

/**
 * A hand play with several legal hosts asks which one, on the phone as on the desktop (RRG 1.8 erratum p. 69: Energy
 * Transfer attaches Touched "to a character other than Rogue"). Rogue and Spider-Man against Rhino list Rhino and
 * Peter Parker as hosts; seed 4 deals Rogue Energy Transfer (38007) in her opening hand. Playing it, by a tap on the
 * phone (card, then Inspect's Play) or a click on the desktop, must put up the host question and send nothing.
 */

const SEED = 4;
const TRANSFER = "38007";

const touchedHost = (page: Page): Promise<string | null | undefined> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { game?: { instances: Record<string, { cardId: string; attachedTo: string | null }> } } };
      };
    };
    const touched = Object.values(appSession().store.state.game?.instances ?? {}).find((i) => i.cardId === "38002");
    return touched ? touched.attachedTo : undefined;
  });

test.describe("Energy Transfer asks for its host", () => {
  test("playing it from the hand asks which character, and sends nothing until one is picked", async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    await installWave6Helpers(page);
    await openApp(page);

    // A real game through the store (the call Table setup makes), jumped to the Board.
    const dealt = await page.evaluate(
      async ([seed, code]) => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => {
            store: {
              start: (cfg: unknown) => Promise<void>;
              state: {
                game?: { players: { hand: string[] }[]; instances: Record<string, { cardId: string }> };
              };
            };
          };
        };
        const { store } = appSession();
        await store.start({
          scenarioId: "rhino",
          difficulty: "standard",
          players: [{ starterDeckId: "rogue-protection" }, { starterDeckId: "core-spider-man-justice" }],
          seed,
        });
        const game = store.state.game!;
        const held = game.players[0]!.hand.some((id) => game.instances[id]?.cardId === code);
        const scenes = (
          window as unknown as {
            __mcGame: {
              scene: {
                getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
                stop: (k: string) => void;
                start: (k: string) => void;
              };
            };
          }
        ).__mcGame.scene;
        for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
        scenes.start("Board");
        return held;
      },
      [SEED, TRANSFER] as const,
    );
    expect(dealt, "seed 4 deals Rogue Energy Transfer").toBe(true);
    await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
    await settle(page);
    await declineMulligans(page);
    await settle(page);

    // Rogue starts in her alter-ego; Energy Transfer is a hero action. Flipped through the store (setup, not the
    // behavior under test), the same command the Flip button sends.
    await page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: {
            dispatch: (c: unknown) => Promise<void>;
            state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
          };
        };
      };
      const { store } = appSession();
      const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    });
    await settle(page);

    const id = await handInstanceFor(page, TRANSFER);
    expect(id, "Energy Transfer is in Rogue's hand").not.toBeNull();
    expect(await touchedHost(page), "Touched is not on anyone yet").toBeNull();

    // Bring the card into view: the phone's hand is a row that scrolls sideways.
    const size = page.viewportSize()!;
    for (let i = 0; i < 14; i++) {
      const r = await focusRect(page, `card:${id}`);
      if (r && r.x >= 0 && r.x + r.width / 2 < size.width - 30) break;
      await page.mouse.move(size.width / 2, size.height - 120);
      await page.mouse.wheel(150, 0);
      await settle(page);
    }
    await settle(page, { quietMs: 200, maxMs: 800 });
    const rect = (await focusRect(page, `card:${id}`))!;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    if (phone) {
      // A tap on a hand card opens Inspect; its footer's Play is the way to play from there.
      await tapAt(page, cx, cy);
      await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
      await settle(page, { quietMs: 300, maxMs: 1500 });
      const play = (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && /^play( it)?$/i.test(t.text));
      expect(play, "Inspect offers Play").toBeDefined();
      await tapAt(page, play!.x, play!.y);
    } else {
      await pressAt(page, cx, cy);
    }

    // The host question is up, naming the card and the choice, with both hosts listed.
    await waitFor(
      async () =>
        (await visibleTexts(page)).some((t) => t.scene === "Board" && /LEGAL TARGETS/i.test(t.text)) ? true : null,
      "the host question",
      15000,
    );
    await settle(page, { quietMs: 300, maxMs: 1500 });
    const texts = (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text);
    expect(texts.join(" | ")).toMatch(/Energy Transfer/);
    expect(
      texts.some((t) => /2 LEGAL TARGETS/i.test(t)),
      "both hosts are offered",
    ).toBe(true);
    expect(texts, "Rhino is a host").toContain("Rhino");
    expect(texts, "so is Peter Parker").toContain("Peter Parker");
    expect(await touchedHost(page), "nothing was attached by asking").toBeNull();
    expect((await activeScenes(page)).includes("ChoiceOverlay")).toBe(false);

    // Picking the second host (not the one the engine's example would have taken) moves on to paying for the card. A
    // press that lands as the tile redraws under its own hover is lost (zero-gap synthetic events), so it repeats.
    const second = (await visibleTexts(page)).find((t) => t.scene === "Board" && t.text === "Peter Parker")!;
    const paying = async (): Promise<boolean> =>
      (await visibleTexts(page)).some((t) => t.scene === "Board" && /^PAYING/i.test(t.text));
    await pressUntil(
      page,
      async () => {
        if (phone) await page.touchscreen.tap(second.x, second.y);
        else await page.mouse.click(second.x, second.y);
      },
      paying,
      "payment opens after the host is picked",
    );
    expect(await touchedHost(page), "still nothing attached until it is paid for").toBeNull();
  });
});
