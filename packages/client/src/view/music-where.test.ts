import { describe, expect, it } from "vitest";
import { localizedWhere } from "./music-where.js";

describe("localizedWhere", () => {
  it("translates the fixed words and keeps the names", () => {
    expect(localizedWhere("Battle · Absorbing Man · Victory · Core Set", "es")).toBe(
      "Batalla · Absorbing Man · Victoria · Core Set",
    );
    expect(localizedWhere("Title screen", "es")).toBe("Pantalla de título");
    expect(localizedWhere("Any battle", "es")).toBe("Cualquier batalla");
    expect(localizedWhere("Defeat · Rhino", "en")).toBe("Defeat · Rhino");
  });
});
