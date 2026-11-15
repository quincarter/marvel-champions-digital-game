import {
  OLD_SAVE_DISMISSED_KEY,
  dismissOldSaveNotice,
  forcedOldSaveNotice,
  isOldSaveNoticeDismissed,
  wantsOldSaveNotice,
} from "./old-save-notice.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> & { readonly map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
};

const base = { platform: "web", host: "marvel.champions-digital-game.com", search: "", dismissed: false } as const;

describe("wantsOldSaveNotice", () => {
  it("shows on the web game at its new address", () => {
    expect(wantsOldSaveNotice(base)).toBe(true);
  });

  it("never shows in the installed apps, whose saves stay in the app", () => {
    expect(wantsOldSaveNotice({ ...base, platform: "tauri" })).toBe(false);
    expect(wantsOldSaveNotice({ ...base, platform: "capacitor" })).toBe(false);
    expect(wantsOldSaveNotice({ ...base, platform: "tauri", search: "?oldsave=1" })).toBe(false);
  });

  it("stays closed once dismissed", () => {
    expect(wantsOldSaveNotice({ ...base, dismissed: true })).toBe(false);
    expect(wantsOldSaveNotice({ ...base, dismissed: true, search: "?oldsave=1" })).toBe(false);
  });

  it("skips other web addresses (previews, a dev server) unless ?oldsave=1 asks for it", () => {
    expect(wantsOldSaveNotice({ ...base, host: "localhost:5173" })).toBe(false);
    expect(wantsOldSaveNotice({ ...base, host: "localhost:5173", search: "?oldsave=1" })).toBe(true);
  });
});

describe("forcedOldSaveNotice", () => {
  it("reads ?oldsave=1 or on, and nothing else", () => {
    expect(forcedOldSaveNotice("?oldsave=1")).toBe(true);
    expect(forcedOldSaveNotice("?x=2&oldsave=on")).toBe(true);
    expect(forcedOldSaveNotice("?oldsave=0")).toBe(false);
    expect(forcedOldSaveNotice("")).toBe(false);
  });
});

describe("the dismissal", () => {
  it("is remembered under an mc-* key, so the save export carries it", () => {
    const storage = memory();
    expect(isOldSaveNoticeDismissed(storage)).toBe(false);
    dismissOldSaveNotice(storage);
    expect(storage.map.get(OLD_SAVE_DISMISSED_KEY)).toBe("1");
    expect(OLD_SAVE_DISMISSED_KEY.startsWith("mc-")).toBe(true);
    expect(isOldSaveNoticeDismissed(storage)).toBe(true);
  });

  it("survives a store that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(isOldSaveNoticeDismissed(broken)).toBe(false);
    expect(() => dismissOldSaveNotice(broken)).not.toThrow();
  });
});
