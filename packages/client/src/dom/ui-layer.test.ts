import { describe, expect, it } from "vitest";
import { surface } from "../tokens.js";
import { schemeColor } from "../view/color-scheme.js";
import { layerVariables } from "./ui-layer.js";

describe("layerVariables", () => {
  it("gives each token per channel, mapped through the color scheme", () => {
    const light = layerVariables("light", false);
    const dark = layerVariables("dark", false);
    expect(light["--mc-fill-paper"]).toBe(surface.paper.css);
    expect(dark["--mc-fill-paper"]).toBe(
      `#${schemeColor(surface.paper.hex, "fill", "dark").toString(16).padStart(6, "0")}`,
    );
    expect(dark["--mc-text-ink"]).toBe(
      `#${schemeColor(surface.ink.hex, "text", "dark").toString(16).padStart(6, "0")}`,
    );
  });

  it("draws small text larger on desktop, as Phaser's labels are", () => {
    expect(layerVariables("light", false)["--mc-small-11"]).toBe("11px");
    expect(layerVariables("light", true)["--mc-small-11"]).toBe("13px");
    expect(layerVariables("light", true)["--mc-small-9"]).toBe("11px");
  });
});
