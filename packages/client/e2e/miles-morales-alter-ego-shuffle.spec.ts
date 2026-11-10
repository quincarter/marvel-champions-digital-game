import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Issue #640: after Miles Morales changes to alter-ego form, his Response ("shuffle 1 Spider-Man card from your discard
 * pile into your deck") offered any card titled "Spider-Man", and the reporter shuffled home Otto Octavius's basic
 * "Spider-Man" ally (31022) instead of one of his own Spider-Man cards. Those are his identity-specific set (the Sinister
 * Motives deck list files them as "Spider-Man cards"; RRG 1.8 "Identity-Specific Card", p. 23). The game is the
 * reporter's own (Miles Morales vs Ultron, seed 84913), replayed from the issue to round 2's change back to alter-ego
 * with the Response accepted, the point where the reporter picked Otto.
 */

const REPLAY = {
  config: {
    scenarioId: "ultron",
    difficulty: "standard",
    players: [
      {
        identityCardId: "27030a",
        deck: [
          "13024",
          "13024",
          "27012",
          "27018",
          "27023",
          "27031",
          "27031",
          "27032",
          "27032",
          "27033",
          "27033",
          "27034",
          "27034",
          "27034",
          "27035",
          "27036",
          "27037",
          "27038",
          "27039",
          "27039",
          "27048",
          "27049",
          "28018",
          "28020",
          "30021",
          "31022",
          "01084",
          "01088",
          "01089",
          "01090",
          "01091",
          "01092",
          "03034",
          "03034",
          "03034",
          "05024",
          "05024",
          "05024",
          "06034",
          "06034",
          "06034",
        ],
        aspects: ["protection"],
        deckId: "9c7be20c-6db9-4b56-b32f-8e502be80ee1",
      },
    ],
    seed: 84913,
    tableRules: {
      sameNameHeroAllyConflict: true,
    },
    outsideFacts: [
      {
        wonPreviousGame: true,
      },
    ],
  },
  commands: [
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c1",
        selectedOptionIds: [],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "changeForm",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i27",
        payment: [
          {
            fromHand: "i5",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i6",
        payment: [
          {
            fromHand: "i13",
          },
          {
            fromHand: "i7",
          },
          {
            fromHand: "i29",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "basicAttack",
        playerId: "p1",
        attackerInstanceId: "i3",
        targetInstanceId: "i12",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "endTurn",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c2",
        selectedOptionIds: ["i6"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c3",
        selectedOptionIds: ["i6:27012.spider-uk-interrupt"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c4",
        selectedOptionIds: ["0"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c5",
        selectedOptionIds: ["decline"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c6",
        selectedOptionIds: ["1"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i41",
        payment: [
          {
            fromHand: "i31",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i21",
        payment: [
          {
            ability: {
              instanceId: "i41",
              abilityId: "05024.enhanced-reflexes-resource",
            },
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "playCard",
        playerId: "p1",
        cardInstanceId: "i20",
        payment: [
          {
            fromHand: "i18",
          },
        ],
        attachToInstanceId: null,
      },
    },
    {
      playerId: "p1",
      command: {
        type: "basicThwart",
        playerId: "p1",
        thwarterInstanceId: "i3",
        schemeInstanceId: "i2",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c7",
        selectedOptionIds: ["i21:27038.defense-mechanism-response", "i20:27037.power-within-response"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c8",
        selectedOptionIds: ["i1"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c9",
        selectedOptionIds: ["i1"],
      },
    },
    {
      playerId: "p1",
      command: {
        type: "changeForm",
        playerId: "p1",
      },
    },
    {
      playerId: "p1",
      command: {
        type: "resolveChoice",
        playerId: "p1",
        choiceId: "c10",
        selectedOptionIds: ["i3:27030b.miles-morales-response"],
      },
    },
  ],
} as const;

// Otto (31022) is i29 and Swing In (27033) i13 in this game; the `facts` readers below run in the page, so they spell
// the ids out.
const SWING_IN = "i13"; // Swing In: one of his own Spider-Man cards, in the discard pile.

async function tapOption(page: Page, phone: boolean, optionId: string): Promise<void> {
  const rect = await waitFor(
    () =>
      page.evaluate(
        (id) =>
          (
            window as unknown as {
              __mcChoiceDebug?: { optionRect: (id: string) => { x: number; y: number; width: number; height: number } };
            }
          ).__mcChoiceDebug?.optionRect(id) ?? null,
        optionId,
      ),
    `option ${optionId} on the sheet`,
    10000,
  );
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

test("Miles Morales shuffles back one of his own Spider-Man cards, not a basic ally titled Spider-Man", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (replay) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (c: unknown) => Promise<void>; dispatch: (c: unknown) => Promise<unknown> } };
    };
    const store = appSession().store;
    await store.start(replay.config);
    for (const { command } of replay.commands) await store.dispatch(command);
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
  }, REPLAY);
  await boardUp(page);

  const sheet = await facts(page, (game) => ({
    slot: game.pendingChoice?.prompt.slot as string | undefined,
    offered: (game.pendingChoice?.options ?? []).map(
      (o: { optionId: string }) => game.cardPool[game.instances[o.optionId].cardId].name as string,
    ),
    otto: game.players[0].discard.includes("i29") as boolean,
  }));
  expect(sheet.slot).toBe("spiderMan");
  expect(sheet.otto, "Otto's Spider-Man ally is in the discard pile").toBe(true);
  expect(sheet.offered.sort()).toEqual(["Defense Mechanism", "Double Life", "Ganke Lee", "Power Within", "Swing In"]);
  if (SHOT) await page.screenshot({ path: `${SHOT}/issue-640-pick.png` });

  await tapOption(page, phone, SWING_IN);
  await clickText(page, "CONFIRM", { sceneKey: "ChoiceOverlay" });
  const after = await waitFor(
    () =>
      facts(page, (game) =>
        game.players[0].deck.includes("i13")
          ? { otto: game.players[0].discard.includes("i29") as boolean, pending: game.pendingChoice?.prompt.slot }
          : null,
      ),
    "Swing In shuffled into the deck",
    10000,
  );
  expect(after.otto, "Otto's Spider-Man ally stays in the discard pile").toBe(true);
  expect(after.pending).not.toBe("spiderMan");
});
