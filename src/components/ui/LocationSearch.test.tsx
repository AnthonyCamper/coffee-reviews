import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LocationSearch from './LocationSearch'
import type { PlaceLocation } from '../../lib/location'

const mockLocation = vi.hoisted(() => ({
  autocomplete: vi.fn(),
  getPlaceDetails: vi.fn(),
  reverseGeocode: vi.fn(),
  searchNearby: vi.fn(),
}))

vi.mock('../../lib/location', async () => {
  return {
    autocomplete: mockLocation.autocomplete,
    getPlaceDetails: mockLocation.getPlaceDetails,
    reverseGeocode: mockLocation.reverseGeocode,
    searchNearby: mockLocation.searchNearby,
    generateSessionToken: () => 'mock-session-token',
    formatDistance: (m: number) => {
      const miles = m / 1609.344
      if (miles < 0.1) return `${Math.round(m / 0.3048)} ft`
      if (miles < 10) return `${miles.toFixed(1)} mi`
      return `${Math.round(miles)} mi`
    },
  }
})

const mockOnSelect = vi.fn()

const samplePredictions = [
  { placeId: 'p1', name: 'Proud Mary', secondaryText: '172 Oxford St, Collingwood', distance: 1200 },
  { placeId: 'p2', name: 'Seven Seeds', secondaryText: '114 Berkeley St, Carlton', distance: 3500 },
  { placeId: 'p3', name: 'Patricia Coffee', secondaryText: 'Little Bourke St, Melbourne', distance: 800 },
]

const samplePlaceDetails: PlaceLocation = {
  placeId: 'p1',
  name: 'Proud Mary',
  address: '172 Oxford St, Collingwood VIC 3066, Australia',
  secondaryText: '172 Oxford St, Collingwood',
  lat: -37.7998,
  lng: 144.9876,
  types: ['cafe'],
  source: 'search',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocation.autocomplete.mockResolvedValue([])
  mockLocation.getPlaceDetails.mockResolvedValue(samplePlaceDetails)
})

describe('LocationSearch', () => {
  it('renders search input', () => {
    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    expect(screen.getByPlaceholderText('Search for a coffee shop…')).toBeInTheDocument()
  })

  it('renders nothing when a location is already selected', () => {
    const { container } = render(
      <LocationSearch onSelect={mockOnSelect} selectedLocation={samplePlaceDetails} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows "Coffee shops near me" button when input is empty', () => {
    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    expect(screen.getByText('Coffee shops near me')).toBeInTheDocument()
  })

  it('shows predictions after typing', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    const input = screen.getByPlaceholderText('Search for a coffee shop…')

    fireEvent.change(input, { target: { value: 'Proud' } })

    await waitFor(() => {
      expect(screen.getByText('Proud Mary')).toBeInTheDocument()
      expect(screen.getByText('Seven Seeds')).toBeInTheDocument()
    })
  })

  it('shows distance in miles for each prediction', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    const input = screen.getByPlaceholderText('Search for a coffee shop…')

    fireEvent.change(input, { target: { value: 'coffee' } })

    await waitFor(() => {
      expect(screen.getByText('0.7 mi')).toBeInTheDocument()  // 1200m
      expect(screen.getByText('2.2 mi')).toBeInTheDocument()  // 3500m
      expect(screen.getByText('0.5 mi')).toBeInTheDocument()  // 800m
    })
  })

  it('shows secondary text for predictions', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      expect(screen.getByText('172 Oxford St, Collingwood')).toBeInTheDocument()
      expect(screen.getByText('114 Berkeley St, Carlton')).toBeInTheDocument()
    })
  })

  it('shows no-results message for empty results', async () => {
    mockLocation.autocomplete.mockResolvedValue([])

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'xyznonexistent' },
    })

    await waitFor(() => {
      expect(screen.getByText('No places found')).toBeInTheDocument()
    })
  })

  it('calls onSelect with place details when prediction is clicked', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)
    mockLocation.getPlaceDetails.mockResolvedValue(samplePlaceDetails)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'Proud' },
    })

    await waitFor(() => {
      expect(screen.getByText('Proud Mary')).toBeInTheDocument()
    })

    fireEvent.mouseDown(screen.getByText('Proud Mary'))

    await waitFor(() => {
      expect(mockLocation.getPlaceDetails).toHaveBeenCalledWith('p1', 'mock-session-token')
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          placeId: 'p1',
          name: 'Proud Mary',
          lat: -37.7998,
          source: 'search',
        }),
      )
    })
  })

  it('has proper ARIA attributes', () => {
    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    const input = screen.getByPlaceholderText('Search for a coffee shop…')
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('shows Google attribution in results', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      expect(screen.getByText('Powered by Google')).toBeInTheDocument()
    })
  })

  // ── Scroll behavior tests ────────────────────────────────────────────────

  it('renders predictions inline (not absolutely positioned)', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      // Should NOT have absolute positioning classes
      expect(listbox.className).not.toContain('absolute')
      // Should be inline with margin-top
      expect(listbox.className).toContain('mt-2')
    })
  })

  it('results container has overscroll containment', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      // The scrollable inner div should have overscroll containment
      const scrollDiv = listbox.querySelector('.overflow-y-auto')!
      expect(scrollDiv).toBeTruthy()
      expect((scrollDiv as HTMLElement).style.overscrollBehaviorY).toBe('contain')
    })
  })

  it('results container has bounded max-height', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      const scrollDiv = listbox.querySelector('.overflow-y-auto') as HTMLElement
      expect(scrollDiv.style.maxHeight).toBe('min(320px, 50dvh)')
    })
  })

  it('no-results message renders inline', async () => {
    mockLocation.autocomplete.mockResolvedValue([])

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'xyznonexistent' },
    })

    await waitFor(() => {
      const noResults = screen.getByText('No places found').closest('div')!
      expect(noResults.className).not.toContain('absolute')
      expect(noResults.className).toContain('mt-2')
    })
  })

  it('root container does not use relative positioning', () => {
    const { container } = render(
      <LocationSearch onSelect={mockOnSelect} selectedLocation={null} />,
    )
    // Root should not be position:relative since predictions are inline
    expect(container.firstChild).not.toBeNull()
    expect((container.firstChild as HTMLElement).className).not.toContain('relative')
  })

  // ── Mobile viewport tests ────────────────────────────────────────────────

  it('predictions are accessible on small viewport', async () => {
    mockLocation.autocomplete.mockResolvedValue(samplePredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'test' },
    })

    await waitFor(() => {
      // All predictions should be in the document (scrollable)
      expect(screen.getByText('Proud Mary')).toBeInTheDocument()
      expect(screen.getByText('Seven Seeds')).toBeInTheDocument()
      expect(screen.getByText('Patricia Coffee')).toBeInTheDocument()
    })

    // Each prediction should be a button for tap accessibility
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('handles many predictions without overflow', async () => {
    const manyPredictions = Array.from({ length: 20 }, (_, i) => ({
      placeId: `p${i}`,
      name: `Coffee Shop ${i}`,
      secondaryText: `Address ${i}`,
      distance: i * 500,
    }))
    mockLocation.autocomplete.mockResolvedValue(manyPredictions)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'coffee' },
    })

    await waitFor(() => {
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(20)
      // The scrollable container should be bounded
      const listbox = screen.getByRole('listbox')
      const scrollDiv = listbox.querySelector('.overflow-y-auto') as HTMLElement
      expect(scrollDiv.style.maxHeight).toBeTruthy()
    })
  })

  it('handles long place names gracefully', async () => {
    const longNamePrediction = [{
      placeId: 'long',
      name: 'The Incredibly Long Named Coffee Shop and Artisan Bakery by the Beautiful Melbourne Waterfront',
      secondaryText: 'Suite 42, Level 3, Building B, 123-125 Very Long Street Name Boulevard, Inner West',
      distance: 1500,
    }]
    mockLocation.autocomplete.mockResolvedValue(longNamePrediction)

    render(<LocationSearch onSelect={mockOnSelect} selectedLocation={null} />)
    fireEvent.change(screen.getByPlaceholderText('Search for a coffee shop…'), {
      target: { value: 'long' },
    })

    await waitFor(() => {
      const name = screen.getByText(/The Incredibly Long Named/)
      expect(name.className).toContain('leading-snug')

      const address = screen.getByText(/Suite 42/)
      expect(address.className).toContain('line-clamp-2')
    })
  })
})
