import { afterEach, describe, expect, it } from "vitest";
import { padStatusOf, keyboardGroupsOf, padLayerSectionsOf } from "../view/controls-rows.js";
import { shortcutOf } from "../view/input-shortcuts.js";
import { statusLine } from "../sync/sync-status.js";
import { syncFailureStatusOf, conflictPromptOf } from "../view/sync-model.js";
import { countdownOf } from "../view/save-transfer-model.js";
import { describeSaveFileSummary } from "../save-data/save-file.js";
import { gateHintOf, UNLOCK_WAVES } from "../progression/unlocks.js";
import { switchLabel } from "../view/unlocks-model.js";
import { waveGuideLines } from "../view/progression-guide.js";
import { useEnglish, useSpanish } from "./test-language.js";

afterEach(useEnglish);

describe("Settings' sub-sheets in Spanish", () => {
  it("words the Controls sheet in Spanish and leaves English alone", () => {
    expect(padStatusOf(null, null).text).toBe("No controller connected");
    useSpanish();
    expect(padStatusOf(null, null).text).toBe("Ningún mando conectado");
    expect(shortcutOf("zoneNext").label).toBe("Zona siguiente");
    expect(keyboardGroupsOf("left")[0]!.title).toBe("EN TODAS PARTES");
    expect(padLayerSectionsOf("xbox", false)[0]!.title).toBe("MANTÉN LT");
  });

  it("words Save data's sync status, countdown, summary and errors in Spanish", () => {
    useSpanish();
    expect(statusLine({ state: "synced", lastSyncedAt: 0 }, 5 * 60_000)).toBe("Sincronizado hace 5 min");
    expect(statusLine({ state: "off", lastSyncedAt: null }, 0)).toBe("Desactivado");
    expect(syncFailureStatusOf({ kind: "not-on" }).text).toBe(
      "La sincronización está desactivada en este dispositivo.",
    );
    expect(countdownOf(90_000, 0).text).toBe("Caduca en 1:30");
    expect(
      describeSaveFileSummary({
        games: 2,
        decks: 1,
        campaigns: 0,
        unlocks: true,
        settings: false,
        exportedAt: 0,
        appVersion: "0",
      }),
    ).toBe("2 partidas guardadas, 1 mazo y desbloqueos y puntos");
    expect(
      conflictPromptOf(
        {
          label: "Rhino",
          campaign: false,
          local: { round: 3, updatedAt: 0 },
          remote: { round: 4, updatedAt: 0 },
        } as never,
        0,
      ).title,
    ).toBe("¿Qué copia quieres conservar?");
  });

  it("words Unlocks' conditions, switches and guide in Spanish", () => {
    useSpanish();
    const wave = UNLOCK_WAVES.find((w) => w.gate?.kind === "campaignWin")!;
    expect(gateHintOf(wave.gate!, "en")).toContain("Complete");
    expect(gateHintOf(wave.gate!)).toMatch(/^Completa la campaña /);
    expect(
      UNLOCK_WAVES.some(
        (w) => w.gate?.kind === "campaignWin" && gateHintOf(w.gate) === "Completa la campaña La Tiranía de Cráneo Rojo",
      ),
    ).toBe(true);
    expect(switchLabel("always")).toBe("ABIERTO");
    expect(switchLabel("on")).toBe("SÍ");
    expect(waveGuideLines()[0]).toContain("siempre abierto");
  });
});
