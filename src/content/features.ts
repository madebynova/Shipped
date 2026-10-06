import type { FeatureDef } from '../engine/types'

// Exactly six features for v0.0.1. Complexity is the cost (build effort + scope);
// the two weights say what the feature gives the review. Every feature is worth
// the same in total (2 x complexity) but spends it differently, so "which features"
// is a real choice and not just "biggest first".
export const FEATURE_DEFS: readonly FeatureDef[] = [
  {
    id: 'combat',
    name: 'Combat',
    description: 'Hits, blocks and enemies that hit back.',
    complexity: 3,
    gameplayWeight: 4,
    contentWeight: 2,
  },
  {
    id: 'story',
    name: 'Story',
    description: 'A world, a cast and a reason to keep playing.',
    complexity: 2,
    gameplayWeight: 1,
    contentWeight: 3,
  },
  {
    id: 'crafting',
    name: 'Crafting',
    description: 'Gather, combine and build your way up.',
    complexity: 2,
    gameplayWeight: 2,
    contentWeight: 2,
  },
  {
    id: 'physics',
    name: 'Physics',
    description: 'Objects that tumble, collide and surprise.',
    complexity: 3,
    gameplayWeight: 4,
    contentWeight: 2,
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    description: 'Anything with wheels, wings or an engine.',
    complexity: 3,
    gameplayWeight: 2,
    contentWeight: 4,
  },
  {
    id: 'customization',
    name: 'Character Customization',
    description: 'Let players make the hero their own.',
    complexity: 1,
    gameplayWeight: 1,
    contentWeight: 1,
  },
]
