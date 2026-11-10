import { describe, expect, it, vi } from "vitest";

vi.mock("../platform/native-http.js", () => ({
  nativeGet: vi.fn(async () => ({
    status: 200,
    contentType: "application/json",
    body: new TextEncoder().encode("{}"),
  })),
}));

import { nativeGet } from "../platform/native-http.js";
import { packFetchFor } from "./pack-fetch.js";

describe("packFetchFor", () => {
  it("goes through the native HTTP stack in a packaged app", async () => {
    const response = await packFetchFor("tauri")("https://packs.example/index.json");
    expect(nativeGet).toHaveBeenCalledWith("tauri", "https://packs.example/index.json", "bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });
});
