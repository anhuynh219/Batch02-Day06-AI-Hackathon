export type LatLng = { lat: number; lng: number }

export type Zone = {
  id: string
  name: string
  color: string       // hex, for map + timeline accents
  latLng: LatLng      // seed coords (refined via Calibration)
  shortDesc: string
}

export type AttractionKind =
  | 'thrill' | 'family' | 'kids' | 'water' | 'indoor' | 'show' | 'aquarium'

export type Attraction = {
  id: string
  name: string
  zoneId: string
  kind: AttractionKind
  durationMin: number
  intensity: 1 | 2 | 3 | 4 | 5
  kidFriendly: boolean
  tags: string[]
  openTime: string    // "HH:MM"
  closeTime: string   // "HH:MM"
  showTimes?: string[] // only for kind==='show', e.g. ["18:30"]
}

export type ItineraryItemType = 'ride' | 'show' | 'meal' | 'break' | 'entrance'

export type ItineraryItem = {
  id: string
  refId: string | null   // Attraction.id, or null for meal/break
  type: ItineraryItemType
  title: string
  zoneId: string | null
  startTime: string      // "HH:MM"
  endTime: string        // "HH:MM"
  locked: boolean
  warning?: string
}

export type Meal = { type: 'lunch' | 'dinner' | 'snack'; around: string }

export type UserConstraints = {
  arrivalTime: string
  departureTime: string
  groupSize: number
  hasKids: boolean
  prefs: string[]
  meals: Meal[]
  mustDo: string[]
  avoid: string[]
}

// What the engine consumes: an ordered list of plan entries.
// `lockedStart` ("HH:MM") pins the entry to a fixed start time (set when the user
// locks it); the engine schedules around it instead of re-sequencing it.
export type PlanEntry =
  | { kind: 'attraction'; refId: string; locked?: boolean; lockedStart?: string }
  | { kind: 'meal'; meal: Meal; durationMin: number; zoneId?: string | null; locked?: boolean; lockedStart?: string }
  | { kind: 'break'; durationMin: number; locked?: boolean; lockedStart?: string }

// Gemini's structured response (mirrored in server/gemini.ts schema)
export type PlanResponse = {
  action: 'plan' | 'edit' | 'clarify'
  constraints?: Partial<UserConstraints>
  chosenIds?: string[]
  clarifyQuestion?: string
  assistantText: string
}
