export type InterviewArchetype =
  | 'skeptic'
  | 'friendly_champion'
  | 'technical_griller'
  | 'distracted_senior'
  | 'culture_fit'
  | 'silent_observer'

export interface InterviewPersona {
  id: string
  name: string
  archetype: InterviewArchetype
  portraitGender: 'men' | 'women'
  portraitIndex: number
}

const PERSONAS: InterviewPersona[] = [
  { id: 'skeptic-1', name: 'Marcus Bennett', archetype: 'skeptic', portraitGender: 'men', portraitIndex: 44 },
  { id: 'skeptic-2', name: 'Priya Raman', archetype: 'skeptic', portraitGender: 'women', portraitIndex: 68 },
  { id: 'skeptic-3', name: 'Elena Kovac', archetype: 'skeptic', portraitGender: 'women', portraitIndex: 75 },
  { id: 'skeptic-4', name: 'Daniel Weber', archetype: 'skeptic', portraitGender: 'men', portraitIndex: 52 },

  { id: 'friendly-1', name: 'Maya Chen', archetype: 'friendly_champion', portraitGender: 'women', portraitIndex: 32 },
  { id: 'friendly-2', name: 'Olivia Brooks', archetype: 'friendly_champion', portraitGender: 'women', portraitIndex: 41 },
  { id: 'friendly-3', name: 'Jason Patel', archetype: 'friendly_champion', portraitGender: 'men', portraitIndex: 36 },
  { id: 'friendly-4', name: 'Avery Thompson', archetype: 'friendly_champion', portraitGender: 'men', portraitIndex: 29 },

  { id: 'technical-1', name: 'Iris Nakamura', archetype: 'technical_griller', portraitGender: 'women', portraitIndex: 58 },
  { id: 'technical-2', name: 'Noah Schmidt', archetype: 'technical_griller', portraitGender: 'men', portraitIndex: 63 },
  { id: 'technical-3', name: 'Victor Alvarez', archetype: 'technical_griller', portraitGender: 'men', portraitIndex: 47 },
  { id: 'technical-4', name: 'Leah Singh', archetype: 'technical_griller', portraitGender: 'women', portraitIndex: 54 },

  { id: 'distracted-1', name: 'Caroline Hayes', archetype: 'distracted_senior', portraitGender: 'women', portraitIndex: 81 },
  { id: 'distracted-2', name: 'Adrian Rossi', archetype: 'distracted_senior', portraitGender: 'men', portraitIndex: 78 },
  { id: 'distracted-3', name: 'Rebecca Stone', archetype: 'distracted_senior', portraitGender: 'women', portraitIndex: 65 },
  { id: 'distracted-4', name: 'Henry Foster', archetype: 'distracted_senior', portraitGender: 'men', portraitIndex: 73 },

  { id: 'culture-1', name: 'Naomi Rivera', archetype: 'culture_fit', portraitGender: 'women', portraitIndex: 37 },
  { id: 'culture-2', name: 'Sofia Morales', archetype: 'culture_fit', portraitGender: 'women', portraitIndex: 49 },
  { id: 'culture-3', name: 'Jordan Clarke', archetype: 'culture_fit', portraitGender: 'men', portraitIndex: 42 },
  { id: 'culture-4', name: 'Ethan Park', archetype: 'culture_fit', portraitGender: 'men', portraitIndex: 57 },

  { id: 'observer-1', name: 'Harper Quinn', archetype: 'silent_observer', portraitGender: 'women', portraitIndex: 71 },
  { id: 'observer-2', name: 'Samuel Reed', archetype: 'silent_observer', portraitGender: 'men', portraitIndex: 69 },
  { id: 'observer-3', name: 'Nina Wallace', archetype: 'silent_observer', portraitGender: 'women', portraitIndex: 84 },
  { id: 'observer-4', name: 'Leon Grant', archetype: 'silent_observer', portraitGender: 'men', portraitIndex: 76 },
]

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function pickPersonaForArchetype(
  archetype: InterviewArchetype,
  usedIds: Set<string>,
  seed: string
): InterviewPersona {
  const candidates = PERSONAS.filter((p) => p.archetype === archetype)
  const unpicked = candidates.filter((p) => !usedIds.has(p.id))
  const pool = unpicked.length > 0 ? unpicked : candidates
  const idx = hash(`${seed}:${archetype}`) % pool.length
  const selected = pool[idx]
  usedIds.add(selected.id)
  return selected
}
