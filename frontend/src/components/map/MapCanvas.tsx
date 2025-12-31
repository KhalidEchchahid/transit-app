import { useEffect, useRef, useCallback } from 'react'
import maplibregl, { type Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Station = {
    id: number | string
    name: string
    lat: number
    lon: number
    lines?: string[]
    type?: string
}

type MapCanvasProps = {
    stations: Station[]
    theme: 'light' | 'dark'
    onSelectStation?: (station: Station) => void
    onViewportChange?: (bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }) => void
    onMapClick?: (coords: { lat: number; lon: number }) => void
    onContextMenuRequest?: (payload: { lat: number; lon: number; screenX: number; screenY: number }) => void
    mapClickMode?: 'origin' | 'destination' | null
    lineGeometries?: Array<{ id: string | number; color: string; coordinates: [number, number][] }>
    focusPoint?: { lon: number; lat: number }
    journeyLineStops?: Record<string, Station[]>
    selectedPoints?: { origin?: Station; destination?: Station }
    journeyLegs?: Array<{
        type?: string
        fromStop: Station
        toStop: Station
        routeCode?: string
        routeColor?: string
        startTime?: string
        endTime?: string
        duration?: number
        stops?: Station[]
        geometry?: [number, number][]
    }>
}

const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const DEFAULT_CENTER: [number, number] = [-7.6175, 33.5928]
const DEFAULT_ZOOM = 12

function MapCanvas({ stations, theme, onSelectStation, onViewportChange, onMapClick, onContextMenuRequest, mapClickMode, lineGeometries = [], focusPoint, journeyLegs = [], journeyLineStops = {}, selectedPoints = {} }: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<Map | null>(null)
    const isMapReady = useRef(false)

    // Store props in refs to avoid stale closures
    const stationsRef = useRef(stations)
    const lineGeometriesRef = useRef(lineGeometries)
    const journeyLegsRef = useRef(journeyLegs)
    const onSelectStationRef = useRef(onSelectStation)
    const onViewportChangeRef = useRef(onViewportChange)
    const onMapClickRef = useRef(onMapClick)
    const onContextMenuRequestRef = useRef(onContextMenuRequest)
    const mapClickModeRef = useRef(mapClickMode)
    const themeRef = useRef(theme)
    const journeyLineStopsRef = useRef(journeyLineStops)
    const selectedPointsRef = useRef(selectedPoints || {})
    const ctrlPressedRef = useRef(false)

    stationsRef.current = stations
    lineGeometriesRef.current = lineGeometries
    journeyLegsRef.current = journeyLegs
    journeyLineStopsRef.current = journeyLineStops
    selectedPointsRef.current = selectedPoints || {}
    onSelectStationRef.current = onSelectStation
    onViewportChangeRef.current = onViewportChange
    onMapClickRef.current = onMapClick
    onContextMenuRequestRef.current = onContextMenuRequest
    mapClickModeRef.current = mapClickMode
    themeRef.current = theme

    const setupLayers = useCallback((map: Map, isDark: boolean) => {
        // Add sources if they don't exist
        if (!map.getSource('lines')) {
            map.addSource('lines', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }

        if (!map.getSource('stations')) {
            map.addSource('stations', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }

        if (!map.getSource('journey-route')) {
            map.addSource('journey-route', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }

        if (!map.getSource('journey-points')) {
            map.addSource('journey-points', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }

        if (!map.getSource('selection-points')) {
            map.addSource('selection-points', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })
        }

        // Add layers if they don't exist - brutalist solid lines for transit network
        if (!map.getLayer('line-paths')) {
            map.addLayer({
                id: 'line-paths',
                type: 'line',
                source: 'lines',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 3,
                    'line-opacity': 0.4,
                },
                layout: {
                    'line-cap': 'square',
                    'line-join': 'miter',
                },
            })
        }

        // Brutalist journey outline - thick black border
        if (!map.getLayer('journey-outline')) {
            map.addLayer({
                id: 'journey-outline',
                type: 'line',
                source: 'journey-route',
                paint: {
                    'line-color': '#000000',
                    'line-width': 10,
                    'line-opacity': 1,
                },
                layout: {
                    'line-cap': 'square',
                    'line-join': 'miter',
                },
            })
        }

        // Main journey line - solid thick colored lines per leg
        if (!map.getLayer('journey-line')) {
            map.addLayer({
                id: 'journey-line',
                type: 'line',
                source: 'journey-route',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 6,
                    'line-opacity': 1,
                },
                layout: {
                    'line-cap': 'square',
                    'line-join': 'miter',
                },
            })
        }

        // Walk legs - dotted pattern overlay
        if (!map.getLayer('journey-walk')) {
            map.addLayer({
                id: 'journey-walk',
                type: 'line',
                source: 'journey-route',
                filter: ['==', ['get', 'isWalk'], true],
                paint: {
                    'line-color': '#000000',
                    'line-width': 3,
                    'line-dasharray': [2, 2],
                    'line-opacity': 0.8,
                },
                layout: {
                    'line-cap': 'square',
                    'line-join': 'miter',
                },
            })
        }

        // Brutalist station markers - AFTER journey lines so visible
        if (!map.getLayer('station-circles')) {
            map.addLayer({
                id: 'station-circles',
                type: 'circle',
                source: 'stations',
                paint: {
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        10, 5,
                        14, 8,
                        18, 12
                    ],
                    'circle-color': isDark ? '#000000' : '#ffffff',
                    'circle-stroke-color': isDark ? '#ffffff' : '#000000',
                    'circle-stroke-width': 3,
                },
            })
        }

        // Inner accent dot
        if (!map.getLayer('station-inner')) {
            map.addLayer({
                id: 'station-inner',
                type: 'circle',
                source: 'stations',
                paint: {
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        10, 2,
                        14, 4,
                        18, 6
                    ],
                    'circle-color': '#ff0000',
                },
            })
        }

        // Journey stop points - brutalist squares (on top of everything)
        if (!map.getLayer('journey-points')) {
            map.addLayer({
                id: 'journey-points',
                type: 'circle',
                source: 'journey-points',
                paint: {
                    'circle-radius': [
                        'match', ['get', 'kind'],
                        'start', 12,
                        'end', 12,
                        'inline-stop', 6,
                        8,
                    ],
                    'circle-color': [
                        'case',
                        ['==', ['get', 'kind'], 'inline-stop'], ['coalesce', ['get', 'color'], '#ffffff'],
                        ['==', ['get', 'kind'], 'start'], '#00ff00',
                        ['==', ['get', 'kind'], 'end'], '#ff0000',
                        '#ffffff',
                    ],
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 2,
                },
            })
        }

        if (!map.getLayer('station-labels')) {
            map.addLayer({
                id: 'station-labels',
                type: 'symbol',
                source: 'stations',
                minzoom: 13,
                layout: {
                    'text-field': ['get', 'name'],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        13, 9,
                        16, 12
                    ],
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-max-width': 10,
                    'text-transform': 'uppercase',
                    'text-letter-spacing': 0.05,
                },
                paint: {
                    'text-color': isDark ? '#ffffff' : '#000000',
                    'text-halo-color': isDark ? '#000000' : '#ffffff',
                    'text-halo-width': 2,
                },
            })
        }

        if (!map.getLayer('selection-pins')) {
            map.addLayer({
                id: 'selection-pins',
                type: 'circle',
                source: 'selection-points',
                paint: {
                    'circle-radius': [
                        'match', ['get', 'kind'],
                        'origin', 10,
                        'destination', 10,
                        8,
                    ],
                    'circle-color': [
                        'match', ['get', 'kind'],
                        'origin', '#16a34a',
                        'destination', '#2563eb',
                        '#111827',
                    ],
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 3,
                },
            })
        }

        if (!map.getLayer('selection-labels')) {
            map.addLayer({
                id: 'selection-labels',
                type: 'symbol',
                source: 'selection-points',
                minzoom: 11,
                layout: {
                    'text-field': ['get', 'label'],
                    'text-size': 11,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-transform': 'uppercase',
                },
                paint: {
                    'text-color': isDark ? '#ffffff' : '#000000',
                    'text-halo-color': isDark ? '#000000' : '#ffffff',
                    'text-halo-width': 2,
                },
            })
        }
    }, [])

    const updateStations = useCallback(() => {
        const map = mapRef.current
        if (!map || !isMapReady.current) return

        const source = map.getSource('stations') as maplibregl.GeoJSONSource | undefined
        if (!source) return

        const allStations = stationsRef.current
        source.setData({
            type: 'FeatureCollection',
            features: allStations.map((stop) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [stop.lon, stop.lat],
                },
                properties: {
                    id: stop.id,
                    name: stop.name,
                    lines: (stop.lines || []).join(', '),
                },
            })),
        })
    }, [])

    const updateLines = useCallback(() => {
        const map = mapRef.current
        if (!map || !isMapReady.current) return

        const source = map.getSource('lines') as maplibregl.GeoJSONSource | undefined
        if (!source) return

        source.setData({
            type: 'FeatureCollection',
            features: lineGeometriesRef.current.map((line) => ({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: line.coordinates,
                },
                properties: {
                    id: line.id,
                    color: line.color,
                },
            })),
        })
    }, [])

    const updateJourney = useCallback(() => {
        const map = mapRef.current
        if (!map || !isMapReady.current) return

        const legs = journeyLegsRef.current || []
        const lineSource = map.getSource('journey-route') as maplibregl.GeoJSONSource | undefined
        const pointSource = map.getSource('journey-points') as maplibregl.GeoJSONSource | undefined
        if (!lineSource || !pointSource) return

        if (legs.length === 0) {
            lineSource.setData({ type: 'FeatureCollection', features: [] })
            pointSource.setData({ type: 'FeatureCollection', features: [] })
            return
        }

        // Create individual line features per leg with their own colors
        const lineFeatures = legs.map((leg, idx) => {
            const normalizedType = (leg.type || '').toString().toLowerCase()
            const isWalk = normalizedType === 'walk' || (leg.routeCode || '').toString().toUpperCase() === 'WALK'
            const color = isWalk ? '#000000' : (leg.routeColor || '#d6452f')

            const coords = leg.geometry && leg.geometry.length >= 2
                ? leg.geometry
                : [
                    [leg.fromStop.lon, leg.fromStop.lat],
                    [leg.toStop.lon, leg.toStop.lat],
                  ]

            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: coords,
                },
                properties: {
                    id: idx,
                    color: color,
                    isWalk: isWalk,
                    routeCode: leg.routeCode || '',
                },
            }
        })

        lineSource.setData({
            type: 'FeatureCollection',
            features: lineFeatures,
        })

        // Create point features for start, end, intermediate stops, and inline line stop markers
        const pointFeatures: Array<{
            type: 'Feature'
            geometry: { type: 'Point'; coordinates: [number, number] }
            properties: { kind: string; name: string; color?: string; id?: string | number; lat?: number; lon?: number }
        }> = []

        // Start point
        const firstLeg = legs[0]
        if (firstLeg) {
            pointFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [firstLeg.fromStop.lon, firstLeg.fromStop.lat] },
                properties: { kind: 'start', name: firstLeg.fromStop.name, id: firstLeg.fromStop.id, lat: firstLeg.fromStop.lat, lon: firstLeg.fromStop.lon },
            })
        }

        // Intermediate stops (transfer points)
        for (let i = 0; i < legs.length - 1; i++) {
            const leg = legs[i]
            pointFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [leg.toStop.lon, leg.toStop.lat] },
                properties: { kind: 'transfer', name: leg.toStop.name, id: leg.toStop.id, lat: leg.toStop.lat, lon: leg.toStop.lon },
            })

            const inlineStops = (leg.stops && leg.stops.length > 0)
                ? leg.stops
                : (journeyLineStopsRef.current[leg.routeCode || ''] || [])

            inlineStops.forEach((stop) => {
                pointFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
                    properties: { kind: 'inline-stop', name: stop.name, color: leg.routeColor || '#000000', id: stop.id, lat: stop.lat, lon: stop.lon },
                })
            })
        }

        // Inline stops for last leg, if any
        if (legs.length > 0) {
            const last = legs[legs.length - 1]
            const lastLegStops = (last.stops && last.stops.length > 0)
                ? last.stops
                : (journeyLineStopsRef.current[last.routeCode || ''] || [])
            lastLegStops.forEach((stop) => {
                pointFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
                    properties: { kind: 'inline-stop', name: stop.name, color: last.routeColor || '#000000', id: stop.id, lat: stop.lat, lon: stop.lon },
                })
            })
        }

        // End point
        const lastLeg = legs[legs.length - 1]
        if (lastLeg) {
            pointFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lastLeg.toStop.lon, lastLeg.toStop.lat] },
                properties: { kind: 'end', name: lastLeg.toStop.name, id: lastLeg.toStop.id, lat: lastLeg.toStop.lat, lon: lastLeg.toStop.lon },
            })
        }

        pointSource.setData({
            type: 'FeatureCollection',
            features: pointFeatures,
        })

        // Fit bounds to show entire journey
        const allCoords: [number, number][] = []
        legs.forEach((leg) => {
            if (leg.geometry && leg.geometry.length > 0) {
                allCoords.push(...leg.geometry)
            } else {
                allCoords.push([leg.fromStop.lon, leg.fromStop.lat])
                allCoords.push([leg.toStop.lon, leg.toStop.lat])
            }
        })

        if (allCoords.length >= 2) {
            const lons = allCoords.map((c) => c[0])
            const lats = allCoords.map((c) => c[1])
            const minLon = Math.min(...lons)
            const maxLon = Math.max(...lons)
            const minLat = Math.min(...lats)
            const maxLat = Math.max(...lats)
            map.fitBounds(
                [
                    [minLon, minLat],
                    [maxLon, maxLat],
                ],
                { padding: 80, duration: 600 },
            )
        }
    }, [])

    const updateSelectionPoints = useCallback(() => {
        const map = mapRef.current
        if (!map || !isMapReady.current) return

        const source = map.getSource('selection-points') as maplibregl.GeoJSONSource | undefined
        if (!source) return

        const features: Array<{
            type: 'Feature'
            geometry: { type: 'Point'; coordinates: [number, number] }
            properties: { kind: string; label: string }
        }> = []

        const { origin, destination } = selectedPointsRef.current
        if (origin) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [origin.lon, origin.lat] },
                properties: { kind: 'origin', label: 'Origin' },
            })
        }

        if (destination) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [destination.lon, destination.lat] },
                properties: { kind: 'destination', label: 'Destination' },
            })
        }

        source.setData({
            type: 'FeatureCollection',
            features,
        })
    }, [])

    // Initialize map ONCE - no dependencies that change!
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return

        const isDark = themeRef.current === 'dark'

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            attributionControl: { compact: true },
        })

        mapRef.current = map

        map.addControl(new maplibregl.NavigationControl({ showZoom: true }), 'top-left')
        map.addControl(
            new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showAccuracyCircle: false,
                fitBoundsOptions: { maxZoom: 15 },
            }),
            'top-left',
        )

        map.on('load', () => {
            isMapReady.current = true

            // Setup layers inline to avoid stale closure issues
            if (!map.getSource('lines')) {
                map.addSource('lines', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                })
            }

            if (!map.getSource('stations')) {
                map.addSource('stations', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                })
            }

            if (!map.getSource('journey-route')) {
                map.addSource('journey-route', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                })
            }

            if (!map.getSource('journey-points')) {
                map.addSource('journey-points', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                })
            }

            if (!map.getSource('selection-points')) {
                map.addSource('selection-points', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                })
            }

            if (!map.getLayer('line-paths')) {
                map.addLayer({
                    id: 'line-paths',
                    type: 'line',
                    source: 'lines',
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 3,
                        'line-opacity': 0.4,
                    },
                    layout: {
                        'line-cap': 'square',
                        'line-join': 'miter',
                    },
                })
            }

            // Brutalist journey outline - thick black border
            if (!map.getLayer('journey-outline')) {
                map.addLayer({
                    id: 'journey-outline',
                    type: 'line',
                    source: 'journey-route',
                    paint: {
                        'line-color': '#000000',
                        'line-width': 10,
                        'line-opacity': 1,
                    },
                    layout: {
                        'line-cap': 'square',
                        'line-join': 'miter',
                    },
                })
            }

            // Main journey line - solid thick colored lines per leg
            if (!map.getLayer('journey-line')) {
                map.addLayer({
                    id: 'journey-line',
                    type: 'line',
                    source: 'journey-route',
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 6,
                        'line-opacity': 1,
                    },
                    layout: {
                        'line-cap': 'square',
                        'line-join': 'miter',
                    },
                })
            }

            // Walk legs - dotted pattern overlay
            if (!map.getLayer('journey-walk')) {
                map.addLayer({
                    id: 'journey-walk',
                    type: 'line',
                    source: 'journey-route',
                    filter: ['==', ['get', 'isWalk'], true],
                    paint: {
                        'line-color': '#000000',
                        'line-width': 3,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.8,
                    },
                    layout: {
                        'line-cap': 'square',
                        'line-join': 'miter',
                    },
                })
            }

            // Brutalist square station markers - added AFTER journey lines so visible
            if (!map.getLayer('station-circles')) {
                map.addLayer({
                    id: 'station-circles',
                    type: 'circle',
                    source: 'stations',
                    paint: {
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 5,
                            14, 8,
                            18, 12
                        ],
                        'circle-color': isDark ? '#000000' : '#ffffff',
                        'circle-stroke-color': isDark ? '#ffffff' : '#000000',
                        'circle-stroke-width': 3,
                    },
                })
            }

            // Inner accent dot
            if (!map.getLayer('station-inner')) {
                map.addLayer({
                    id: 'station-inner',
                    type: 'circle',
                    source: 'stations',
                    paint: {
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 2,
                            14, 4,
                            18, 6
                        ],
                        'circle-color': '#ff0000',
                    },
                })
            }

            // Journey stop points - brutalist markers (on top of everything)
            if (!map.getLayer('journey-points')) {
                map.addLayer({
                    id: 'journey-points',
                    type: 'circle',
                    source: 'journey-points',
                    paint: {
                        'circle-radius': [
                            'match', ['get', 'kind'],
                            'start', 12,
                            'end', 12,
                            8,
                        ],
                        'circle-color': [
                            'match', ['get', 'kind'],
                            'start', '#00ff00',
                            'end', '#ff0000',
                            '#ffffff',
                        ],
                        'circle-stroke-color': '#000000',
                        'circle-stroke-width': 3,
                    },
                })
            }

            if (!map.getLayer('selection-pins')) {
                map.addLayer({
                    id: 'selection-pins',
                    type: 'circle',
                    source: 'selection-points',
                    paint: {
                        'circle-radius': [
                            'match', ['get', 'kind'],
                            'origin', 10,
                            'destination', 10,
                            8,
                        ],
                        'circle-color': [
                            'match', ['get', 'kind'],
                            'origin', '#16a34a',
                            'destination', '#2563eb',
                            '#111827',
                        ],
                        'circle-stroke-color': '#000000',
                        'circle-stroke-width': 3,
                    },
                })
            }

            if (!map.getLayer('selection-labels')) {
                map.addLayer({
                    id: 'selection-labels',
                    type: 'symbol',
                    source: 'selection-points',
                    minzoom: 11,
                    layout: {
                        'text-field': ['get', 'label'],
                        'text-size': 11,
                        'text-offset': [0, 1.2],
                        'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-transform': 'uppercase',
                    },
                    paint: {
                        'text-color': isDark ? '#ffffff' : '#000000',
                        'text-halo-color': isDark ? '#000000' : '#ffffff',
                        'text-halo-width': 2,
                    },
                })
            }

            if (!map.getLayer('station-labels')) {
                map.addLayer({
                    id: 'station-labels',
                    type: 'symbol',
                    source: 'stations',
                    minzoom: 13,
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': [
                            'interpolate', ['linear'], ['zoom'],
                            13, 9,
                            16, 12
                        ],
                        'text-offset': [0, 1.2],
                        'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-max-width': 10,
                        'text-transform': 'uppercase',
                        'text-letter-spacing': 0.05,
                    },
                    paint: {
                        'text-color': isDark ? '#ffffff' : '#000000',
                        'text-halo-color': isDark ? '#000000' : '#ffffff',
                        'text-halo-width': 2,
                    },
                })
            }

            // Initial viewport notification
            if (onViewportChangeRef.current) {
                const bounds = map.getBounds()
                onViewportChangeRef.current({
                    minLat: bounds.getSouth(),
                    minLon: bounds.getWest(),
                    maxLat: bounds.getNorth(),
                    maxLon: bounds.getEast(),
                })
            }

            // Load any stations that were fetched before map was ready
            const stationsSource = map.getSource('stations') as maplibregl.GeoJSONSource | undefined
            if (stationsSource && stationsRef.current.length > 0) {
                stationsSource.setData({
                    type: 'FeatureCollection',
                    features: stationsRef.current.map((stop) => ({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [stop.lon, stop.lat],
                        },
                        properties: {
                            id: stop.id,
                            name: stop.name,
                            lines: (stop.lines || []).join(', '),
                        },
                    })),
                })
            }

            updateSelectionPoints()
        })

        // Debounced viewport change notification - only on moveend
        let moveTimeout: ReturnType<typeof setTimeout> | null = null
        const handleMoveEnd = () => {
            if (moveTimeout) clearTimeout(moveTimeout)
            moveTimeout = setTimeout(() => {
                if (onViewportChangeRef.current && mapRef.current) {
                    const bounds = mapRef.current.getBounds()
                    onViewportChangeRef.current({
                        minLat: bounds.getSouth(),
                        minLon: bounds.getWest(),
                        maxLat: bounds.getNorth(),
                        maxLon: bounds.getEast(),
                    })
                }
            }, 200)
        }

        map.on('moveend', handleMoveEnd)

        map.on('click', 'station-circles', (event) => {
            // If in click mode, let the general click handler manage it
            if (mapClickModeRef.current) return

            const feature = event.features?.[0]
            if (!feature) return
            const id = feature.properties?.id
            const target = stationsRef.current.find((stop) => String(stop.id) === String(id))
            if (!target) return

            if (onSelectStationRef.current) {
                onSelectStationRef.current(target)
            }
        })

        map.on('click', 'journey-points', (event) => {
            if (mapClickModeRef.current) return

            const feature = event.features?.[0]
            if (!feature) return
            const props = feature.properties as any

            const lookupById = (id: string | number | undefined) => {
                if (id === undefined || id === null) return undefined
                const strId = String(id)
                // search journey line stops
                for (const key of Object.keys(journeyLineStopsRef.current || {})) {
                    const list = journeyLineStopsRef.current[key] || []
                    const found = list.find((s) => String(s.id) === strId)
                    if (found) return found
                }
                // search journey legs
                for (const leg of journeyLegsRef.current || []) {
                    if (String(leg.fromStop.id) === strId) return leg.fromStop
                    if (String(leg.toStop.id) === strId) return leg.toStop
                    const s = (leg.stops || []).find((stop) => String(stop.id) === strId)
                    if (s) return s
                }
                // fallback to global stations
                return stationsRef.current.find((s) => String(s.id) === strId)
            }

            const id = props?.id as string | number | undefined
            const fromLookup = lookupById(id)

            const fallback = () => ({
                id: id || `journey-${feature.id || 'point'}`,
                name: props?.name || 'Stop',
                lat: props?.lat ?? feature.geometry?.coordinates?.[1],
                lon: props?.lon ?? feature.geometry?.coordinates?.[0],
                lines: [],
                type: 'journey',
            })

            const station = fromLookup || fallback()
            if (onSelectStationRef.current) {
                onSelectStationRef.current(station as Station)
            }
        })

        // General map click for custom location selection
        map.on('click', (event) => {
            if (!mapClickModeRef.current || !onMapClickRef.current) return

            const { lng, lat } = event.lngLat
            onMapClickRef.current({ lat, lon: lng })
        })

        map.on('contextmenu', (event) => {
            const original = event.originalEvent as MouseEvent | undefined
            const ctrlPressed = !!original?.ctrlKey || ctrlPressedRef.current

            // Only show the custom menu when holding Ctrl to avoid interfering with normal clicks
            if (!ctrlPressed) return

            event.preventDefault()
            if (!onContextMenuRequestRef.current) return

            const { lng, lat } = event.lngLat
            const rect = containerRef.current?.getBoundingClientRect()
            const screenX = rect ? rect.left + event.point.x : event.point.x
            const screenY = rect ? rect.top + event.point.y : event.point.y

            onContextMenuRequestRef.current({ lat, lon: lng, screenX, screenY })
        })

        // Change cursor on hover
        map.on('mouseenter', 'station-circles', () => {
            if (!mapClickModeRef.current) {
                map.getCanvas().style.cursor = 'pointer'
            }
        })
        map.on('mouseleave', 'station-circles', () => {
            if (!mapClickModeRef.current) {
                map.getCanvas().style.cursor = ''
            }
        })

        return () => {
            if (moveTimeout) clearTimeout(moveTimeout)
            map.remove()
            mapRef.current = null
            isMapReady.current = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty deps - map is created ONCE

    // Update stations when data changes
    useEffect(() => {
        updateStations()
    }, [stations, updateStations])

    // Update lines when data changes
    useEffect(() => {
        updateLines()
    }, [lineGeometries, updateLines])

    // Update journey overlay when legs change
    useEffect(() => {
        updateJourney()
    }, [updateJourney, journeyLegs])

    useEffect(() => {
        updateSelectionPoints()
    }, [selectedPoints, updateSelectionPoints])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !ctrlPressedRef.current) {
                ctrlPressedRef.current = true
                mapRef.current?.dragPan.disable()
            }
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            if (!event.ctrlKey && !event.metaKey && ctrlPressedRef.current) {
                ctrlPressedRef.current = false
                mapRef.current?.dragPan.enable()
            }
        }

        const handleBlur = () => {
            if (ctrlPressedRef.current) {
                ctrlPressedRef.current = false
                mapRef.current?.dragPan.enable()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        window.addEventListener('blur', handleBlur)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('blur', handleBlur)
        }
    }, [])

    // Handle focus point changes
    useEffect(() => {
        if (!mapRef.current || !focusPoint || !isMapReady.current) return
        mapRef.current.flyTo({
            center: [focusPoint.lon, focusPoint.lat],
            zoom: Math.max(mapRef.current.getZoom(), 14),
            speed: 1.2,
        })
    }, [focusPoint])

    // Handle theme changes - reload style
    const prevThemeRef = useRef(theme)
    useEffect(() => {
        if (prevThemeRef.current === theme) return
        prevThemeRef.current = theme

        const map = mapRef.current
        if (!map) return

        const isDark = theme === 'dark'
        const newStyle = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

        isMapReady.current = false
        map.setStyle(newStyle)

        map.once('style.load', () => {
            isMapReady.current = true
            setupLayers(map, isDark)
            updateStations()
            updateLines()
            updateJourney()
            updateSelectionPoints()
        })
    }, [theme, setupLayers, updateStations, updateLines, updateJourney, updateSelectionPoints])

    // Handle map click mode cursor change
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        if (mapClickMode) {
            map.getCanvas().style.cursor = 'crosshair'
        } else {
            map.getCanvas().style.cursor = ''
        }
    }, [mapClickMode])

    return (
        <div className="map-wrapper h-full w-full" aria-label="Interactive transit map">
            <div ref={containerRef} className="h-full w-full" />
        </div>
    )
}

export default MapCanvas
