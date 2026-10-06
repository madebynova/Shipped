import type { Concept, FeatureId, Genre } from '../engine/types'

// THE CONCEPT GALLERY. Starter ideas the player can pick, roll, or ignore.
//
// This file is just data: to add a concept, add one object to CONCEPTS (the tests check it for you:
// names that fit, pitches that fit, 2-3 seed features, a real genre, and so on).
//
// Each concept has:
//   title         the game's name (the form allows up to 32 characters)
//   pitch         one line. It becomes the CORE IDEA, so it also drives the ORIGINALITY score (max 140 characters)
//   genre         one of the six genres
//   seedFeatures  the 2-3 feature cards this pitch is built around. They are what the game PROMISES: a seed
//                 feature that is not in the build at launch becomes a promise to finish after launch.
//   vision        a short phrase for the feeling the game is going for (flavour text)
//   beginner      true = a gentle idea for MY FIRST GAME (only uses that run's four teaching cards)

export interface ConceptTemplate {
  id: string
  title: string
  pitch: string
  genre: Genre
  seedFeatures: readonly FeatureId[]
  vision: string
  beginner?: boolean
}

export const MAX_TITLE = 32
export const MAX_IDEA = 140

export const CONCEPTS: readonly ConceptTemplate[] = [
  // ---- gentle ones, safe for MY FIRST GAME ----------------------------------------------------
  {
    id: 'lantern-hollow',
    title: 'Lantern Hollow',
    pitch: 'A cozy adventure where a tiny lantern-keeper befriends forest spirits, crafts glowing gear and wakes a sleepy village.',
    genre: 'RPG',
    seedFeatures: ['story', 'crafting'],
    vision: 'A warm light in a quiet wood',
    beginner: true,
  },
  {
    id: 'pocket-dojo',
    title: 'Pocket Dojo',
    pitch: 'A tiny mouse dojo where every lesson is a quick duel, and every rival you beat becomes a friend with opinions.',
    genre: 'Action',
    seedFeatures: ['combat', 'story', 'customization'],
    vision: 'Small paws, big respect',
    beginner: true,
  },
  {
    id: 'moss-and-mortar',
    title: 'Moss & Mortar',
    pitch: 'Build a tiny wizard tower one brick at a time, then argue with the resident ghosts about where the sofa goes.',
    genre: 'Simulation',
    seedFeatures: ['crafting', 'customization', 'story'],
    vision: 'Cozy chaos, with ghosts',
    beginner: true,
  },

  // ---- the rest of the shelf: sane to strange --------------------------------------------------
  {
    id: 'cold-bite',
    title: 'Cold Bite',
    pitch: 'Fish a flooded town after dark. Every catch is delicious, and every catch has been watching you since the first cast.',
    genre: 'Survival',
    seedFeatures: ['crafting', 'story', 'physics'],
    vision: 'Dread, with a tackle box',
  },
  {
    id: 'parcel-panic',
    title: 'Parcel Panic',
    pitch: 'Deliver cursed parcels across a city that rearranges itself every night. Die, restock, ride again. The tips are great.',
    genre: 'Action',
    seedFeatures: ['vehicles', 'physics'],
    vision: 'Delivery, but doomed',
  },
  {
    id: 'velvet-heist',
    title: 'Velvet Heist',
    pitch: 'Plan a museum heist on a blueprint, then watch your crew improvise something worse. Tactics for people who love plans and chaos.',
    genre: 'Strategy',
    seedFeatures: ['story', 'customization', 'physics'],
    vision: 'A plan that survives five seconds',
  },
  {
    id: 'idol-ranch',
    title: 'Idol Ranch',
    pitch: 'Raise a herd of idol hopefuls on a sunny ranch. Balance their feelings, feed them well, and sell out arenas before they burn out.',
    genre: 'Simulation',
    seedFeatures: ['customization', 'story', 'crafting'],
    vision: 'Cute, right up until the contract',
  },
  {
    id: 'rust-choir',
    title: 'Rust Choir',
    pitch: 'A walking church of retired war-robots sings the last songs of a dying world. Turn-based, mournful, and very loud.',
    genre: 'RPG',
    seedFeatures: ['combat', 'story', 'customization'],
    vision: 'Hymns for the machines',
  },
  {
    id: 'tidebreaker',
    title: 'Tidebreaker',
    pitch: 'Command a fleet of floating cities as the sea rises. Every harbor is a decision, and every decision floods something.',
    genre: 'Strategy',
    seedFeatures: ['vehicles', 'story', 'crafting'],
    vision: 'Leadership, underwater',
  },
  {
    id: 'bridge-troll-tycoon',
    title: 'Bridge Troll Tycoon',
    pitch: 'Run a toll bridge for fairy-tale travelers. Haggle with goats, bill the giants, and survive one very persistent knight.',
    genre: 'Simulation',
    seedFeatures: ['story', 'customization', 'crafting'],
    vision: 'Customer service, but folklore',
  },
  {
    id: 'dune-drifters',
    title: 'Dune Drifters',
    pitch: 'Skid across a living desert in a rusted sand-yacht. The wind is your engine and the storm is your rival.',
    genre: 'Racing',
    seedFeatures: ['vehicles', 'physics', 'crafting'],
    vision: 'Speed, with sand in it',
  },
  {
    id: 'last-light-diner',
    title: 'Last Light Diner',
    pitch: 'Run an all-night diner at the end of the world. Keep the lights on, the grill hot and the customers mostly human.',
    genre: 'Survival',
    seedFeatures: ['crafting', 'story', 'combat'],
    vision: 'One more refill',
  },
  {
    id: 'gravity-gardeners',
    title: 'Gravity Gardeners',
    pitch: 'Tend a garden on a spinning space station where every watering can sends the soil sideways.',
    genre: 'Simulation',
    seedFeatures: ['physics', 'crafting', 'customization'],
    vision: 'Calm, but sideways',
  },
  {
    id: 'mothman-express',
    title: 'Mothman Express',
    pitch: 'Race a cryptid down a midnight highway. Your headlights attract the strange, and the strange has a fan club.',
    genre: 'Racing',
    seedFeatures: ['vehicles', 'story', 'physics'],
    vision: 'Night drives and moths',
  },
  {
    id: 'sir-reginald-falls',
    title: 'Sir Reginald Falls Down',
    pitch: 'A knight in far too much armor tries to climb one hill. Physics is a harsh critic and the hill is undefeated.',
    genre: 'Action',
    seedFeatures: ['physics', 'combat', 'customization'],
    vision: 'Slapstick, with a sword',
  },
  {
    id: 'echo-tavern',
    title: 'Echo Tavern',
    pitch: 'Run a tavern where adventurers lie about their quests, and the best lies quietly turn into real ones.',
    genre: 'RPG',
    seedFeatures: ['story', 'crafting', 'combat'],
    vision: 'Tall tales, taller bills',
  },
  {
    id: 'iron-pulse',
    title: 'Iron Pulse',
    pitch: 'A brutal physics-driven hand-to-hand combat game where every hit matters.',
    genre: 'Action',
    seedFeatures: ['combat', 'physics'],
    vision: 'Every hit has weight',
  },
]

export function findConcept(id: string | null | undefined): ConceptTemplate | undefined {
  return id ? CONCEPTS.find((c) => c.id === id) : undefined
}

/** The gentle starter ideas offered by MY FIRST GAME (exactly three). */
export function beginnerConcepts(): ConceptTemplate[] {
  return CONCEPTS.filter((c) => c.beginner)
}

/** Turn a gallery entry into the concept a run is started from. The player can still edit all of it. */
export function conceptFromTemplate(t: ConceptTemplate): Concept {
  return { title: t.title, idea: t.pitch, genre: t.genre, seedFeatures: [...t.seedFeatures], vision: t.vision }
}

/**
 * ROLL RANDOM: any concept from the pool, never `exceptId` (so a re-roll always shows something new).
 * `random` is a function that returns a number from 0 up to (not including) 1, like Math.random; passing
 * it in keeps this testable. A pool with a single entry just returns it.
 */
export function rollConcept(pool: readonly ConceptTemplate[], random: () => number, exceptId?: string | null): ConceptTemplate {
  const choices = pool.length > 1 ? pool.filter((c) => c.id !== exceptId) : pool
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}
