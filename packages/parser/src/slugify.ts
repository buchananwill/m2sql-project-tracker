/**
 * Anchor/slug generation utilities.
 * Uses github-slugger for consistent anchor generation.
 */

import GithubSlugger from 'github-slugger';

/**
 * Create a slugger instance for a document.
 * Each document should use a single instance to track duplicates.
 */
export function createSlugger(): GithubSlugger {
  return new GithubSlugger();
}

/**
 * Generate an anchor from heading text.
 * If an explicit anchor is provided, use it (but still register to avoid collisions).
 */
export function generateAnchor(
  slugger: GithubSlugger,
  headingText: string,
  explicitAnchor?: string
): string {
  if (explicitAnchor) {
    // Register the explicit anchor to track it
    // We use slug() to potentially add a suffix if there's a collision
    // But first check if it would collide
      // If the result differs from input, there was a collision
    // In that case, use the result (which has a suffix)
    return slugger.slug(explicitAnchor);
  }

  return slugger.slug(headingText);
}

/**
 * Reset the slugger (for testing or reprocessing).
 */
export function resetSlugger(slugger: GithubSlugger): void {
  slugger.reset();
}
