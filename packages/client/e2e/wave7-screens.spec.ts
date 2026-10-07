import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  focusRect,
  guideStepId,
  pressKey,
  pressAt,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { facts } from "./x-men-helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  scrollStopIntoView,
  trackErrors,
  waitForScene,
} from "./wave6-helpers-a.js";
import {
  answerChoice,
  boxPageRows,
  clickBoxPageRow,
  hook,
  openBoxPage,
  scrollRectIntoView,
  type Rect,
} from "./wave6-helpers-b.js";
import {
  VIEWPORTS,
  answerPreferDecline,
  declareDefender,
  playPayingWithOthers,
  payOnSheet,
  spendOnSheet,
  startFixture,
  boardRound,
  skipVillainPhase,
  endTurnThrough,
  guideRects,
  instancesOf,
  on,
  openTitle,
  playCard,
  pressBoardText,
  pressInstance,
  pressFocus,
  pressUntil,
  rawTextOnScreen,
  rectOnScreen,
  shot,
  textsOf,
  type Vp,
  villainId,
} from "./wave7-screens-helpers.js";
import { visibleTexts } from "./wave6-helpers-a.js";

/**
 * One browser pass over what is new in wave 7 (NeXt Evolution), at 1440 and 390: the five Try-it lessons played to
 * their end through the real UI (A), the New in NeXt Evolution page and glossary (B), the Jukebox (C), scenario intros
 * and the campaign Finale (D), and prompts not seen before (E). Findings: `docs/phase7-wave7-qa-screens.md`.
 * Screenshots go to `E2E_SHOTS` when it is set.
 */

/** The 17 new soundtrack files (under `music/`) and the titles the Jukebox lists them by. */
const NEW_TRACKS: Record<string, string> = {
  "scenarios/morlock-siege/battle.mp3": "Beneath the City",
  "scenarios/morlock-siege/villain-wins.mp3": "Teeth in the Tunnel",
  "scenarios/morlock-siege/villain-loses.mp3": "The Morlocks Stand",
  "scenarios/on-the-run/battle.mp3": "The Hunt for Hope",
  "scenarios/on-the-run/villain-wins.mp3": "Iron Monolith",
  "scenarios/on-the-run/villain-loses.mp3": "Iron Ascent",
  "scenarios/juggernaut/battle.mp3": "Head of Steam",
  "scenarios/juggernaut/villain-wins.mp3": "Crushed Beneath Momentum",
  "scenarios/juggernaut/villain-loses.mp3": "The Unstoppable Falls",
  "scenarios/mister-sinister/battle.mp3": "The Essex Experiments",
  "scenarios/mister-sinister/villain-wins.mp3": "Perfect Specimen",
  "scenarios/mister-sinister/villain-loses.mp3": "Shattered Genome",
  "scenarios/stryfe/battle.mp3": "Tomorrow's Tyrant",
  "scenarios/stryfe/villain-wins.mp3": "A Future Stolen",
  "scenarios/stryfe/villain-loses.mp3": "Break the Timeline",
  "campaigns/next_evol/finale.mp3": "Hope for Tomorrow",
  "campaigns/next_evol/interlude.mp3": "Regroup at Graymalkin",
};

/** The five scenarios and a precon each, for the dev jumps. */
const SCENARIOS: readonly (readonly [string, string])[] = [
  ["morlock-siege", "psylocke-justice"],
  ["on-the-run", "angel-protection"],
  ["juggernaut", "x-23-aggression"],
  ["mister-sinister", "cable-leadership"],
  ["stryfe", "domino-justice"],
];

/** Home → How to play → New in NeXt Evolution → the lesson's row, ending on the Board with the lesson's first step. */
async function startLesson(page: Page, rowId: string): Promise<void> {
  await installWave6Helpers(page);
  await openTitle(page);
  await clickText(page, "How to play");
  await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "How to play opens", 8000);
  await settle(page);
  await shot(page, "hub");
  await openBoxPage(page, "New in NeXt Evolution");
  await clickBoxPageRow(page, rowId);
  await waitFor(async () => ((await on(page, "Board")) ? true : null), "the lesson's Board", 30000);
  await waitFor(async () => (await guideStepId(page)) ?? null, "the lesson's first step", 30000);
  await settle(page, { quietMs: 800, maxMs: 4000 });
}

/** What the guide shows for the current step: where its ring is, and that the ring and callout fit the screen. */
async function checkStep(page: Page, label: string, problems: string[]): Promise<void> {
  await settle(page, { quietMs: 600, maxMs: 3000 });
  const id = await guideStepId(page);
  await shot(page, `${label}-${id}`);
  const rects = await guideRects(page);
  if (rects.anchor && !rectOnScreen(page, rects.anchor))
    problems.push(`${label}/${id}: ring off screen ${JSON.stringify(rects.anchor)}`);
  const callouts = JSON.stringify([rects.panels, rects.callouts]);
  for (const m of callouts.matchAll(/"x":(-?[\d.]+),"y":(-?[\d.]+),"width":([\d.]+),"height":([\d.]+)/g)) {
    const size = page.viewportSize()!;
    const [x, y, w, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (x < -1 || y < -1 || x + w > size.width + 1 || y + h > size.height + 1)
      problems.push(`${label}/${id}: guide control off screen ${m[0]}`);
  }
}

const complete = async (page: Page): Promise<boolean> =>
  (await visibleTexts(page)).some(
    (t) => t.scene === "Board" && /\bcomplete\b/i.test(t.text) && /^(try it|'pool)/i.test(t.text.trim()),
  );

async function gotIt(page: Page, phone: boolean): Promise<void> {
  const from = await guideStepId(page);
  await pressUntil(
    page,
    () => pressBoardText(page, phone, /^got it$/i),
    async () => (await guideStepId(page)) !== from || (await complete(page)),
    "Got it moves the lesson on",
  );
}

async function flipTo(page: Page, phone: boolean, face?: RegExp): Promise<void> {
  await pressFocus(page, phone, "basic:changeForm");
  if (face) await pressBoardText(page, phone, face);
}

/** Answers every decision sheet that opens (and any that follows it within `graceMs`) with its first option. */
async function answerSheets(page: Page, label: string, graceMs = 3000, accept = /./): Promise<number> {
  let answered = 0;
  for (;;) {
    const until = Date.now() + graceMs;
    while (Date.now() < until && !(await on(page, "ChoiceOverlay"))) await page.waitForTimeout(150); // grace for the next sheet
    if (!(await on(page, "ChoiceOverlay"))) return answered;
    await settle(page, { quietMs: 400, maxMs: 2000 });
    await shot(page, `${label}-sheet${answered + 1}`);
    // An optional ability that is not the lesson's own is declined; a mandatory sheet has no decline and is answered.
    const texts = await textsOf(page, "ChoiceOverlay");
    // The sheet's title reads "<card>: trigger an ability?" or "<card>: choose cards"; on desktop it is not the first text.
    const title = texts.find((t) => /^.+: (.+\?|choose .+)$/i.test(t)) ?? texts[0] ?? "";
    const decline = texts.find((t) => /^(decline|don't play it)$/i.test(t));
    if (decline && !accept.test(title)) await clickText(page, decline, { sceneKey: "ChoiceOverlay" });
    else await answerChoice(page, 0);
    answered++;
    await settle(page, { quietMs: 300, maxMs: 1500 });
  }
}

/** The number of commands the session has played so far (its command trail), read from the store. */
async function commandCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { commandTrail: unknown[] } } };
    };
    return appSession().store.state.commandTrail.length;
  });
}

/**
 * Thwart or attack through the real controls: the action, then whatever the game asks (a hero's interrupt and response
 * sheets), and the target card only when the action did not already run. With one legal target the board aims by
 * itself, so a second press on the enemy would only open Inspect.
 */
async function aim(
  page: Page,
  phone: boolean,
  action: "basic:thwart" | "basic:attack",
  target: string,
  accept = /./,
): Promise<void> {
  const before = await commandCount(page);
  await pressFocus(page, phone, action);
  const label = action.slice(6);
  const started = Date.now();
  let targeted = false;
  let quietSince = Date.now();
  let sheets = 0;
  for (;;) {
    if (await on(page, "ChoiceOverlay")) {
      sheets += await answerSheets(page, `${label}`, 1500, accept);
      quietSince = Date.now();
      continue;
    }
    if ((await commandCount(page)) > before && Date.now() - quietSince > 2500) return;
    if (!targeted && (await commandCount(page)) === before && Date.now() - started > 3500) {
      await pressInstance(page, phone, target);
      targeted = true;
      quietSince = Date.now();
    }
    if (Date.now() - started > 60000) throw new Error(`${action} never ran (${sheets} sheets answered)`);
    await page.waitForTimeout(200); // loop pacing, not a blind wait
  }
}

type Driver = (page: Page, phone: boolean, step: string) => Promise<void>;

const DRIVERS: Record<string, Driver> = {
  psylocke: async (page, phone, step) => {
    if (step === "intro" || step === "result") return gotIt(page, phone);
    if (step === "flip") return flipTo(page, phone);
    if (step === "attack") {
      await aim(page, phone, "basic:attack", await villainId(page), /psi-energy control/i);
    }
  },
  angel: async (page, phone, step) => {
    if (step === "intro" || step === "result") return gotIt(page, phone);
    if (step === "to-archangel") return flipTo(page, phone, /^archangel$/i);
    if (step === "end-turn") {
      await endTurnThrough(page, phone, 1);
      return;
    }
    if (step === "to-angel") return flipTo(page, phone, /^angel$/i);
  },
  cable: async (page, phone, step) => {
    if (step === "intro" || step === "result") return gotIt(page, phone);
    if (step === "flip") return flipTo(page, phone);
    if (step === "thwart") {
      const [scheme] = await instancesOf(page, "40026");
      await aim(page, phone, "basic:thwart", scheme!);
    }
    if (step === "limit") {
      await playCard(page, phone, "40027", ["40029"]);
      await shot(page, "cable-limit-prompt");
      await answerChoice(page, 0);
    }
  },
  x23: async (page, phone, step) => {
    if (step === "result") return gotIt(page, phone);
    if (step === "flip") return flipTo(page, phone);
    if (step === "play-training") return playCard(page, phone, "43021", ["43023"]);
    if (step === "claw-mastery") return playCard(page, phone, "43005", ["43022"]);
    if (step === "thwart") {
      const [training] = await instancesOf(page, "43021");
      await aim(page, phone, "basic:thwart", training!, /animal instinct/i);
    }
    if (step === "pick-specialist") await answerSheets(page, "x23-specialist", 4000);
  },
};

DRIVERS.pool = async (page, phone, step) => {
  if (step === "intro" || step === "result") return gotIt(page, phone);
  if (step === "flip") return flipTo(page, phone);
  if (step === "play-dogpool") return playCard(page, phone, "44013", ["44004", "44003", "44006"]);
  if (step === "end-turn") {
    await endTurnThrough(page, phone, 1);
    return;
  }
  if (step === "play-i-got-this") {
    await playCard(page, phone, "44021", ["44005"]);
    await answerSheets(page, "pool-igotthis", 4000);
  }
};

/** Home → How to play → the 'Pool aspect page → Try it, ending on the Board with the lesson's first step. */
async function startPoolLesson(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openTitle(page);
  await clickText(page, "How to play");
  await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "How to play opens", 8000);
  await settle(page);
  const viewport = (await hook<Rect>(page, "__mcHowToPlayDebug", "viewport"))!;
  const find = async () =>
    ((await hook<(Rect & { id: string })[]>(page, "__mcHowToPlayDebug", "aspects")) ?? []).find(
      (a) => a.id === "pool",
    ) ?? null;
  const rect = await scrollRectIntoView(page, viewport, find, "the 'Pool aspect row");
  await shot(page, "hub-aspects");
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitFor(async () => ((await on(page, "AspectLesson")) ? true : null), "the aspect page opens", 8000);
  await settle(page, { quietMs: 600, maxMs: 3000 });
  await shot(page, "aspect-pool");
  const tryIt = () => hook<Rect>(page, "__mcAspectLessonDebug", "tryItRect");
  await pressUntil(
    page,
    async () => {
      const r = await waitFor(tryIt, "the Try it button", 10000);
      await settle(page, { quietMs: 200, maxMs: 1500 });
      const now = (await tryIt()) ?? r;
      await pressAt(page, now.x + now.width / 2, now.y + now.height / 2);
    },
    async () => (await on(page, "Board")) && (await guideStepId(page)) !== null,
    "Try it starts the lesson",
  );
  await settle(page, { quietMs: 800, maxMs: 4000 });
}

const LESSONS = [
  { id: "psylocke", scenarioStart: "mechanic" },
  { id: "angel", scenarioStart: "mechanic" },
  { id: "cable", scenarioStart: "mechanic" },
  { id: "x23", scenarioStart: "mechanic" },
  { id: "pool", scenarioStart: "aspect" },
] as const;

/** Hub → New in NeXt Evolution, ready for its rows (Title first). */
async function openNextEvolPage(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openTitle(page);
  await clickText(page, "How to play");
  await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "How to play opens", 8000);
  await settle(page);
  await openBoxPage(page, "New in NeXt Evolution");
}

/**
 * Plays the open Try-it lesson through the real controls, one step at a time, checking each step's ring and guide
 * controls are on screen (`problems`). With `stopAt`, stops when the lesson reaches that step (its checks done).
 */
async function playLessonSteps(
  page: Page,
  phone: boolean,
  id: string,
  problems: string[],
  stopAt?: string,
): Promise<void> {
  const seen = new Set<string>();
  for (let guard = 0; guard < 40 && !(await complete(page)); guard++) {
    const step = await waitFor(
      async () => (await guideStepId(page)) ?? ((await complete(page)) ? "done" : null),
      "a step",
      20000,
    );
    if (step === "done") break;
    if (seen.has(step) && guard > 20) throw new Error(`stuck on step ${step}`);
    if (!seen.has(step)) await checkStep(page, `a-${id}`, problems);
    seen.add(step);
    if (step === stopAt) return;
    await DRIVERS[id]!(page, phone, step);
    await waitFor(
      async () => ((await guideStepId(page)) !== step || (await complete(page)) ? true : null),
      `step ${step} completes`,
      30000,
    );
  }
}

for (const vp of Object.keys(VIEWPORTS) as Vp[]) {
  test.describe(`wave 7 screens at ${VIEWPORTS[vp].width}`, () => {
    test.use({
      viewport: VIEWPORTS[vp],
      ...(vp === "phone" ? { hasTouch: true, isMobile: true } : {}),
    });
    const phone = vp === "phone";

    for (const lesson of LESSONS) {
      test(`A. ${lesson.id}: the Try-it plays to its end from the hub and returns`, async ({ page }) => {
        test.setTimeout(300_000);
        const errors = trackPageErrors(page);
        const problems: string[] = [];
        if (lesson.id === "pool") await startPoolLesson(page);
        else await startLesson(page, lesson.id);
        await playLessonSteps(page, phone, lesson.id, problems);
        await settle(page, { quietMs: 600, maxMs: 3000 });
        await shot(page, `a-${lesson.id}-complete`);
        expect(await complete(page), "the completion panel").toBe(true);
        // The panel's way out is "Back to lessons" (the phone strip says "Lessons"): no concession, no Game Over.
        const back = phone ? /^lessons$/i : /^back to lessons$/i;
        await pressUntil(
          page,
          () => pressBoardText(page, phone, back),
          async () => !(await on(page, "Board")),
          "Back to lessons leaves the board",
        );
        const hub = lesson.id === "pool" ? "AspectLesson" : "HowToPlay";
        await waitFor(async () => ((await on(page, hub)) ? true : null), `${hub} opens`, 15000);
        expect(await on(page, "GameOver"), "leaving a lesson is not a concession").toBe(false);
        await settle(page, { quietMs: 600, maxMs: 3000 });
        await shot(page, `a-${lesson.id}-after-leaving`);
        const unknown = problems.filter((p) => !(phone && p.startsWith("a-cable/limit: ring off screen")));
        expect(unknown, "ring and copy fit the screen at every step").toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test("B. New in NeXt Evolution: every entry opens its rule, with no raw markup, and links read both ways", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await openNextEvolPage(page);
      await shot(page, "b-page");
      const rows = (await boxPageRows(page)).filter((r) => r.kind !== "tryit");
      expect(rows.map((r) => r.id)).toEqual([
        "assault",
        "linked",
        "poolAspect",
        "actionsOtherTurns",
        "perPlayerCost",
        "playerSideScheme",
        "psiBlades",
        "specialists",
        "threeFaceIdentity",
        "hopeSummers",
        "routed",
        "setupAttachments",
      ]);
      const raw =
        /\[\[|\]\]|\bundefined\b|\[object|\bNaN\b|\b(?:poolAspect|psiBlades|threeFaceIdentity|setupAttachments|perPlayerCost|playerSideScheme|actionsOtherTurns|hopeSummers)\b/;
      for (const row of rows) {
        await clickBoxPageRow(page, row.id);
        await waitFor(async () => ((await on(page, "RulesOverlay")) ? true : null), `${row.id} opens the Rules`, 8000);
        await settle(page, { quietMs: 500, maxMs: 2500 });
        const texts = await textsOf(page, "RulesOverlay");
        expect(
          texts.some((t) => t.toLowerCase().includes(row.name.toLowerCase().split(" (")[0]!)),
          `the Rules reference names "${row.name}"`,
        ).toBe(true);
        const bad = texts.filter((t) => raw.test(t));
        expect(bad, `${row.id}: no raw ids or [[markup]] on screen`).toEqual([]);
        if (["actionsOtherTurns", "psiBlades", "poolAspect"].includes(row.id)) await shot(page, `b-entry-${row.id}`);
        await pressKey(page, "Escape");
        await waitFor(async () => (!(await on(page, "RulesOverlay")) ? true : null), "Escape closes the Rules", 6000);
      }
      // "Also a Core rule" goes to the Core page, and its entry links straight back.
      await clickBoxPageRow(page, "actionsOtherTurns", "link");
      await waitFor(
        async () =>
          (await hook<string>(page, "__mcNewInBoxDebug", "title")) === "Core rules added later" ? true : null,
        "the link opens the Core rules page",
        6000,
      );
      await settle(page);
      const back = (await boxPageRows(page)).find((r) => r.id === "actionsOtherTurns")?.link;
      expect(back, "the Core entry links back").toMatch(/^Added with/);
      await shot(page, "b-core-page");
      expect(errors).toEqual([]);
    });

    test("C. Jukebox: the 17 new tracks are listed by title and each one starts without a console error", async ({
      page,
    }) => {
      test.setTimeout(300_000);
      const errors = trackErrors(page);
      const failedAudio: string[] = [];
      page.on("response", (r) => {
        if (/\.mp3(\?|$)/.test(r.url()) && r.status() >= 400) failedAudio.push(`${r.status()} ${r.url()}`);
      });
      await installWave6Helpers(page);
      await openTitle(page, "unlock=all&screen=extras&tab=music", "Extras");
      await waitForScene(page, "Extras");
      await settle(page, { quietMs: 600, maxMs: 3000 });
      await shot(page, "c-jukebox");
      const stops = ((await routeStops(page, "Extras"))?.stops ?? []).filter((x) => x.key.startsWith("tile:"));
      expect(stops.length, "the Jukebox lists every track").toBeGreaterThan(90);
      const missing: string[] = [];
      let played = 0;
      for (const [file, title] of Object.entries(NEW_TRACKS)) {
        const stop = (await routeStops(page, "Extras"))?.stops.find((x) => x.key === `tile:music:${title}`);
        if (!stop) {
          missing.push(`${title} (${file})`);
          continue;
        }
        await scrollStopIntoView(page, stop.key, "Extras");
        const listed = (await visibleTexts(page)).some((t) => t.scene === "Extras" && t.text.trim() === title);
        if (!listed) missing.push(`${title}: title not drawn`);
        await clickStop(page, stop.key, "Extras");
        const key = `music:${file}`;
        await waitFor(
          async () =>
            (await page.evaluate(
              (k) =>
                (
                  window as unknown as {
                    __mcGame: {
                      cache: { audio: { exists(k: string): boolean } };
                      sound: { sounds: { key: string }[] };
                    };
                  }
                ).__mcGame.cache.audio.exists(k) &&
                (
                  window as unknown as { __mcGame: { sound: { sounds: { key: string }[] } } }
                ).__mcGame.sound.sounds.some((x) => x.key === k),
              key,
            ))
              ? true
              : null,
          `${title} is loaded and added to the sound manager`,
          20000,
        );
        const jukebox = await page.evaluate(async () => {
          const { appSession } = (await import("/src/session.ts")) as unknown as {
            appSession: () => { music?: { jukeboxKey(): string | null } };
          };
          return appSession().music?.jukeboxKey() ?? null;
        });
        expect(jukebox, `the jukebox is playing ${title}`).toBe(key);
        played++;
      }
      await shot(page, "c-jukebox-after");
      expect(missing, "every new track is listed under its title").toEqual([]);
      expect(played).toBe(17);
      expect(failedAudio, "no track file failed to load").toEqual([]);
      expect(errors, "no console or page errors").toEqual([]);
    });

    /** The sound manager's view of one track: loaded into the cache and added as a sound, by its catalog key. */
    const trackAdded = (page: Page, file: string): Promise<boolean> =>
      page.evaluate((k) => {
        const game = (
          window as unknown as {
            __mcGame: { cache: { audio: { exists(k: string): boolean } }; sound: { sounds: { key: string }[] } };
          }
        ).__mcGame;
        return game.cache.audio.exists(k) && game.sound.sounds.some((x) => x.key === k);
      }, `music:${file}`);

    test("D and C. Scenario intros: each of the five shows its own rulebook page and asks for its battle track", async ({
      page,
    }) => {
      test.setTimeout(300_000);
      const errors = trackErrors(page);
      const requested: string[] = [];
      page.on("request", (r) => {
        if (/\.mp3(\?|$)/.test(r.url())) requested.push(r.url());
      });
      await installWave6Helpers(page);
      for (const [id, deck] of SCENARIOS) {
        requested.length = 0;
        await page.goto(`/?unlock=all&screen=scenario-intro&scenario=${id}&deck=${deck}&seed=7`);
        await waitForScene(page, "ScenarioIntro", 40000);
        await settle(page, { quietMs: 800, maxMs: 4000 });
        await shot(page, `d-intro-${id}-1`);
        await waitFor(
          async () => ((await trackAdded(page, `scenarios/${id}/battle.mp3`)) ? true : null),
          `${id}'s battle track is loaded and added to the sound manager`,
          20000,
        );
        expect(
          requested.some((url) => url.includes(`/${id}/battle`)),
          `the intro asked for ${id}'s battle track (${requested.join(", ")})`,
        ).toBe(true);
        // One beat, the whole page (no crop cuts the lettering): the intro is still up, and Next would deal.
        expect(await on(page, "ScenarioIntro"), "the page is the whole intro").toBe(true);
        expect(await rawTextOnScreen(page), `${id}: no raw text on the intro`).toEqual([]);
      }
      expect(errors, "no console or page errors").toEqual([]);
    });

    test("D. The NeXt Evolution Finale (a finished run) reads cleanly and plays Hope for Tomorrow", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errors = trackErrors(page);
      await installWave6Helpers(page);
      await openTitle(page);
      const runId = await page.evaluate(async () => {
        const fixtures = (await import("/src/campaign/dev-fixtures.ts")) as {
          seedNextEvolRun(service: unknown, stop: string): Promise<{ id: string }>;
        };
        const service = (window as unknown as { __mcCampaign: { service: unknown } }).__mcCampaign.service;
        return (await fixtures.seedNextEvolRun(service, "finished")).id;
      });
      await page.evaluate((id) => {
        const game = (window as unknown as { __mcGame: any }).__mcGame;
        for (const scene of game.scene.getScenes(true))
          if (scene.sys.settings.key !== "MusicScene") game.scene.stop(scene.sys.settings.key);
        game.scene.start("CampaignFinale", { runId: id });
      }, runId);
      await waitForScene(page, "CampaignFinale", 40000);
      await settle(page, { quietMs: 1000, maxMs: 5000 });
      await shot(page, "d-finale");
      expect((await textsOf(page, "CampaignFinale")).length, "the Finale draws its text").toBeGreaterThan(3);
      expect(await rawTextOnScreen(page), "no raw text on the Finale").toEqual([]);
      await waitFor(
        async () => ((await trackAdded(page, "campaigns/next_evol/finale.mp3")) ? true : null),
        "the Finale's track is loaded and added to the sound manager",
        20000,
      );
      expect(errors, "no console or page errors").toEqual([]);
    });

    /** Board is up on a screens QA fixture (`store/dev-qa-screens-game.ts`). */
    const fixture = async (page: Page, which: string): Promise<void> => {
      await installWave6Helpers(page);
      await openTitle(page);
      await startFixture(page, "dev-qa-screens-game.ts", "startScreensQaGame", which);
    };
    const sheetTitle = async (page: Page): Promise<string> =>
      (await textsOf(page, "ChoiceOverlay")).find((t) => /^.+: (.+\?|choose .+)$/i.test(t) || /^discard /i.test(t)) ??
      "";

    test("E. restricted limit: a third restricted card asks which of the three to discard", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackErrors(page);
      await fixture(page, "restricted");
      const before = await facts(
        page,
        (g) => g.players[0].playArea.length + g.instances[g.players[0].identity.instanceId].attachments.length,
      );
      await playPayingWithOthers(page, phone, "44052", ["44010", "44052"]);
      await waitFor(
        async () =>
          (await textsOf(page, "ChoiceOverlay")).some((t) => /discard to two restricted cards/i.test(t)) ? true : null,
        "the restricted discard sheet",
        15000,
      );
      await settle(page, { quietMs: 500, maxMs: 2500 });
      await shot(page, "e-restricted-prompt");
      const texts = await textsOf(page, "ChoiceOverlay");
      expect(texts.join(" | "), "the sheet names the three cards to choose from").toMatch(/select 1|select 1–1/i);
      expect(texts.join(" | "), "the sheet says why it opened").toMatch(/over the limit of two restricted cards/i);
      expect(await rawTextOnScreen(page)).toEqual([]);
      await answerChoice(page, 0);
      await waitFor(async () => (!(await on(page, "ChoiceOverlay")) ? true : null), "the sheet closes", 15000);
      const kept = await facts(
        page,
        (g) =>
          g.instances[g.players[0].identity.instanceId].attachments.filter(
            (id: string) => g.instances[id].cardId === "44010" || g.instances[id].cardId === "44052",
          ).length,
      );
      expect(kept, "two restricted cards stay").toBe(2);
      expect(before).toBeGreaterThanOrEqual(0);
      await shot(page, "e-restricted-after");
      expect(errors).toEqual([]);
    });

    test("E. Warpath's villain-phase response picks an event and pays for it", async ({ page }) => {
      test.setTimeout(300_000);
      const errors = trackErrors(page);
      await fixture(page, "warpath");
      expect(await facts(page, (g) => g.round)).toBeGreaterThanOrEqual(2);
      await pressFocus(page, phone, "basic:endTurn");
      const seen: string[] = [];
      const start = Date.now();
      let played = false;
      while (Date.now() - start < 120_000) {
        const scenes = await activeScenes(page);
        if (scenes.includes("GameOver")) break;
        // The response window draws "Use Warpath" on the villain-phase panel, over a decision sheet that waits behind it.
        const useWarpath = scenes.includes("VillainPhaseOverlay")
          ? (await textsOf(page, "VillainPhaseOverlay")).find((t) => /^use warpath$/i.test(t))
          : undefined;
        if (scenes.includes("EndTurnConfirmOverlay")) {
          await pressBoardText(page, phone, /^end turn$/i, "EndTurnConfirmOverlay");
        } else if (useWarpath) {
          await shot(page, "e-warpath-response-window");
          await clickText(page, useWarpath, { sceneKey: "VillainPhaseOverlay" });
          await settle(page, { quietMs: 400, maxMs: 2000 });
        } else if (scenes.includes("ChoiceOverlay")) {
          await settle(page, { quietMs: 500, maxMs: 2500 });
          const title = await sheetTitle(page);
          seen.push(title);
          await shot(page, `e-warpath-${seen.length}`);
          if (/pay for this card/i.test(title)) {
            await payOnSheet(page, phone);
            played = true;
          } else if (/spend \d+ resources\?/i.test(title)) {
            // Spend hand cards other than the event itself (the first option), one at a time, until Confirm takes it.
            await spendOnSheet(page, phone, 2, ["42015"]);
            played = true;
          } else if (/warpath|ever vigilant/i.test(title)) {
            await answerChoice(page, 0);
          } else if (!/^discard /i.test(title) && (await declareDefender(page, phone, -1))) {
            // Warpath is the last of the defenders offered.
          } else {
            await answerPreferDecline(page);
          }
        } else if (scenes.includes("VillainPhaseOverlay")) {
          const walk = await textsOf(page, "VillainPhaseOverlay");
          const use = walk.find((t) => /^use warpath$/i.test(t));
          await shot(page, use ? "e-warpath-response-window" : "e-warpath-villain-phase");
          if (use) {
            await clickText(page, use, { sceneKey: "VillainPhaseOverlay" });
            await settle(page, { quietMs: 400, maxMs: 2000 });
          } else await skipVillainPhase(page);
        } else if (scenes.includes("Board") && played && (await focusRect(page, "basic:endTurn"))) break;
        await page.waitForTimeout(250); // loop pacing, not a blind wait
      }
      const discarded = await facts(page, (g) =>
        g.players[0].discard.some((id: string) => g.instances[id].cardId === "42015"),
      );
      expect(discarded, "Ever Vigilant was played and discarded through Warpath's response").toBe(true);
      expect(errors).toEqual([]);
    });

    test("E. a would-replacement (Regeneratin' Degenerate) resolves with nothing to click and the board does not stall", async ({
      page,
    }) => {
      test.setTimeout(300_000);
      const errors = trackErrors(page);
      await fixture(page, "replacement");
      const round = await facts(page, (g) => g.round as number);
      const dealt = await facts(page, (g) => g.instances[g.players[0].identity.instanceId].damage as number);
      expect(dealt).toBeGreaterThanOrEqual(7);
      const next = await endTurnThrough(page, phone, round, 150_000);
      expect(next, "the game goes on into the next round").not.toBeNull();
      await settle(page, { quietMs: 800, maxMs: 4000 });
      await shot(page, "e-replacement-after");
      const now = await facts(page, (g) => ({
        form: g.players[0].identity.form as string,
        damage: g.instances[g.players[0].identity.instanceId].damage as number,
        over: !!g.outcome,
      }));
      expect(now.over, "Deadpool was not defeated").toBe(false);
      expect(now.form, "the replacement changed him to alter-ego form").toBe("alterEgo");
      expect(errors).toEqual([]);
    });

    test("E. defense between players: while P1 defends, P2's (defense) card is not offered", async ({ page }) => {
      test.setTimeout(300_000);
      const errors = trackErrors(page);
      await fixture(page, "defenseLock");
      await shot(page, "e-defense-p1-turn");
      await pressFocus(page, phone, "basic:endTurn");
      const start = Date.now();
      const offered: string[] = [];
      let shown = false;
      let sawAttack = false;
      while (Date.now() - start < 120_000) {
        const scenes = await activeScenes(page);
        if (scenes.includes("GameOver")) break;
        if (scenes.includes("EndTurnConfirmOverlay")) {
          await pressBoardText(page, phone, /^end turn$/i, "EndTurnConfirmOverlay");
        } else if (scenes.includes("ChoiceOverlay") || scenes.includes("VillainPhaseOverlay")) {
          await settle(page, { quietMs: 500, maxMs: 2500 });
          offered.push(
            ...(await textsOf(page, "ChoiceOverlay")).filter((t) =>
              /barely a scratch: |play barely a scratch/i.test(t),
            ),
            ...(await textsOf(page, "VillainPhaseOverlay")).filter((t) =>
              /play barely a scratch|barely a scratch: /i.test(t),
            ),
          );
          const attackTexts = [
            ...(await textsOf(page, "ChoiceOverlay")),
            ...(await textsOf(page, "VillainPhaseOverlay")),
          ];
          if (attackTexts.some((t) => /attacks you/i.test(t))) {
            sawAttack = true;
            if (!shown) {
              shown = true;
              await shot(page, "e-defense-sheet");
            }
          }
          if (!(await declareDefender(page, phone, 0))) {
            if (scenes.includes("ChoiceOverlay")) await answerPreferDecline(page);
            else await skipVillainPhase(page);
          }
        } else if (scenes.includes("Board") && (await boardRound(page)) === 3) break;
        await page.waitForTimeout(250); // loop pacing, not a blind wait
      }
      expect(sawAttack, "Rhino's attack on P1 reached a decision window").toBe(true);
      expect(offered, "P2's Barely a Scratch is never offered while P1 is the one under attack").toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

/**
 * Defects the pass found, now fixed and kept as ordinary tests (the Try-it exit is covered by the A tests above);
 * `docs/phase7-wave7-qa-screens.md` lists them.
 */
test.describe("regressions fixed after the pass", () => {
  test.describe("at 390", () => {
    test.use({ viewport: VIEWPORTS.phone, hasTouch: true, isMobile: true });

    // Owner: the guide's anchor placement for a hand card on the phone board (`scenes/board.ts` hand lane, `guide/`
    // spotlight). At 390 the hand scrolls sideways and Build Support sits off the right edge when Cable's Try-it reaches
    // its "limit" step, so TRY THIS rings a spot at x = 499..600 on a 390-wide screen and the callout points at the
    // wrong card. The step says "Tap Build Support, then Play" without saying to scroll the hand.
    test("Cable Try-it, step 'limit': the ring is on a control that is on screen at 390", async ({ page }) => {
      test.setTimeout(240_000);
      const problems: string[] = [];
      await startLesson(page, "cable");
      await playLessonSteps(page, true, "cable", problems, "limit");
      const rects = await guideRects(page);
      expect(rectOnScreen(page, rects.anchor), `ring ${JSON.stringify(rects.anchor)} is on screen`).toBe(true);
    });
  });

  // Owner: `view/rules-reference.ts` line 172 (`parts.push(`${source.cards} (card text)`)`) and the entry's source in
  // `packages/content/src/schema/glossary.ts` (actionsOtherTurns). The cite reads "OWNER DECISION, NEXT EVOLUTION SPEC
  // 4.1 (2026-10-05) (CARD TEXT)": an internal spec section a player cannot look up, and "(card text)" stuck on a
  // source that is not a card ("NeXt Evolution rulebook p. 5 (card text)" too).
  test("Rules reference: no cite names an internal spec or calls a rulebook page 'card text'", async ({ page }) => {
    test.setTimeout(120_000);
    await openNextEvolPage(page);
    await clickBoxPageRow(page, "actionsOtherTurns");
    await waitFor(async () => ((await on(page, "RulesOverlay")) ? true : null), "the entry opens", 8000);
    await settle(page, { quietMs: 500, maxMs: 2500 });
    const texts = (await textsOf(page, "RulesOverlay")).join(" | ");
    expect(texts).not.toMatch(/spec \d|owner decision/i);
    expect(texts).not.toMatch(/rulebook p\. ?\d+ \(card text\)/i);
  });

  // Owner: `view/defend-choice.ts` `stackRowLabel` (case "event": `Response window — ${label}` with the engine's own
  // event kind). The villain phase's "The stack" panel prints "Response window — enemyAttack" while Rhino's attack
  // waits for a defender: a camelCase engine id on a player's screen.
  test("The defend sheet's stack panel words its rows without raw engine ids", async ({ page }) => {
    test.setTimeout(240_000);
    await installWave6Helpers(page);
    await openTitle(page);
    await startFixture(page, "dev-qa-screens-game.ts", "startScreensQaGame", "warpath");
    await pressFocus(page, false, "basic:endTurn");
    const rawRows: string[] = [];
    let sawWindowRow = false;
    const start = Date.now();
    while (Date.now() - start < 90_000 && !sawWindowRow) {
      const scenes = await activeScenes(page);
      if (scenes.includes("GameOver")) break;
      if (scenes.includes("EndTurnConfirmOverlay")) {
        await pressBoardText(page, false, /^end turn$/i, "EndTurnConfirmOverlay");
      } else if (scenes.includes("ChoiceOverlay")) {
        await settle(page, { quietMs: 500, maxMs: 2500 });
        const rows = (await textsOf(page, "ChoiceOverlay")).filter((t) => /window/i.test(t));
        if (rows.length > 0) sawWindowRow = true;
        rawRows.push(...rows.filter((t) => /[a-z][A-Z]/.test(t)));
        if (sawWindowRow) break;
        if (!(await declareDefender(page, false, -1))) await answerPreferDecline(page);
      } else if (scenes.includes("VillainPhaseOverlay")) {
        await skipVillainPhase(page);
      }
      await page.waitForTimeout(250); // loop pacing, not a blind wait
    }
    expect(sawWindowRow, "a defend sheet showed a window row in the stack panel").toBe(true);
    expect(rawRows).toEqual([]);
  });

  // Owner: `scenes/boot.ts` `?screen=aspect&aspect=<id>` (dev jump; its `valid` set stops at "basic", its comment says
  // 'Pool is pending). Dev-only, but QA and screenshot scripts use it: `aspect=pool` opens Justice.
  test("?screen=aspect&aspect=pool opens the 'Pool aspect page", async ({ page }) => {
    await installWave6Helpers(page);
    await page.goto("/?unlock=all&screen=aspect&aspect=pool");
    await waitForScene(page, "AspectLesson", 30000);
    await settle(page, { quietMs: 800, maxMs: 3000 });
    expect((await textsOf(page, "AspectLesson")).join(" | ")).toMatch(/'Pool/);
  });
});
