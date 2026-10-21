import { describe, expect, test } from "vitest";
import { deviceTierOf, gpuClassOf, gpuShortName, hardwareSummaryOf, recommendedScreenOf } from "./device-tier.js";

describe("gpuClassOf", () => {
  test("recent Adreno, Mali-G7x/G7xx, Immortalis and Xclipse are fast", () => {
    for (const gpu of [
      "Adreno (TM) 740",
      "Adreno (TM) 650",
      "Mali-G78 MP20",
      "Mali-G710 MC10",
      "Immortalis-G715",
      "Samsung Xclipse 920",
    ])
      expect(gpuClassOf(gpu), gpu).toBe("fast");
  });

  test("older Adreno, budget Mali and PowerVR are slow", () => {
    for (const gpu of ["Adreno (TM) 506", "Mali-G52 MC2", "Mali-T830", "PowerVR Rogue GE8320"])
      expect(gpuClassOf(gpu), gpu).toBe("slow");
  });

  test("the mid-range parts in between, and an unreadable name, leave it to the memory", () => {
    for (const gpu of ["Adreno (TM) 619", "Mali-G57 MC2", "Mali-G68 MC4", "ANGLE (Unknown)"])
      expect(gpuClassOf(gpu), gpu).toBe("unknown");
    expect(gpuClassOf(undefined)).toBe("unknown");
  });
});

describe("deviceTierOf and the recommendation", () => {
  test("a flagship (Android's performance class 33+, or 8 GB) draws Native at the screen's own rate", () => {
    expect(recommendedScreenOf({ ramMb: 11_800, performanceClass: 34, gpu: "Adreno (TM) 750" })).toEqual({
      tier: "high",
      renderScale: "native",
      frameRate: "screen",
    });
    expect(deviceTierOf({ deviceMemoryGb: 8 })).toBe("high");
    expect(deviceTierOf({ ramMb: 5_900, gpu: "Adreno (TM) 642L" })).toBe("high");
  });

  test("a mid-range phone draws 720p-class 2x at 60 fps", () => {
    expect(recommendedScreenOf({ ramMb: 5_800, gpu: "Mali-G68 MC4" })).toEqual({
      tier: "mid",
      renderScale: "2x",
      frameRate: "60",
    });
    expect(deviceTierOf({ deviceMemoryGb: 4 })).toBe("mid");
    expect(deviceTierOf({})).toBe("mid");
  });

  test("little memory, a low-RAM device or a slow GPU is entry-level whatever else it says", () => {
    expect(recommendedScreenOf({ ramMb: 2_900 })).toMatchObject({ tier: "low", renderScale: "1.5x", frameRate: "60" });
    expect(deviceTierOf({ deviceMemoryGb: 2 })).toBe("low");
    expect(deviceTierOf({ ramMb: 8_000, lowRam: true })).toBe("low");
    expect(deviceTierOf({ ramMb: 8_000, performanceClass: 33, gpu: "Mali-G52 MC2" })).toBe("low");
  });

  test("the app's real memory wins over the page's rounded figure", () => {
    expect(deviceTierOf({ ramMb: 3_000, deviceMemoryGb: 4 })).toBe("low");
  });
});

describe("hardwareSummaryOf", () => {
  test("memory and GPU, tidied for a sentence", () => {
    expect(hardwareSummaryOf({ ramMb: 7_700, gpu: "Adreno (TM) 740" })).toBe("8 GB, Adreno 740");
    expect(hardwareSummaryOf({ deviceMemoryGb: 8 })).toBe("8+ GB");
    expect(hardwareSummaryOf({})).toBe("");
  });
});

describe("gpuShortName", () => {
  test("unwraps ANGLE and drops driver details", () => {
    expect(gpuShortName("ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)")).toBe("Adreno 740");
    expect(gpuShortName("ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe(
      "NVIDIA GeForce RTX 5090",
    );
    expect(gpuShortName("Mali-G68 MC4")).toBe("Mali-G68 MC4");
  });

  test("a wrapped name is still classed by its GPU", () => {
    expect(gpuClassOf("ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)")).toBe("fast");
  });
});
