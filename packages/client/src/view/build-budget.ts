/**
 * When a list's first build stops drawing rows for this frame (issue #722): once its budget is spent, but never before
 * one row is drawn, so every frame of the build makes progress. No budget draws everything at once.
 */
export function overBuildBudget(budgetMs: number | undefined, rowsDrawn: number, elapsedMs: number): boolean {
  return budgetMs !== undefined && rowsDrawn > 0 && elapsedMs > budgetMs;
}
