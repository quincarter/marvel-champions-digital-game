/** A frame over a real builder for the sections' unit tests: text is never measured in a DOM, and every press is recorded. */
import { vi } from "vitest";
import type { SheetNode } from "@mc/ui";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import type { PackLeases } from "../../../art/pack-art.js";
import { Registry, type Frame } from "./frame.js";

export function testFrame(): { readonly f: Frame; readonly b: SheetBuilder; readonly reg: Registry } {
  vi.spyOn(SheetBuilder.prototype, "measure").mockReturnValue({ width: 40, height: 16 });
  const reg = new Registry();
  const leases = { image: () => ({ src: null }) } as unknown as PackLeases;
  const make = (b: SheetBuilder): Frame => ({ b, reg, leases, into: make });
  const b = new SheetBuilder({} as never, { x: 0, y: 0 }, () => false);
  return { f: make(b), b, reg };
}

/** Every node of `kind` in a builder's output (a scroller's inner nodes included). */
export function nodesOf<K extends SheetNode["kind"]>(
  nodes: readonly SheetNode[],
  kind: K,
): Extract<SheetNode, { kind: K }>[] {
  return nodes.flatMap((n) => [
    ...(n.kind === kind ? [n as Extract<SheetNode, { kind: K }>] : []),
    ...(n.kind === "scroll" ? nodesOf(n.nodes, kind) : []),
  ]);
}

/** The keys of the press areas drawn. */
export const tapKeys = (nodes: readonly SheetNode[]): string[] => nodesOf(nodes, "tap").map((n) => n.key);
