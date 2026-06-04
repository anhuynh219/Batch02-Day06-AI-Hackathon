import catalog from './vinwondersCatalog.json'
import type { Attraction } from '../types'

export const ATTRACTIONS: Attraction[] = catalog.attractions as Attraction[]

export const ATTRACTIONS_BY_ID: Record<string, Attraction> =
  Object.fromEntries(ATTRACTIONS.map((a) => [a.id, a]))
