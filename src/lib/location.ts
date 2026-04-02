// ─── Location service abstraction layer ──────────────────────────────────────
// Provider: Google Places API (New) — replaces Nominatim
// All provider-specific logic is isolated here. UI components import only
// the normalized types and functions below.

// ─── Types ───────────────────────────────────────────────────────────────────

/** Normalized location result used throughout the app. */
export interface PlaceLocation {
  placeId: string
  name: string
  address: string
  secondaryText: string
  lat: number
  lng: number
  distance?: number // meters from reference point
  types: string[]
  source: 'search' | 'current_location' | 'manual'
}

/** Lightweight prediction returned during autocomplete (no coordinates yet). */
export interface PlacePrediction {
  placeId: string
  name: string
  secondaryText: string
  distance?: number // meters, if origin was provided
}

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? '') as string
const PLACES_BASE = 'https://places.googleapis.com/v1'

// ─── Session tokens ──────────────────────────────────────────────────────────
// A session groups an autocomplete query + the subsequent place-details lookup
// into a single billing session on the Google side.

export function generateSessionToken(): string {
  return crypto.randomUUID()
}

// ─── Distance helpers ────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.344
const METERS_PER_FOOT = 0.3048

export function formatDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE
  if (miles < 0.1) return `${Math.round(meters / METERS_PER_FOOT)} ft`
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

/** Haversine distance in meters between two WGS-84 points. */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ─── Autocomplete ────────────────────────────────────────────────────────────

interface AutocompleteOptions {
  userLocation?: { lat: number; lng: number }
  sessionToken?: string
}

// Google Places Autocomplete (New) response shapes
interface GooglePrediction {
  placePrediction?: {
    placeId?: string
    place_id?: string
    place?: string // "places/PLACE_ID"
    text?: { text?: string }
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
    distanceMeters?: number
  }
}

export async function autocomplete(
  input: string,
  options?: AutocompleteOptions,
): Promise<PlacePrediction[]> {
  if (!input.trim() || input.trim().length < 2) return []
  if (!API_KEY) {
    console.warn('[location] VITE_GOOGLE_PLACES_API_KEY not set')
    return []
  }

  const body: Record<string, unknown> = {
    input: input.trim(),
    languageCode: 'en',
    // Only Table A types are valid for includedPrimaryTypes.
    // Omitting the field entirely lets Google match all place types,
    // which works better for coffee shops that may be tagged as
    // restaurants, bakeries, etc.
  }

  if (options?.userLocation) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.userLocation.lat,
          longitude: options.userLocation.lng,
        },
        radius: 16000.0, // ~10 miles
      },
    }
    body.origin = {
      latitude: options.userLocation.lat,
      longitude: options.userLocation.lng,
    }
  }

  if (options?.sessionToken) {
    body.sessionToken = options.sessionToken
  }

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[location] autocomplete failed', res.status, errBody)
    return []
  }

  const data = (await res.json()) as { suggestions?: GooglePrediction[] }
  if (!data.suggestions) return []

  const seen = new Set<string>()
  const results: PlacePrediction[] = []

  for (const suggestion of data.suggestions) {
    const pred = suggestion.placePrediction
    if (!pred) continue

    // placeId may come in different shapes depending on API version
    const placeId =
      pred.placeId ??
      pred.place_id ??
      pred.place?.replace('places/', '') ??
      ''
    if (!placeId || seen.has(placeId)) continue
    seen.add(placeId)

    results.push({
      placeId,
      name:
        pred.structuredFormat?.mainText?.text ??
        pred.text?.text?.split(',')[0]?.trim() ??
        '',
      secondaryText: pred.structuredFormat?.secondaryText?.text ?? '',
      distance: pred.distanceMeters,
    })
  }

  // Sort by distance so closest results appear first
  results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

  return results
}

// ─── Nearby search ───────────────────────────────────────────────────────────

interface NearbyPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  types?: string[]
}

export async function searchNearby(
  location: { lat: number; lng: number },
): Promise<PlacePrediction[]> {
  if (!API_KEY) return []

  const res = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.shortFormattedAddress,places.location,places.types',
    },
    body: JSON.stringify({
      includedTypes: ['cafe', 'coffee_shop'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 8000.0, // ~5 miles
        },
      },
      rankPreference: 'DISTANCE',
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[location] searchNearby failed', res.status, errBody)
    return []
  }

  const data = (await res.json()) as { places?: NearbyPlace[] }
  if (!data.places) return []

  return data.places
    .filter(p => p.id && p.displayName?.text)
    .map(p => {
      const dist =
        p.location?.latitude != null && p.location?.longitude != null
          ? haversineDistance(location, {
              lat: p.location.latitude,
              lng: p.location.longitude,
            })
          : undefined

      return {
        placeId: p.id!,
        name: p.displayName!.text!,
        secondaryText: p.shortFormattedAddress ?? '',
        distance: dist,
      }
    })
}

// ─── Place details ───────────────────────────────────────────────────────────

interface GooglePlaceDetails {
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: Array<{
    longText?: string
    shortText?: string
    types?: string[]
  }>
  types?: string[]
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceLocation> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_PLACES_API_KEY not set')

  const fields =
    'displayName,formattedAddress,shortFormattedAddress,location,addressComponents,types'

  let url = `${PLACES_BASE}/places/${placeId}`
  if (sessionToken) url += `?sessionToken=${encodeURIComponent(sessionToken)}`

  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fields,
    },
  })

  if (!res.ok) throw new Error(`Place details failed: ${res.status}`)

  const data = (await res.json()) as GooglePlaceDetails

  return {
    placeId,
    name: data.displayName?.text ?? '',
    address: data.formattedAddress ?? '',
    secondaryText:
      data.shortFormattedAddress ?? data.formattedAddress ?? '',
    lat: data.location?.latitude ?? 0,
    lng: data.location?.longitude ?? 0,
    types: data.types ?? [],
    source: 'search',
  }
}

// ─── Reverse geocode ─────────────────────────────────────────────────────────

interface GoogleGeocodeResult {
  place_id?: string
  formatted_address?: string
  types?: string[]
  address_components?: Array<{
    long_name?: string
    short_name?: string
    types?: string[]
  }>
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<PlaceLocation | null> {
  if (!API_KEY) return null

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`,
  )
  if (!res.ok) return null

  const data = (await res.json()) as { results?: GoogleGeocodeResult[] }
  const result = data.results?.[0]
  if (!result) return null

  // Try to extract a readable short name from address components
  const getName = () => {
    const comps = result.address_components ?? []
    const poi = comps.find(c => c.types?.includes('point_of_interest'))
    if (poi) return poi.long_name ?? ''
    const route = comps.find(c => c.types?.includes('route'))
    const number = comps.find(c => c.types?.includes('street_number'))
    if (route && number) return `${number.short_name} ${route.short_name}`
    if (route) return route.short_name ?? ''
    return result.formatted_address?.split(',')[0] ?? ''
  }

  return {
    placeId: result.place_id ?? '',
    name: getName(),
    address: result.formatted_address ?? '',
    secondaryText: result.formatted_address ?? '',
    lat,
    lng,
    types: result.types ?? [],
    source: 'current_location',
  }
}

// ─── Geocode (address → coords) ─────────────────────────────────────────────

export async function geocodeAddress(
  address: string,
): Promise<PlaceLocation | null> {
  if (!API_KEY || !address.trim()) return null

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${API_KEY}`,
  )
  if (!res.ok) return null

  const data = (await res.json()) as { results?: GoogleGeocodeResult[] }
  const result = data.results?.[0]
  if (!result) return null

  // The geocoding API returns geometry differently
  const geo = (result as any).geometry?.location
  if (!geo) return null

  return {
    placeId: result.place_id ?? '',
    name: result.formatted_address?.split(',')[0] ?? '',
    address: result.formatted_address ?? '',
    secondaryText: result.formatted_address ?? '',
    lat: geo.lat,
    lng: geo.lng,
    types: result.types ?? [],
    source: 'manual',
  }
}
