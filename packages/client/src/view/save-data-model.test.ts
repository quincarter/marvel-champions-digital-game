import { describe, expect, test } from "vitest";
import { SAVE_FILE_FORMAT, SAVE_FILE_VERSION, type SaveFile } from "../save-data/save-file.js";
import {
  badFileStatusOf,
  exportStatusOf,
  importFailedStatusOf,
  isCancelledShare,
  NO_STATUS,
  replaceConfirmOf,
} from "./save-data-model.js";

const FILE: SaveFile = {
  format: SAVE_FILE_FORMAT,
  version: SAVE_FILE_VERSION,
  exportedAt: 0,
  appVersion: "test",
  databases: {},
  localStorage: { "mc-unlocks": "{}" },
};

describe("save data status", () => {
  test("a finished export says so", () => {
    expect(exportStatusOf()).toEqual({ tone: "ok", text: "Exported." });
  });

  test("closing the share sheet is a cancel, not an error", () => {
    const abort = Object.assign(new Error("Share canceled"), { name: "AbortError" });
    expect(isCancelledShare(abort)).toBe(true);
    expect(exportStatusOf(abort)).toEqual(NO_STATUS);
  });

  test("any other export failure is an error carrying its message", () => {
    expect(exportStatusOf(new Error("disk full"))).toEqual({ tone: "error", text: "Couldn't export: disk full" });
    expect(exportStatusOf("nope").tone).toBe("error");
  });

  test("import failures and bad files are errors", () => {
    expect(importFailedStatusOf(new Error("quota"))).toEqual({ tone: "error", text: "Couldn't import: quota" });
    expect(badFileStatusOf("That isn't a save file.")).toEqual({ tone: "error", text: "That isn't a save file." });
  });
});

describe("replace confirm", () => {
  test("names what the file holds and that it can't be undone", () => {
    const confirm = replaceConfirmOf(FILE);
    expect(confirm.title).toBe("Replace everything on this device?");
    expect(confirm.body).toContain("This file has unlocks and points");
    expect(confirm.body).toContain("overwritten. This can't be undone.");
    expect([confirm.confirmLabel, confirm.cancelLabel]).toEqual(["Replace", "Cancel"]);
  });
});
