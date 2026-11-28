import { afterEach, describe, expect, it } from "vitest";
import "../../mc-button/mc-button.js";
import "../mc-report-step.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

describe("mc-report-step", () => {
  it("draws the heading, the sentence and a row of buttons, and reports a press by its key", async () => {
    const el = document.createElement("mc-report-step");
    el.step = {
      key: "log",
      title: "2 · Guarda el registro",
      body: "Adjúntalo.",
      rows: [
        [
          { key: "copy", label: "Copiar", kind: "primary" },
          { key: "download", label: "Descargar", kind: "secondary" },
        ],
      ],
    };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("h3")!.textContent).toBe("2 · Guarda el registro");
    expect(el.shadowRoot!.querySelector("p")!.textContent).toBe("Adjúntalo.");
    const keys = activations(el);
    tap(stop(el, "download"));
    expect(keys).toEqual(["download"]);
  });
});
