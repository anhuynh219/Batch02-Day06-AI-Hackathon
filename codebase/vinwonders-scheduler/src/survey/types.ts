export type TimeRange = 'full' | 'morning' | 'afternoon'
export type GroupType = 'solo' | 'couple' | 'friends' | 'family'
export type IntensityPref = 'high' | 'balanced' | 'gentle' | 'kids'
export type Interest = 'thrill' | 'water' | 'aquarium' | 'show' | 'indoor' | 'adventure'
export type Pace = 'relaxed' | 'balanced' | 'packed'
export type AvoidKey = 'heights' | 'wet' | 'queue' | 'vegetarian' | 'allergy'

export type SurveyProfile = {
  timeRange: TimeRange
  groupType: GroupType
  intensity: IntensityPref
  interests: Interest[]
  pace: Pace
  avoid: AvoidKey[]
  completedAt: string
}
