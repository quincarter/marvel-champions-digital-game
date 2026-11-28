/**
 * What Settings ▸ Save data's page shows for each step, from the scene's state: the six action rows, the replace
 * confirm, Send's code and QR, Receive's field and the status line. Pure wording and data; the scene
 * (`scenes/save-data.ts`) owns the steps, the I/O and the timers.
 */
import type { HintGlyph } from "@mc/ui";
import { encode } from "uqr";
import type {
  SaveDataActionRow,
  SaveDataStatusInput,
  SaveDataStepInput,
} from "../../components/save-data/save-data.types.js";
import { globalRowButton, globalRowDetail, globalRowTitle } from "../../view/global-stats-ui.js";
import { readConsent } from "../../global-stats/global-consent.js";
import { t } from "../../i18n/translate.js";
import { SHOW_BETA_TAGS } from "../../view/beta-tag.js";
import {
  exportRowDetail,
  exportRowTitle,
  importRowDetail,
  importRowTitle,
  replaceConfirmOf,
  type SaveDataStatus,
  type SaveDataStep,
} from "../../view/save-data-model.js";
import {
  codeTextOf,
  countdownOf,
  receiveLinkOf,
  receiveRowDetail,
  receiveRowTitle,
  sendRowDetail,
  sendRowTitle,
} from "../../view/save-transfer-model.js";
import { syncService } from "../../sync/sync-wiring.js";
import { syncRowTitle, syncStatusDisplay } from "../../view/sync-model.js";

/** A link as a QR code's modules, one string of "1" (dark) and "0" per row (`mc-qr-code`). */
const qrRowsOf = (link: string): string[] =>
  encode(link, { ecc: "M", border: 0 }).data.map((row) => row.map((dark) => (dark ? "1" : "0")).join(""));

export interface StepContext {
  readonly cancelGlyph: HintGlyph | null;
  /** A short screen (a landscape phone) gets one line of instructions so the column fits beside the QR code. */
  readonly short: boolean;
  /** The QR modules made for the link last time: the same link is not encoded again each second. */
  readonly qr: { readonly link: string; readonly rows: readonly string[] } | null;
}

export interface ComposedStep {
  readonly input: SaveDataStepInput;
  /** The step's focus stops, in order (after Back). */
  readonly order: string[];
  readonly qr: StepContext["qr"];
}

/** The six action rows, worded now so a language switch shows at once. */
export function actionRowsOf(): SaveDataActionRow[] {
  const consent = readConsent();
  const row = (id: SaveDataActionRow["id"], title: string, detail: string, label: string): SaveDataActionRow => ({
    id,
    title,
    detail,
    label,
    beta: SHOW_BETA_TAGS && id === "sync",
  });
  return [
    row("export", exportRowTitle(), exportRowDetail(), t("saveData.button.export")),
    row("import", importRowTitle(), importRowDetail(), t("saveData.button.import")),
    row("send", sendRowTitle(), sendRowDetail(), t("saveData.button.send")),
    row("receive", receiveRowTitle(), receiveRowDetail(), t("saveData.button.receive")),
    row(
      "sync",
      syncRowTitle(),
      t("sync.statusLine", {
        status: syncStatusDisplay(syncService().isOn(), syncService().status.get(), Date.now()),
      }),
      t("saveData.button.sync"),
    ),
    row("global", globalRowTitle(), globalRowDetail(consent), globalRowButton(consent)),
  ];
}

export function composeStep(step: SaveDataStep, context: StepContext): ComposedStep {
  const { cancelGlyph } = context;
  if (step.kind === "confirm") {
    const confirm = replaceConfirmOf(step.file, syncService().isOn());
    return {
      input: { kind: "confirm", confirm: { ...confirm, cancelGlyph } },
      order: ["cancel", "replace"],
      qr: context.qr,
    };
  }
  if (step.kind === "send") {
    const title = sendRowTitle();
    if (step.phase.kind === "uploading")
      return { input: { kind: "send", send: { phase: "uploading", title } }, order: [], qr: context.qr };
    const phase = step.phase;
    const link = receiveLinkOf(phase.code, location);
    const qr = context.qr?.link === link ? context.qr : { link, rows: qrRowsOf(link) };
    const left = countdownOf(phase.expiresAt, Date.now());
    return {
      input: {
        kind: "send",
        send: {
          phase: "showing",
          title,
          help: context.short ? t("saveData.send.helpShort") : t("saveData.send.help"),
          code: codeTextOf(phase.code),
          qr: qr.rows,
          link,
          countdown: left.text,
          expired: left.expired,
          copyLabel: t("saveData.copyCode"),
          newCodeLabel: t("saveData.newCode"),
          backLabel: t("saveData.back"),
          backGlyph: cancelGlyph,
        },
      },
      order: [left.expired ? "new-code" : "copy", "back-menu"],
      qr,
    };
  }
  if (step.kind === "receive") {
    const fetching = step.phase === "fetching";
    return {
      input: {
        kind: "receive",
        receive: {
          title: receiveRowTitle(),
          fetching,
          help: t("saveData.receive.help"),
          value: step.input,
          placeholder: "ABCD-EFGH-JKMN",
          receiveLabel: t("saveData.button.receive"),
          backLabel: t("saveData.back"),
          backGlyph: cancelGlyph,
        },
      },
      order: fetching ? [] : ["code", "receive", "back-menu"],
      qr: context.qr,
    };
  }
  if (step.kind === "busy") return { input: { kind: "busy" }, order: [], qr: context.qr };
  return {
    input: { kind: "menu", actions: { rows: actionRowsOf(), disabled: false } },
    order: ["export", "import", "send", "receive", "sync", "global"].map((id) => `row:${id}`),
    qr: context.qr,
  };
}

/** The line under the step: that a file is in flight, or what the last action said. */
export function statusInputOf(status: SaveDataStatus, working: boolean): SaveDataStatusInput | null {
  if (working) return { text: t("saveData.working"), tone: "ok", exportLabel: null };
  if (status.tone === "none") return null;
  const error = status.tone === "error";
  return {
    text: error ? t("saveData.problem", { text: status.text }) : status.text,
    tone: error ? "error" : "ok",
    exportLabel: status.offerExport ? t("saveData.button.export") : null,
  };
}
