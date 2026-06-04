import catalog from './vinwondersCatalog.json'
import type { Zone } from '../types'

export const ZONES: Zone[] = catalog.zones as Zone[]

export const ENTRANCE: Zone = catalog.entrance as Zone

export const ZONES_BY_ID: Record<string, Zone> =
  Object.fromEntries([ENTRANCE, ...ZONES].map((z) => [z.id, z]))

export const CALIBRATABLE_ZONES: Zone[] = [ENTRANCE, ...ZONES]
