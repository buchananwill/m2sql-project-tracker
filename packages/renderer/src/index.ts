/**
 * @m2sql/renderer - Render semantic model to Mermaid classDiagram format.
 * Implements the inverse of the parser: Database model -> .mmd file.
 */

export { renderToMermaid, type RenderOptions, type RenderResult, type RenderWarning } from './render.js';
export {
  inferArrowMappings,
  formatArrowMapping,
  type InferredArrowMapping,
} from './arrow-mappings.js';
export { orderRows } from './ordering.js';
export { extractArrows, renderArrows, type RenderedArrow } from './arrows.js';
