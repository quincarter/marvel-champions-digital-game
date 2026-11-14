import { scrollSteps, scrollTopForStep } from "./scroll-motion.js";

describe("scrollSteps", () => {
  // A 4-step section 4000px tall in an 800px window travels 3200px, 800px a step.
  const at = (top: number) => scrollSteps(top, 4000, 800, 4);

  it("sits on the first step before the section reaches the top", () => {
    expect(at(300)).toEqual({ index: 0, within: 0, progress: 0 });
  });

  it("steps through evenly as the section scrolls up", () => {
    expect(at(-400)).toMatchObject({ index: 0, within: 0.5 });
    expect(at(-800).index).toBe(1);
    expect(at(-2000)).toMatchObject({ index: 2, within: 0.5 });
  });

  it("holds the last step once the section has scrolled past", () => {
    expect(at(-5000).index).toBe(3);
    expect(at(-5000).progress).toBe(1);
  });

  it("survives a section no taller than the window", () => {
    expect(scrollSteps(0, 600, 800, 3).index).toBe(0);
  });
});

it("scrollTopForStep lands mid-step, which scrollSteps reads back as that step", () => {
  for (const index of [0, 1, 2, 3]) {
    const y = scrollTopForStep(1000, 4000, 800, 4, index);
    expect(scrollSteps(1000 - y, 4000, 800, 4).index).toBe(index);
  }
});
