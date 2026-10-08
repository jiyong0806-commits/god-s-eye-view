import { z } from 'zod';

export const SpatialIntent = z.object({
  action: z.enum(['show', 'find', 'compare', 'measure', 'analyze']),
  location: z.string().trim().min(1).max(160).nullable(),
  concept: z.enum(['park', 'airport', 'hospital', 'railway-station', 'satellite-imagery', 'distance', 'region']),
  modifiers: z.array(z.enum(['large', 'nearby', 'two-points'])).max(4),
  time: z.enum(['current', 'previous-year']).nullable(),
  requestedVisualization: z.enum(['markers', 'imagery', 'comparison', 'measurement']),
}).strict();

// Deliberately bounded Korean parser, not a general LLM or spatial reasoning engine.
export function parseSpatialIntent(input) {
  if (typeof input !== 'string' || input.length > 200) return null;
  const value = input.trim();
  if (/^이 두 지점의 거리를 측정해[.!?]?$/.test(value)) return SpatialIntent.parse({ action: 'measure', location: null,
    concept: 'distance', modifiers: ['two-points'], time: null, requestedVisualization: 'measurement' });
  if (/^이 지역을 작년과 비교해[.!?]?$/.test(value)) return SpatialIntent.parse({ action: 'compare', location: null,
    concept: 'region', modifiers: [], time: 'previous-year', requestedVisualization: 'comparison' });
  const match = value.match(/^(.{1,100}?)(?:의|\s+주변)\s*(큰\s*)?(공원|공항|병원|철도역|위성사진|위성 영상)(?:을|를)?\s*(보여줘|찾아줘)[.!?]?$/);
  if (!match) return null;
  const concepts = { 공원: 'park', 공항: 'airport', 병원: 'hospital', 철도역: 'railway-station', 위성사진: 'satellite-imagery', '위성 영상': 'satellite-imagery' };
  return SpatialIntent.parse({ action: match[4] === '찾아줘' ? 'find' : 'show', location: match[1].trim(), concept: concepts[match[3]],
    modifiers: [...(match[2] ? ['large'] : []), ...(value.includes(' 주변') ? ['nearby'] : [])], time: 'current',
    requestedVisualization: concepts[match[3]] === 'satellite-imagery' ? 'imagery' : 'markers' });
}
