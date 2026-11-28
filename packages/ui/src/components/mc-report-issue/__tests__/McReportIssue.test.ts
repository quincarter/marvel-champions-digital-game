import { afterEach, describe, expect, it } from "vitest";
import "../../mc-button/mc-button.js";
import "../mc-report-issue.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";
import type { ReportIssueModel } from "../mc-report-issue.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<ReportIssueModel> = {}): ReportIssueModel => ({
  title: "Informar de un problema",
  close: { key: "close", label: "✕", kind: "quiet" },
  steps: [
    {
      key: "shot",
      title: "1 · Haz una captura",
      body: "Pulsa a la vez Encendido y Bajar volumen.",
      rows: [[{ key: "hide", label: "Ocultar", kind: "secondary" }]],
    },
    {
      key: "log",
      title: "2 · Guarda el registro",
      body: "Registro.",
      rows: [
        [
          { key: "copy", label: "Copiar", kind: "secondary" },
          { key: "download", label: "Descargar", kind: "secondary" },
        ],
      ],
    },
    {
      key: "tell",
      title: "3 · Cuéntanoslo",
      body: "Formulario.",
      rows: [[{ key: "github", label: "Informar de un fallo", kind: "primary" }]],
    },
  ],
  feedback: "",
  columns: 1,
  phone: true,
  scrim: 0.72,
  ...over,
});

async function mount(m: ReportIssueModel) {
  const el = document.createElement("mc-report-issue");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  for (const step of el.shadowRoot!.querySelectorAll("mc-report-step")) await step.updateComplete;
  return el;
}

describe("mc-report-issue", () => {
  it("draws a section element for each of the three steps, in one column", async () => {
    const el = await mount(model());
    expect(el.shadowRoot!.querySelectorAll("mc-report-step")).toHaveLength(3);
    expect(el.shadowRoot!.querySelectorAll(".col")).toHaveLength(1);
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Informar de un problema");
  });

  it("sets the steps in two columns when asked, the third alone in the second", async () => {
    const el = await mount(model({ columns: 2 }));
    const cols = el.shadowRoot!.querySelectorAll(".col");
    expect(cols).toHaveLength(2);
    expect(cols[1]!.querySelectorAll("mc-report-step")).toHaveLength(1);
    expect(el.getAttribute("columns")).toBe("2");
  });

  it("reports a step's button, and the close button, by key, and finds each by key", async () => {
    const el = await mount(model());
    const keys = activations(el);
    tap(stop(el, "copy"));
    tap(stop(el, "github"));
    tap(stop(el, "close"));
    expect(keys).toEqual(["copy", "github", "close"]);
    expect(() => stop(el, "nothing")).toThrow();
  });

  it("says what the last action said, as a status line", async () => {
    const el = await mount(model({ feedback: "Registro copiado." }));
    expect(el.shadowRoot!.querySelector("[role=status]")!.textContent).toBe("Registro copiado.");
  });
});
