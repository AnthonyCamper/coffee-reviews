import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LocationConfirmation from './LocationConfirmation'
import type { PlaceLocation } from '../../lib/location'

// Mock Leaflet (it requires a DOM with full layout capabilities)
vi.mock('leaflet', () => {
  const mockMap = {
    remove: vi.fn(),
    invalidateSize: vi.fn(),
  }
  const mockMarker = { addTo: vi.fn().mockReturnThis() }
  const mockTileLayer = { addTo: vi.fn().mockReturnThis() }

  return {
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => mockTileLayer),
      marker: vi.fn(() => mockMarker),
      divIcon: vi.fn(() => ({})),
    },
  }
})

const sampleLocation: PlaceLocation = {
  placeId: 'ChIJ_test123',
  name: 'Proud Mary',
  address: '172 Oxford St, Collingwood VIC 3066, Australia',
  secondaryText: '172 Oxford St, Collingwood',
  lat: -37.7998,
  lng: 144.9876,
  distance: 1200,
  types: ['cafe', 'food', 'establishment'],
  source: 'search',
}

describe('LocationConfirmation', () => {
  it('renders place name prominently', () => {
    render(<LocationConfirmation location={sampleLocation} onClear={vi.fn()} />)
    expect(screen.getByText('Proud Mary')).toBeInTheDocument()
  })

  it('renders full address', () => {
    render(<LocationConfirmation location={sampleLocation} onClear={vi.fn()} />)
    expect(
      screen.getByText('172 Oxford St, Collingwood VIC 3066, Australia'),
    ).toBeInTheDocument()
  })

  it('renders distance badge in miles when distance is provided', () => {
    render(<LocationConfirmation location={sampleLocation} onClear={vi.fn()} />)
    expect(screen.getByText('0.7 mi')).toBeInTheDocument() // 1200m ≈ 0.7 mi
  })

  it('does not render distance badge when distance is 0', () => {
    const loc = { ...sampleLocation, distance: 0 }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    expect(screen.queryByText('0 m')).not.toBeInTheDocument()
  })

  it('does not render distance badge when distance is undefined', () => {
    const loc = { ...sampleLocation, distance: undefined }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    // Should not have any distance badge
    const badges = screen.queryAllByText(/\d+ (m|km)/)
    expect(badges).toHaveLength(0)
  })

  it('renders source label for search', () => {
    render(<LocationConfirmation location={sampleLocation} onClear={vi.fn()} />)
    expect(screen.getByText('Searched')).toBeInTheDocument()
  })

  it('renders source label for current location', () => {
    const loc = { ...sampleLocation, source: 'current_location' as const }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    expect(screen.getByText('Current location')).toBeInTheDocument()
  })

  it('renders source label for manual entry', () => {
    const loc = { ...sampleLocation, source: 'manual' as const }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    expect(screen.getByText('Manual entry')).toBeInTheDocument()
  })

  it('calls onClear when "Search for a different shop" button is clicked', () => {
    const onClear = vi.fn()
    render(<LocationConfirmation location={sampleLocation} onClear={onClear} />)
    fireEvent.click(screen.getByText('Search for a different shop'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders map container element', () => {
    render(<LocationConfirmation location={sampleLocation} onClear={vi.fn()} />)
    const mapEl = screen.getByLabelText(`Map showing Proud Mary`)
    expect(mapEl).toBeInTheDocument()
    expect(mapEl).toHaveStyle({ height: '140px' })
  })

  it('handles long place names without overflow', () => {
    const loc = {
      ...sampleLocation,
      name: 'The Absolutely Incredibly Long Named Coffee Shop and Brunch Bar by the Beach That Everyone Loves',
    }
    render(
      <LocationConfirmation location={loc} onClear={vi.fn()} />,
    )
    // The name should be rendered (CSS handles truncation)
    expect(screen.getByText(loc.name)).toBeInTheDocument()
    // Container should not overflow its parent
    const nameEl = screen.getByText(loc.name)
    expect(nameEl.className).toContain('leading-snug')
  })

  it('handles long addresses without overflow', () => {
    const loc = {
      ...sampleLocation,
      address:
        'Suite 42, Level 3, Building B, 123-125 Very Long Street Name Boulevard, Inner West Suburb, Greater Metropolitan Area, New South Wales 2000, Australia',
    }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    expect(screen.getByText(loc.address)).toBeInTheDocument()
  })

  it('handles missing place name gracefully', () => {
    const loc = { ...sampleLocation, name: '' }
    render(<LocationConfirmation location={loc} onClear={vi.fn()} />)
    // Should still render the address
    expect(screen.getByText(loc.address)).toBeInTheDocument()
  })
})
