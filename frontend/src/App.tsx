import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Github, MapPin, Navigation2, Clock, CarTaxiFront, Crosshair, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StopSearchInput } from '@/components/StopSearchInput'
import MapCanvas from '@/components/map/MapCanvas'

type Line = {
  id: string
  name: string
  type: string
  color: string
  origin: string
  destination: string
  schedule?: {
    first_departure?: string
    last_departure?: string
    frequency?: string
  }
}

type Station = {
  id: number | string
  name: string
  lat: number
  lon: number
  lines?: string[]
  type?: string
}

type TransportData = {
  lines: Line[]
}

type JourneyLeg = {
  type: string
  fromStop: Station
  toStop: Station
  startTime: string
  endTime: string
  duration: number
  routeCode: string
  routeColor: string
  waitTime: number
  stops?: Station[]
  geometry?: [number, number][]
}

type CondensedLeg = {
  mode: string
  routeCode: string
  color: string
  fromStop: Station
  toStop: Station
  startTime?: string
  endTime?: string
  duration: number
  waitTime?: number
  isWalk: boolean
  segments: JourneyLeg[]
  stops: Station[]
}

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/v1'

const MODE_COLORS: Record<string, string> = {
  walk: '#000000',
  bus: '#0b2c6f',
  busway: '#0f7a0f',
  tram: '#d6452f',
  train: '#d10000',
  taxi: '#c58f00',
}

const normalizeMode = (value?: string) => (value || '').toLowerCase()

const getModeColor = (mode?: string, fallback?: string) => {
  const normalized = normalizeMode(mode)
  if (normalized === 'walk') return MODE_COLORS.walk
  return fallback || MODE_COLORS[normalized] || '#c1121f'
}

const getRouteColor = (routeCode?: string, mode?: string, fallback?: string) => {
  const code = (routeCode || '').toUpperCase()
  if (code === 'BW1') return '#05780F'
  if (code === 'BW2') return '#50DC64'
  if (code === 'T2') return 'rgba(255,220,0,1)'
  if (code === 'T3') return 'rgba(168,103,125,1)'
  if (code === 'T4') return 'rgba(86,147,193,1)'
  return getModeColor(mode, fallback)
}

const getReadableTextColor = (hexColor: string) => {
  const safe = hexColor?.replace('#', '') || '000000'
  const value = safe.length === 3 ? safe.split('').map((c) => c + c).join('') : safe.padEnd(6, '0')
  const r = parseInt(value.substring(0, 2), 16)
  const g = parseInt(value.substring(2, 4), 16)
  const b = parseInt(value.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 160 ? '#000000' : '#ffffff'
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [transportData, setTransportData] = useState<TransportData | null>(null)
  const [stops, setStops] = useState<Station[]>([])
  const [lineGeometries, setLineGeometries] = useState<Array<{ id: string | number; color: string; coordinates: [number, number][] }>>([])
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [plannerFields, setPlannerFields] = useState({
    origin: '',
    destination: '',
    time: 'now',
    dayType: 'weekday',
  })
  const [plannerCoords, setPlannerCoords] = useState<{ origin?: Station; destination?: Station }>({})
  const [routeStatus, setRouteStatus] = useState<string | null>(null)
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([])
  const [focusPoint, setFocusPoint] = useState<{ lon: number; lat: number } | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ kind: 'stop' | 'line'; label: string; meta?: string; station?: Station; line?: Line }>>([])
  const [showSearch, setShowSearch] = useState(false)
  const [contextMenuState, setContextMenuState] = useState<{ open: boolean; x: number; y: number; coords?: { lat: number; lon: number } }>({ open: false, x: 0, y: 0 })
  const [expandedLegs, setExpandedLegs] = useState<number[]>([])
  const [openScheduleCode, setOpenScheduleCode] = useState<string | null>(null)
  const [lineStops, setLineStops] = useState<Record<string, Station[]>>({})
  const [loadingStopsFor, setLoadingStopsFor] = useState<string | null>(null)

  // Keep line catalog memoized for downstream helpers
  const lines = useMemo(() => transportData?.lines ?? [], [transportData])

  const fetchLineStops = useCallback(
    async (routeCode: string) => {
      if (!routeCode) return
      if (lineStops[routeCode]) return
      setLoadingStopsFor(routeCode)
      try {
        const matchingLine = lines.find((l) => (l.code || l.id?.toString() || '').toUpperCase() === routeCode.toUpperCase())
        const lineId = matchingLine?.id ?? routeCode
        const res = await fetch(`${API_BASE}/lines/${lineId}`)
        if (!res.ok) return
        const detail = await res.json()
        const stopsForLine: Station[] = (detail.stops || []).map((s: Station) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          lines: s.lines || [],
          type: s.type,
        }))
        setLineStops((prev) => ({ ...prev, [routeCode]: stopsForLine }))
      } catch (error) {
        console.error('Failed to load line stops', error)
      } finally {
        setLoadingStopsFor(null)
      }
    },
    [lines, lineStops],
  )
  
  // Request tracking for race condition prevention
  const stopsRequestRef = useRef(0)
  
  // Map click mode for selecting custom locations
  const [mapClickMode, setMapClickMode] = useState<'origin' | 'destination' | null>(null)

  const createCustomStation = useCallback((coords: { lat: number; lon: number }): Station => ({
    id: `custom-${Date.now()}`,
    name: `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
    lat: coords.lat,
    lon: coords.lon,
    lines: [],
    type: 'custom',
  }), [])

  // Deduplicated stations - remove duplicates by name and coordinates
  const stations = useMemo(() => {
    const seen = new Map<string, Station>()
    stops.forEach((stop) => {
      // Create a key based on name and approximate coordinates
      const key = `${stop.name.toLowerCase()}_${stop.lat.toFixed(4)}_${stop.lon.toFixed(4)}`
      if (!seen.has(key)) {
        seen.set(key, stop)
      }
    })
    return Array.from(seen.values())
  }, [stops])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('casa-theme', theme)
  }, [theme])

  const closeContextMenu = useCallback(() => {
    setContextMenuState((prev) => ({ ...prev, open: false }))
  }, [])

  const handleMapContextMenu = useCallback((payload: { lat: number; lon: number; screenX: number; screenY: number }) => {
    setContextMenuState({ open: true, x: payload.screenX, y: payload.screenY, coords: { lat: payload.lat, lon: payload.lon } })
  }, [])

  const openContribution = useCallback(() => {
    window.open('https://github.com/eamonamkassou/morocco_transport', '_blank', 'noreferrer')
  }, [])

  const openTaxiCrowd = useCallback(() => {
    setRouteStatus('Crowdsource big taxi routes: drop pins on the map or send us your corridors.')
    window.open('https://github.com/eamonamkassou/morocco_transport/issues/new?title=Big%20Taxi%20Route%20Info', '_blank', 'noreferrer')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeContextMenu])

  useEffect(() => {
    if (!contextMenuState.open) return
    const handleOutside = () => closeContextMenu()
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [contextMenuState.open, closeContextMenu])

  useEffect(() => {
    const stored = localStorage.getItem('casa-theme') as 'light' | 'dark' | null
    if (stored) setTheme(stored)
  }, [])

  const loadLines = useCallback(async () => {
    try {
      setLoadingData(true)
      const response = await fetch(`${API_BASE}/lines`)
      if (!response.ok) throw new Error('Failed to load lines')
      const json: Line[] = await response.json()
      setTransportData({ lines: json })
      setFetchError(null)
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Unable to load lines')
    } finally {
      setLoadingData(false)
    }
  }, [])

  const loadLineGeometries = useCallback(async (lineList: Line[]) => {
    try {
      const results = await Promise.all(
        lineList.map(async (line) => {
          const res = await fetch(`${API_BASE}/lines/${line.id}`)
          if (!res.ok) return null
          const detail = await res.json()
          const coords = (detail.stops || []).map((s: Station) => [s.lon, s.lat] as [number, number])
          if (!coords.length) return null
          return { id: line.id, color: line.color || '#000000', coordinates: coords }
        }),
      )
      setLineGeometries(results.filter(Boolean) as Array<{ id: string | number; color: string; coordinates: [number, number][] }>)
    } catch (error) {
      console.error('Failed loading line geometries', error)
    }
  }, [])

  const loadStopsForViewport = useCallback(async (bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }) => {
    // Increment request counter to handle race conditions
    const requestId = ++stopsRequestRef.current
    
    try {
      const params = new URLSearchParams({
        min_lat: String(bbox.minLat),
        min_lon: String(bbox.minLon),
        max_lat: String(bbox.maxLat),
        max_lon: String(bbox.maxLon),
      })
      const res = await fetch(`${API_BASE}/stops?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load stops')
      const data: Station[] = await res.json()
      
      // Only update if this is still the latest request
      if (requestId === stopsRequestRef.current) {
        setStops(data)
        setFetchError(null)
      }
    } catch (error) {
      // Only update error if this is still the latest request
      if (requestId === stopsRequestRef.current) {
        setFetchError(error instanceof Error ? error.message : 'Unable to load stops')
      }
    }
  }, [])

  const decorateLegs = useCallback((legs: JourneyLeg[]) => {
    return legs.map((leg) => {
      const rawMode = normalizeMode(leg.type || leg.routeCode)
      const routeCode = (leg.routeCode || leg.type || '').toString()
      const codeUpper = routeCode.toUpperCase()

      let mode = rawMode
      if (codeUpper === 'FM' || codeUpper === 'TNR') {
        mode = 'train'
      } else if (codeUpper.startsWith('T')) {
        mode = 'tram'
      } else if (codeUpper.startsWith('BW')) {
        mode = 'busway'
      } else if (!mode || mode === 'transit') {
        mode = 'bus'
      }

      const color = getRouteColor(routeCode, mode, leg.routeColor)
      const isWalk = mode === 'walk'

      return {
        ...leg,
        type: mode,
        routeCode,
        routeColor: isWalk ? MODE_COLORS.walk : color,
      }
    })
  }, [])

  // Load all stops on initial mount with a very large bounding box covering Casablanca
  useEffect(() => {
    // Large bbox covering greater Casablanca area
    loadStopsForViewport({
      minLat: 33.4,
      minLon: -7.8,
      maxLat: 33.7,
      maxLon: -7.4,
    })
  }, [loadStopsForViewport])

  useEffect(() => {
    loadLines()
  }, [loadLines])

  // Note: Line geometries are disabled by default as they draw straight lines
  // between stops which don't align with actual roads. Enable via Layers panel.
  const [showLineGeometries, setShowLineGeometries] = useState(false)
  
  useEffect(() => {
    if (lines.length && showLineGeometries) {
      loadLineGeometries(lines)
    } else if (!showLineGeometries) {
      setLineGeometries([])
    }
  }, [lines, loadLineGeometries, showLineGeometries])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  // Handle map click for custom location selection
  const handleMapClick = useCallback((coords: { lat: number; lon: number }) => {
    if (!mapClickMode) return

    const customStation: Station = createCustomStation(coords)

    if (mapClickMode === 'origin') {
      setPlannerCoords((prev) => ({ ...prev, origin: customStation }))
      setPlannerFields((prev) => ({ ...prev, origin: customStation.name }))
    } else {
      setPlannerCoords((prev) => ({ ...prev, destination: customStation }))
      setPlannerFields((prev) => ({ ...prev, destination: customStation.name }))
    }

    setFocusPoint({ lon: customStation.lon, lat: customStation.lat })
    setMapClickMode(null)
  }, [createCustomStation, mapClickMode])

  const setOriginFromCoords = useCallback(
    (coords?: { lat: number; lon: number }) => {
      if (!coords) return
      const station = createCustomStation(coords)
      setPlannerCoords((prev) => ({ ...prev, origin: station }))
      setPlannerFields((prev) => ({ ...prev, origin: station.name }))
      setFocusPoint({ lon: station.lon, lat: station.lat })
      closeContextMenu()
    },
    [closeContextMenu, createCustomStation],
  )

  const setDestinationFromCoords = useCallback(
    (coords?: { lat: number; lon: number }) => {
      if (!coords) return
      const station = createCustomStation(coords)
      setPlannerCoords((prev) => ({ ...prev, destination: station }))
      setPlannerFields((prev) => ({ ...prev, destination: station.name }))
      setFocusPoint({ lon: station.lon, lat: station.lat })
      closeContextMenu()
    },
    [closeContextMenu, createCustomStation],
  )

  const computeRoute = async () => {
    if (!plannerCoords.origin || !plannerCoords.destination) {
      setRouteStatus('Select origin and destination to compute a route')
      return
    }

    // Helper to run one routing attempt
    const runRoute = async (timeInSeconds: number, label: string) => {
      setRouteStatus(`Requesting route (${label})…`)

      const params = new URLSearchParams({
        from_lat: String(plannerCoords.origin.lat),
        from_lon: String(plannerCoords.origin.lon),
        to_lat: String(plannerCoords.destination.lat),
        to_lon: String(plannerCoords.destination.lon),
        time: String(timeInSeconds),
        day: plannerFields.dayType.toLowerCase(),
      })

      const res = await fetch(`${API_BASE}/route?${params.toString()}`)
      if (!res.ok) {
        const text = await res.text()
        return { ok: false as const, message: text || 'No route found between these stops' }
      }

      const journey = await res.json()
      const legs: JourneyLeg[] = decorateLegs(journey.legs || [])
      const stopsByRoute: Record<string, Station[]> = {}
      legs.forEach((leg) => {
        const code = leg.routeCode || leg.type || ''
        if (code && leg.stops?.length) {
          stopsByRoute[code] = leg.stops
        }
      })

      if (Object.keys(stopsByRoute).length) {
        setLineStops((prev) => ({ ...prev, ...stopsByRoute }))
      }

      const uniqueRoutes = Array.from(new Set(legs.filter((l) => !normalizeMode(l.type).includes('walk') && l.routeCode).map((l) => l.routeCode)))
      if (uniqueRoutes.length) {
        uniqueRoutes.forEach((code) => {
          const key = code || ''
          if (!stopsByRoute[key]) fetchLineStops(key)
        })
      }
      setJourneyLegs(legs)
      setExpandedLegs([])
      setOpenScheduleCode(null)
      if (legs.length > 0) {
        const totalMins = legs.reduce((acc: number, leg: JourneyLeg) => acc + leg.duration / 60, 0)
        setRouteStatus(`Found route with ${legs.length} leg${legs.length > 1 ? 's' : ''} • ~${Math.round(totalMins)} min`)
      } else {
        setRouteStatus('No direct route found. Try different stops.')
      }

      return { ok: true as const }
    }

    // Convert selected time to seconds from midnight
    let primaryTime = 8 * 3600 + 30 * 60 // Default 08:30
    if (plannerFields.time === 'now') {
      const now = new Date()
      primaryTime = now.getHours() * 3600 + now.getMinutes() * 60
    } else if (plannerFields.time.includes(':')) {
      const [hours, minutes] = plannerFields.time.split(':').map(Number)
      primaryTime = hours * 3600 + (minutes || 0) * 60
    }

    // First attempt: requested time
    const first = await runRoute(primaryTime, plannerFields.time === 'now' ? 'now' : plannerFields.time)

    // Auto-fallback: if using "Now" and no route found, retry at 08:30 peak
    if (!first.ok && plannerFields.time === 'now') {
      setJourneyLegs([])
      setRouteStatus('No trips at this time. Retrying at 08:30…')
      await runRoute(8 * 3600 + 30 * 60, '08:30')
    } else if (!first.ok) {
      const msg = first.message || 'No route available between selected stops'
      setRouteStatus(msg.includes('No route') || msg.includes('No nearby') ? 'No route available between selected stops' : msg)
      setJourneyLegs([])
    }
  }

  // Basic debounced search across lines and visible stops
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }
    const id = setTimeout(() => {
      const term = searchTerm.toLowerCase()
      const stopMatches = stops
        .filter((s) => s.name.toLowerCase().includes(term))
        .slice(0, 6)
        .map((s) => ({ kind: 'stop' as const, label: s.name, meta: (s.lines || []).join(', '), station: s }))
      const lineMatches = lines
        .filter((l) => l.name.toLowerCase().includes(term) || l.id.toLowerCase().includes(term))
        .slice(0, 4)
        .map((l) => ({ kind: 'line' as const, label: l.name || l.id, meta: l.type, line: l }))
      setSearchResults([...stopMatches, ...lineMatches])
    }, 180)
    return () => clearTimeout(id)
  }, [searchTerm, stops, lines])

  const condensedLegs = useMemo(() => {
    if (!journeyLegs.length) return [] as CondensedLeg[]

    const merged: CondensedLeg[] = []

    journeyLegs.forEach((leg) => {
      const mode = normalizeMode(leg.type)
      const routeCode = leg.routeCode || leg.type || 'LEG'
      const color = leg.routeColor || getModeColor(mode)
      const isWalk = mode === 'walk'
      const last = merged[merged.length - 1]

      if (last && !isWalk && !last.isWalk && last.routeCode === routeCode && last.mode === mode) {
        last.toStop = leg.toStop
        last.endTime = leg.endTime || last.endTime
        last.duration += leg.duration
        last.waitTime = (last.waitTime || 0) + (leg.waitTime || 0)
        last.segments.push(leg)

        const seq = leg.stops?.length ? leg.stops : [leg.fromStop, leg.toStop]
        seq.forEach((s, idx) => {
          const prior = last.stops[last.stops.length - 1]
          const isFirstAndExisting = idx === 0 && prior && prior.id === s.id
          if (!isFirstAndExisting) {
            last.stops.push(s)
          }
        })
      } else {
        merged.push({
          mode,
          routeCode,
          color: isWalk ? MODE_COLORS.walk : color,
          fromStop: leg.fromStop,
          toStop: leg.toStop,
          startTime: leg.startTime,
          endTime: leg.endTime,
          duration: leg.duration,
          waitTime: leg.waitTime,
          isWalk,
          segments: [leg],
          stops: leg.stops?.length ? leg.stops : [leg.fromStop, leg.toStop],
        })
      }
    })

    return merged
  }, [journeyLegs])

  const findScheduleForRoute = useCallback(
    (routeCode: string) => {
      const target = (routeCode || '').toString().toLowerCase()
      return lines.find((line) => {
        const id = (line.id ?? '').toString().toLowerCase()
        const name = (line.name ?? '').toString().toLowerCase()
        const type = (line.type ?? '').toString().toLowerCase()
        return id === target || name === target || id.includes(target) || type === target
      })
    },
    [lines],
  )

  const plannerTab = (
    <div className="space-y-4">
      {/* Map click mode indicator */}
      {mapClickMode && (
        <div className="brut-card border-l-4 border-l-[var(--accent)] p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold uppercase text-xs">Click on the map to select {mapClickMode}</p>
            <Button 
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => setMapClickMode(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        <StopSearchInput
          label="Origin"
          placeholder="Search stop or pick from map"
          value={plannerFields.origin}
          stops={stations}
          onSelect={(station) => {
            setPlannerCoords((prev) => ({ ...prev, origin: station }))
            setPlannerFields((prev) => ({ ...prev, origin: station.name }))
            setFocusPoint({ lon: station.lon, lat: station.lat })
          }}
          onChange={(val) => setPlannerFields((prev) => ({ ...prev, origin: val }))}
          onPickFromMap={() => setMapClickMode('origin')}
        />
        <StopSearchInput
          label="Destination"
          placeholder="Where to?"
          value={plannerFields.destination}
          stops={stations}
          onSelect={(station) => {
            setPlannerCoords((prev) => ({ ...prev, destination: station }))
            setPlannerFields((prev) => ({ ...prev, destination: station.name }))
            setFocusPoint({ lon: station.lon, lat: station.lat })
          }}
          onChange={(val) => setPlannerFields((prev) => ({ ...prev, destination: val }))}
          onPickFromMap={() => setMapClickMode('destination')}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest">Depart At</span>
            <Select value={plannerFields.time} onValueChange={(value) => setPlannerFields((prev) => ({ ...prev, time: value }))}>
              <SelectTrigger aria-label="Depart at" className="w-full">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {['now', '06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((option) => (
                  <SelectItem key={option} value={option}>{option === 'now' ? 'Now' : option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest">Day</span>
            <Select value={plannerFields.dayType} onValueChange={(value) => setPlannerFields((prev) => ({ ...prev, dayType: value }))}>
              <SelectTrigger aria-label="Day type" className="w-full">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekday">Weekday</SelectItem>
                <SelectItem value="weekend">Weekend</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="flex h-12 w-12 items-center justify-center p-0"
          aria-label="Swap origin and destination"
          onClick={() => {
            if (!plannerCoords.origin && !plannerCoords.destination) return
            setPlannerCoords((prev) => ({ origin: prev.destination, destination: prev.origin }))
            setPlannerFields((prev) => ({ origin: plannerFields.destination, destination: plannerFields.origin }))
          }}
        >
          <ArrowUpDown size={16} />
        </Button>
        <Button className="h-12 w-full px-4 text-center" aria-label="Compute route" onClick={computeRoute}>
          Compute Route
        </Button>
      </div>
      {routeStatus && (
        <div className={`brut-card border-l-4 p-3 text-sm ${
          routeStatus.includes('Found route') 
            ? 'border-l-green-500' 
            : routeStatus.includes('Requesting') 
              ? 'border-l-[var(--accent)]' 
              : 'border-l-[var(--primary)]'
        }`}>
          <p className="font-bold">{routeStatus}</p>
          {!plannerCoords.origin || !plannerCoords.destination ? (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Click on stops or use the search to select origin and destination
            </p>
          ) : null}
        </div>
      )}
    </div>
    
  )

  const layersTab = (
    <div className="space-y-4 text-sm">
      <div>
        <span className="font-bold uppercase tracking-wide text-xs block mb-2">Display Options</span>
        <label className="flex items-center gap-3 border-2 border-[var(--border)] bg-[var(--card)] px-4 py-3 cursor-pointer hover:bg-[var(--muted)] transition-colors">
          <input 
            type="checkbox" 
            checked={showLineGeometries}
            onChange={(e) => setShowLineGeometries(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]" 
          />
          <div className="flex-1">
            <span className="uppercase text-xs font-bold block">Show Line Routes</span>
            <span className="text-xs text-[var(--muted-foreground)]">Lines may not align with roads</span>
          </div>
        </label>
      </div>
      <div>
        <span className="font-bold uppercase tracking-wide text-xs block mb-2">Filter by Mode</span>
        <div className="grid grid-cols-2 gap-2">
          {['Tram', 'Busway', 'Bus', 'Train', 'Taxi'].map((label) => (
            <label key={label} className="flex items-center gap-2 border-2 border-[var(--border)] bg-[var(--muted)] px-3 py-2 cursor-pointer hover:bg-[var(--card)] transition-colors">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)]" />
              <span className="uppercase text-xs font-bold">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  const bigTaxiTab = (
    <div className="space-y-4 text-sm">
      <div className="brut-card border-2 border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Crowdsource</div>
            <div className="text-lg font-black leading-tight">Add a Big Taxi Route</div>
          </div>
          <Badge tone="accent">Community</Badge>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Grand taxis run fixed corridors between cities and across Casablanca without marked stops. Share corridors, termini, and demand hot-spots to improve coverage.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="px-4 py-2 text-xs"
            onClick={() => window.open('https://github.com/eamonamkassou/morocco_transport/issues/new?title=Big%20Taxi%20Route%20Info', '_blank', 'noreferrer')}
          >
            Open submission form
          </Button>
          <Button
            variant="ghost"
            className="px-4 py-2 text-xs"
            onClick={() => setRouteStatus('Crowdsource big taxi routes: drop pins on the map or send us your corridors.')}
          >
            Remind me later
          </Button>
        </div>
      </div>
      <div className="brut-card border-2 border-[var(--border)] bg-[var(--muted)]/60 p-3">
        <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">What to include</div>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--muted-foreground)]">
          <li>Origin and destination (city or landmark)</li>
          <li>Typical path/roads used</li>
          <li>Operating hours and frequency (if known)</li>
          <li>Pick-up clusters or informal stands</li>
        </ul>
      </div>
    </div>
  )

  const alertsTab = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between border-2 border-[var(--accent)] bg-[var(--card)] p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-bold uppercase tracking-wide text-xs">All Clear</span>
        </div>
        <Badge tone="accent">Live</Badge>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">No service disruptions at this time</p>
    </div>
  )

  return (
    <div className="relative min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid-accent absolute inset-0" aria-hidden />

      <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-[var(--border)] bg-[var(--background)] px-6 py-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="brut-card flex items-center gap-2 px-3 py-2 font-bold uppercase tracking-widest">
            <span className="h-3 w-3 bg-[var(--primary)]" />
            Casa Transit
          </div>
          <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 text-xs" onClick={openContribution}>
            <Github size={16} /> Contribute!
          </Button>
          <Button variant="muted" className="flex items-center gap-2 px-3 py-2 text-xs" onClick={openTaxiCrowd}>
            <CarTaxiFront size={16} /> Help us with big taxi routes!
          </Button>
          <Badge className="status-badge shadow-none">Stops: {stations.length || '—'}</Badge>
          <Badge className="status-badge shadow-none">Lines: {lines.length || '—'}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden w-72 md:block">
            <Input
              placeholder="Search stops, lines"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setShowSearch(true)
              }}
              onFocus={() => setShowSearch(true)}
              aria-label="Search stops and lines"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-[110%] z-30 brut-card border-2 border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
                {searchResults.map((item, index) => (
                  <button
                    key={`${item.kind}-${index}`}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--muted)]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setShowSearch(false)
                      setSearchTerm(item.label)
                      if (item.kind === 'stop' && item.station) {
                        setFocusPoint({ lon: item.station.lon, lat: item.station.lat })
                        setPlannerCoords((prev) => ({ ...prev, destination: item.station }))
                        setPlannerFields((prev) => ({ ...prev, destination: item.label }))
                        setSelectedStation(item.station)
                      }
                    }}
                  >
                    <span className="font-bold uppercase tracking-tight">{item.label}</span>
                    <span className="text-xs uppercase tracking-wide">{item.meta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={toggleTheme} className="px-4 py-2 text-xs">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex h-[calc(100vh-64px)] flex-col gap-0 md:flex-row">
        <section className="relative flex-1 overflow-hidden border-2 border-[var(--border)] bg-[var(--muted)]">
          <div className="relative h-full w-full">
            <MapCanvas
              stations={stations}
              theme={theme}
              onSelectStation={setSelectedStation}
              onMapClick={handleMapClick}
              onContextMenuRequest={handleMapContextMenu}
              mapClickMode={mapClickMode}
              lineGeometries={lineGeometries}
              focusPoint={focusPoint}
              journeyLineStops={lineStops}
              journeyLegs={journeyLegs}
              selectedPoints={plannerCoords}
            />

            <div className="pointer-events-none absolute right-3 bottom-3 z-20 max-w-xs">
              <div className="pointer-events-auto brut-card border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-[var(--shadow-md)]">
                Hold Ctrl + right-click on the map for actions (set origin/destination, focus). Hold Ctrl + click a station for rich info.
              </div>
            </div>

            {/* Map click mode overlay */}
            {mapClickMode && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-4">
                <div className="pointer-events-auto brut-card border-2 border-[var(--accent)] bg-[var(--card)]/95 px-6 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div>
                      <p className="font-bold uppercase text-sm">Click anywhere to set {mapClickMode}</p>
                      <button 
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
                        onClick={() => setMapClickMode(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom overlay - only show when there's content */}
            {(journeyLegs.length > 0 || selectedStation) && !mapClickMode && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-start justify-end p-4">
                <div className="pointer-events-auto brut-card w-full max-w-xl border-2 border-[var(--border)] bg-[var(--card)]/95 p-4 backdrop-blur-sm">
                  {condensedLegs.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest">Your Journey</span>
                        <span className="text-xs text-[var(--muted-foreground)]">{condensedLegs.length} segment{condensedLegs.length > 1 ? 's' : ''}</span>
                      </div>
                      {condensedLegs.map((leg, idx) => {
                        const expanded = expandedLegs.includes(idx)
                        const scheduleOpen = openScheduleCode === leg.routeCode
                        const scheduleLine = scheduleOpen && !leg.isWalk ? findScheduleForRoute(leg.routeCode) : null
                        const badgeLabel = leg.isWalk
                          ? 'WALK'
                          : `${(leg.mode || 'TRANSIT').toUpperCase()}${leg.routeCode ? ` • ${leg.routeCode}` : ''}`
                        const readableText = getReadableTextColor(leg.color)
                        const toggleExpanded = () => {
                          setExpandedLegs((prev) => (prev.includes(idx) ? prev.filter((id) => id !== idx) : [...prev, idx]))
                          if (!lineStops[leg.routeCode] && !leg.isWalk) {
                            fetchLineStops(leg.routeCode)
                          }
                        }
                        const stopList = lineStops[leg.routeCode] || leg.stops

                        return (
                          <div key={`${leg.routeCode}-${idx}`} className="space-y-2 border-l-4 pl-3" style={{ borderColor: leg.color }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    className="cursor-pointer px-2 py-1 shadow-[var(--shadow-sm)]"
                                    style={{ background: leg.color, color: readableText, borderColor: leg.color }}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      if (leg.isWalk) return
                                      setOpenScheduleCode((prev) => (prev === leg.routeCode ? null : leg.routeCode))
                                    }}
                                    onKeyDown={(event) => {
                                        if (leg.isWalk) return
                                        if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        setOpenScheduleCode((prev) => (prev === leg.routeCode ? null : leg.routeCode))
                                      }
                                    }}
                                  >
                                    {badgeLabel}
                                  </Badge>
                                  <span className="font-bold text-sm">{leg.fromStop.name}</span>
                                  <span className="text-[var(--muted-foreground)]">→</span>
                                  <span className="font-bold text-sm">{leg.toStop.name}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                  <span>{leg.startTime || '—'} - {leg.endTime || '—'}</span>
                                  <span>•</span>
                                  <span>{Math.round(leg.duration / 60)} min</span>
                                  {leg.waitTime ? (
                                    <>
                                      <span>•</span>
                                      <span>Wait {Math.round(leg.waitTime / 60)} min</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              {!leg.isWalk && (
                                <div className="flex flex-col items-end gap-2">
                                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={toggleExpanded}>
                                    {expanded ? 'Hide stops' : 'View stops'}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {scheduleOpen && !leg.isWalk && (
                              <div className="brut-card border-2 border-[var(--border)] bg-[var(--card)] p-2 text-xs">
                                <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                                  <Clock size={14} />
                                  Closest schedule
                                </div>
                                {scheduleLine ? (
                                  <div className="mt-1 space-y-1">
                                    <p>First departure {scheduleLine.schedule?.first_departure || '—'} • Last {scheduleLine.schedule?.last_departure || '—'}</p>
                                    <p>Headway {scheduleLine.schedule?.frequency || '—'} • This trip at {leg.startTime || '—'}</p>
                                  </div>
                                ) : (
                                  <p className="mt-1">No schedule metadata found. Trip departs around {leg.startTime || '—'}.</p>
                                )}
                              </div>
                            )}

                            {expanded && !leg.isWalk && (
                              <div className="border border-dashed border-[var(--border)] bg-[var(--muted)]/60 p-2 text-xs">
                                <span className="font-bold uppercase tracking-wide text-[10px]">Stops</span>
                                {loadingStopsFor === leg.routeCode && (
                                  <div className="mt-2 text-[var(--muted-foreground)]">Loading stops…</div>
                                )}
                                {loadingStopsFor !== leg.routeCode && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {stopList.map((stop, stopIdx) => (
                                      <span key={`${stop.id}-${stopIdx}`} className="brut-card border-[var(--border)] bg-[var(--card)] px-2 py-1">{stop.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {selectedStation && (
                    <div className={`mt-4 border-t-2 border-[var(--border)] pt-4`}>
                      <div className="brut-card border-2 border-[var(--border)] bg-[var(--muted)]/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Station</div>
                            <div className="text-lg font-black leading-tight">{selectedStation.name}</div>
                            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                              {(selectedStation.lines || []).length ? (
                                (selectedStation.lines || []).map((line, idx) => (
                                  <span key={`${line}-${idx}`} className="brut-card border-[var(--border)] bg-[var(--card)] px-2 py-1">{line}</span>
                                ))
                              ) : (
                                <span className="text-[var(--muted-foreground)]">No listed routes</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-[var(--muted-foreground)]">
                            <div>Lat {selectedStation.lat.toFixed(5)}</div>
                            <div>Lon {selectedStation.lon.toFixed(5)}</div>
                          </div>
                        </div>

                        {selectedStation.lines && selectedStation.lines.length > 0 ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {selectedStation.lines.map((code, idx) => {
                              const meta = lines.find((l) => (l.id || '').toString().toUpperCase() === code.toUpperCase() || (l.name || '').toUpperCase() === code.toUpperCase())
                              return (
                                <div key={`${code}-${idx}`} className="brut-card border-[var(--border)] bg-[var(--card)] px-3 py-2">
                                  <div className="flex items-center justify-between text-sm font-bold">
                                    <span>{code}</span>
                                    <span className="text-xs uppercase text-[var(--muted-foreground)]">{(meta?.type || '').toUpperCase()}</span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                                    <div>First {meta?.schedule?.first_departure || '—'}</div>
                                    <div>Last {meta?.schedule?.last_departure || '—'}</div>
                                    <div>Headway {meta?.schedule?.frequency || '—'}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            className="px-3 py-2 text-xs"
                            onClick={() => {
                              setPlannerCoords((prev) => ({ ...prev, origin: selectedStation }))
                              setPlannerFields((prev) => ({ ...prev, origin: selectedStation.name }))
                              setFocusPoint({ lon: selectedStation.lon, lat: selectedStation.lat })
                            }}
                          >
                            Set as origin
                          </Button>
                          <Button
                            className="px-3 py-2 text-xs"
                            variant="muted"
                            onClick={() => {
                              setPlannerCoords((prev) => ({ ...prev, destination: selectedStation }))
                              setPlannerFields((prev) => ({ ...prev, destination: selectedStation.name }))
                              setFocusPoint({ lon: selectedStation.lon, lat: selectedStation.lat })
                            }}
                          >
                            Set as destination
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-3 py-2 text-xs"
                            onClick={() => setSelectedStation(null)}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {contextMenuState.open && (
              <div
                className="fixed z-50 min-w-[220px] border-2 border-[var(--border)] bg-[var(--card)] text-sm shadow-[var(--shadow-lg)]"
                style={{ left: contextMenuState.x, top: contextMenuState.y }}
                role="menu"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--muted)]"
                  onClick={() => setOriginFromCoords(contextMenuState.coords)}
                >
                  <MapPin size={16} /> Set origin here
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--muted)]"
                  onClick={() => setDestinationFromCoords(contextMenuState.coords)}
                >
                  <Navigation2 size={16} /> Set destination here
                </button>
                <div className="my-1 h-[1px] bg-[var(--border)]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--muted)]"
                  onClick={() => {
                    if (contextMenuState.coords) setFocusPoint({ lon: contextMenuState.coords.lon, lat: contextMenuState.coords.lat })
                    closeContextMenu()
                  }}
                >
                  <Crosshair size={16} /> Focus map here
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="w-full border-t-2 border-[var(--border)] bg-[var(--sidebar)] px-4 pb-6 pt-4 shadow-lg md:w-[420px] md:border-l-2 md:border-t-0 md:pb-6 md:pt-5">
          <Tabs defaultValue="planner">
            <TabsList>
              <TabsTrigger value="planner">Planner</TabsTrigger>
              <TabsTrigger value="layers">Layers</TabsTrigger>
              <TabsTrigger value="big-taxi">Big Taxi Routes</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            {fetchError && <div className="brut-card p-3 text-xs text-[var(--destructive)]">{fetchError}</div>}

            {loadingData ? (
              <div className="brut-card p-4 text-sm">Loading network snapshot…</div>
            ) : (
              <>
                <TabsContent value="planner">{plannerTab}</TabsContent>
                <TabsContent value="layers">{layersTab}</TabsContent>
                <TabsContent value="big-taxi">{bigTaxiTab}</TabsContent>
                <TabsContent value="alerts">{alertsTab}</TabsContent>
              </>
            )}
          </Tabs>
        </aside>
      </main>
    </div>
  )
}

export default App
