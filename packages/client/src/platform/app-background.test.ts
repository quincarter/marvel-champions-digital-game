import { describe, expect, test } from "vitest";
import { onAppBackgroundChange, pausesMusicInBackground } from "./app-background.js";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

class FakeDocument extends EventTarget {
  hidden = false;
  flip(hidden: boolean): void {
    this.hidden = hidden;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

describe("app background", () => {
  test("only Android pauses the music in the background", () => {
    expect(pausesMusicInBackground(ANDROID)).toBe(true);
    expect(pausesMusicInBackground(WINDOWS)).toBe(false);
  });

  test("hears the game leave the foreground and come back, once each", () => {
    const doc = new FakeDocument();
    const heard: boolean[] = [];
    const stop = onAppBackgroundChange((background) => heard.push(background), doc, ANDROID);
    doc.flip(true);
    doc.flip(true);
    doc.flip(false);
    stop();
    doc.flip(true);
    expect(heard).toEqual([true, false]);
  });

  test("listens to nothing off Android", () => {
    const doc = new FakeDocument();
    const heard: boolean[] = [];
    onAppBackgroundChange((background) => heard.push(background), doc, WINDOWS);
    doc.flip(true);
    expect(heard).toEqual([]);
  });
});
