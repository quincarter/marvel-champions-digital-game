/**
 * Empties a scene's display list **and destroys what was on it** — what every
 * scene's redraw means by "start from a blank screen".
 *
 * `scene.children.removeAll(true)` is not that call. `scene.children` is a
 * `Structs.List`, whose signature is `removeAll(skipCallback)`: the `true`
 * skips the removal callback and destroys nothing. (`Container#removeAll(
 * destroyChild)` is the one whose flag destroys, and the two are easy to
 * confuse.) Every redraw therefore orphaned the whole previous screen. An
 * orphaned `Text` keeps its 2D canvas and its GPU texture, so a board redraw
 * leaked about a hundred textures per command. After a few hundred commands
 * the driver starts refusing uploads, and an incomplete texture samples as
 * opaque black: every *newly drawn* label on every screen becomes a solid
 * black bar while older labels and card scans still look right.
 *
 * Destroying a rexUI sizer or a Container destroys its children too, so the
 * walk runs over a copy and relies on `GameObject#destroy` being a no-op on an
 * object that is already gone.
 */

/** The part of a scene this reads, so it can be tested without a renderer. */
export interface DestroyableScene {
  readonly children: { readonly list: readonly { destroy(): void }[] };
}

export function destroyChildren(scene: DestroyableScene): void {
  for (const child of [...scene.children.list]) child.destroy();
}
