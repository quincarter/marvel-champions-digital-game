import { describe, expect, it } from "vitest";
import { GLOSSARY_ENTRIES } from "@mc/content";
import { GLOSSARY_ES } from "./glossary-es.js";

/** The entries `view/rules-reference.ts` adds on the client side. */
const CLIENT_ENTRY_IDS = ["exhausted", "ready", "facedownBoostCard", "aspectCard"];

describe("GLOSSARY_ES", () => {
  it("has every glossary entry's name and definition (the terms are pinned in `i18n/terminology-es.test.ts`), and a note wherever the English has one", () => {
    for (const entry of GLOSSARY_ENTRIES) {
      const spanish = GLOSSARY_ES[entry.id];
      expect(spanish, entry.id).toBeDefined();
      expect(spanish!.name.trim(), entry.id).not.toBe("");
      expect(spanish!.definition.trim(), entry.id).not.toBe("");
      if (entry.playerNote) expect(spanish!.note?.trim(), entry.id).toBeTruthy();
      else expect(spanish!.note, entry.id).toBeUndefined();
    }
  });

  it("covers the client's own entries and nothing the glossary doesn't have", () => {
    for (const id of CLIENT_ENTRY_IDS) expect(GLOSSARY_ES[id]?.definition, id).toBeTruthy();
    const known = new Set([...GLOSSARY_ENTRIES.map((entry) => entry.id), ...CLIENT_ENTRY_IDS]);
    expect(Object.keys(GLOSSARY_ES).filter((id) => !known.has(id))).toEqual([]);
  });

  it("names keywords as the official Spanish rules reference and the printed Spanish cards do", () => {
    expect(GLOSSARY_ES["retaliate"]!.name).toBe("Represalia X");
    expect(GLOSSARY_ES["guard"]!.name).toBe("Guardia");
    expect(GLOSSARY_ES["surge"]!.name).toBe("Oleada");
    expect(GLOSSARY_ES["overkill"]!.name).toBe("Brutalidad");
    expect(GLOSSARY_ES["quickstrike"]!.name).toBe("Ataque veloz");
    expect(GLOSSARY_ES["thwart"]!.name).toBe("Intervención");
  });

  it("Aumento names the Infame minion as the exception, as the English does (RRG 1.8 p. 47)", () => {
    expect(GLOSSARY_ES["boost"]!.definition).toMatch(/salvo un esbirro Infame/);
    expect(GLOSSARY_ES["boost"]!.definition).not.toMatch(/nunca reciben/);
  });

  it("Equipo counts an identity in either form or an Aliado, and Amenaza completes a stage (RRG 1.8 pp. 27, 43, 48)", () => {
    expect(GLOSSARY_ES["teamUp"]!.definition).toMatch(/como Aliado/);
    expect(GLOSSARY_ES["teamUp"]!.definition).not.toMatch(/no cuenta/);
    expect(GLOSSARY_ES["threat"]!.definition).toMatch(/esa etapa se completa/);
  });

  it("Victoria X en una carta vinculada y lo que Encontrar no alcanza (RRG 1.8 pp. 19, 46)", () => {
    expect(GLOSSARY_ES["victory"]!.definition).toMatch(/se derrota la carta a la que está vinculada/);
    expect(GLOSSARY_ES["find"]!.definition).toMatch(/cartas de Encuentro boca abajo/);
    expect(GLOSSARY_ES["find"]!.definition).toMatch(/retiradas de la partida/);
  });

  it("Encontrar no vuelve a enfrentar un esbirro ya enfrentado; Vulnerable con Tesón espera dos cartas (RRG 1.8 pp. 19, 48)", () => {
    expect(GLOSSARY_ES["find"]!.definition).toMatch(/salvo que ya estuviera enfrentado contigo/);
    expect(GLOSSARY_ES["vulnerable"]!.definition).toMatch(/antes de aplicar el daño/);
    expect(GLOSSARY_ES["vulnerable"]!.definition).toMatch(/Tesón, solo se descarta cuando tiene dos/);
  });
});
