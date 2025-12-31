# Casablanca Transport Frontend — Brutalist UX/UI Design Doc

## Tone, Aesthetic, and Interaction Principles
- Brutalist, grid-first layout with sharp edges (radius 0), heavy outlines, strong shadow offsets (use existing CSS vars for shadow). Background mostly white/black with primary red accents and gold highlights for focus. Avoid gradients; rely on solid blocks and thick borders.
- Typography: `Space Mono` for UI, `IBM Plex Mono` for headings/labels. Uppercase for navigation and section labels. Tracking slightly wide. Body sizes 14–16px; headings 18–24px with bold weight.
- Motion: Minimal but intentional. Use hard slides/clip transitions for panels; fast (120–160ms) opacity/translate for toasts and popovers. No easing curves that feel soft; use linear or step-like easing.
- Components get thick borders (`--border`), inset shadows, and offset drop-shadows to emphasize depth. Hover states invert foreground/background or add a 1–2px translation to mimic physical movement.
- Accessibility: 4.5:1 contrast minimum; focus rings use `--ring` red outline plus offset shadow. Always provide keyboard access to map, lists, filters, and modals.

## Information Architecture (Pages)
1) **Live Map & Planner (Home)**
   - Full-viewport map with a persistent right rail for planner and layers.
   - Elements: Header bar (status + toggles), Map canvas, Right rail with Route Planner, Layers, Legend, Notifications/Alerts.
2) **Line Explorer**
   - Catalog of lines (bus, tram, busway, train) with filters. Detail panel shows line overview, stops list, and schedule snapshots.
3) **Stop Explorer**
   - Searchable stop directory with map context and nearby services. Designed for quick “What’s near me?” and “Next departures” flows.
4) **Itinerary Detail (Modal/Drawer)**
   - Deep view of a computed journey: leg-by-leg timeline, fare hints, transfer guidance, walking maps.
5) **Crowdsourced Grand Taxi Hub**
   - Submit routes/prices/stops. List of recent submissions with verification badge. Emphasize form clarity and location picking.
6) **System Status & Alerts**
   - Feed of disruptions, schedule changes, and backend health pings (latency/badge). Inline banners can appear in other pages.

## Global Layout
- **Top Bar (fixed, 48–56px)**: Brand block (CASA TRANSIT), system status light (green/yellow/red), global search (stops/lines), theme toggle, “My Journeys” shortcut, and compact user/menu.
- **Map Canvas (primary stage)**: Occupies remaining viewport. Map controls pinned top-left (zoom, locate me, reset view) and top-right (layers). Bottom-left mini-legend.
- **Right Rail (360–420px desktop; full-width slide-up on mobile)**: Tabs: Planner, Layers, Legend, Alerts. Uses accordion sections with thick dividers.
- **Mobile**: Header condenses; right rail becomes bottom sheet; map controls grow to 48px touch targets; lists become stacked cards.

## Page Specifications

### 1) Live Map & Planner
- **Header Bar**
  - Brand block with red background and white text; shows backend latency badge (<500ms green, >900ms yellow, >1200ms red).
  - Global search (stops/lines) with typeahead; keyboard focus opens results dropdown.
  - Theme toggle (light/dark) and “My Journeys” (recently computed itineraries stored client-side).
- **Map Canvas**
  - Layers: basemap, stops, lines (polylines), live viewport clusters, current route overlay, walking transfers (dotted black), geolocation marker.
  - Controls: Zoom in/out, recenter (uses browser geolocation), reset to city extent, measure tool (distance between two taps), snapshot (export PNG of map with legend overlay).
  - Interactions: Click stop → stop sheet; click line segment → line sheet; drag select (desktop) to zoom; long-press (mobile) to drop origin/destination.
- **Right Rail Tabs**
  - **Planner**
    - Origin/Destination inputs with swap button; mode chips (auto multimodal default, or filter to bus/tram/train/walk-heavy).
    - Departure time picker (now vs. plan later). Day type toggle (weekday/sat/sun) to mirror RAPTOR service IDs.
    - “Compute Route” CTA in red; shows spinner + latency badge. Errors shown inline with retry.
    - After computation: show journey summary card (duration, transfers count, price hint if available), then leg stack.
  - **Layers**
    - Toggles for buses, tram, busway, train, taxi submissions, walking transfers, clusters. Sliders for stop density radius.
    - Heatmap toggle for stop density (uses `GetStops` viewport data).
  - **Legend**
    - Color chips for each mode; line styles (solid vs dotted for walk); icon cheatsheet.
  - **Alerts**
    - Inline list of disruptions. Each alert has severity color bar (red/yellow), time, and affected lines.

### 2) Line Explorer
- **Filters**: Mode pills (bus/tram/busway/train), operator, search by code/name, service span (start-end), price range.
- **List/Grid**: Brutalist cards with line code, name, mode icon, origin → destination. Hover lifts by 2px, adds thicker shadow.
- **Detail Drawer/Modal**
  - Overview: Line color strip, operator, price, typical headway, first/last trip times.
  - Stops: Ordered list with sequence numbers; click a stop to pan map and highlight segment.
  - Schedules: Next departures per stop (condensed); “View full schedule” opens nested panel.
  - Actions: “Show on map” overlays entire polyline and stops; “Plan from/to here”.

### 3) Stop Explorer
- **Search & Nearby**: Input with “use my location”; fallback list of featured hubs. Debounced search hits `/stops` with viewport and query.
- **Stop Card**: Name, code, modes served, distance from user, next departures (top 3), buttons: “Set as origin”, “Set as destination”.
- **Stop Drawer**: Map highlight with 300m walk radius, connected lines, departures grouped by line, accessibility flags.

### 4) Itinerary Detail (Modal/Drawer)
- **Hero Summary**: Total time, in-vehicle time, walk time, transfers count, price estimate.
- **Leg Stack**: Each leg has mode badge, line code/color, from→to, times, dwell/wait time, and a mini-line diagram with stops passed.
- **Transfers**: Show walking duration and a micro-map inset with dotted path.
- **Actions**: “Share link”, “Pin journey”, “Reverse trip”, “Adjust departure”.
- **Edge Cases**: No route found → stark bordered card with suggestions (expand search radius, change time/day).

### 5) Crowdsourced Grand Taxi Hub
- **Submission Forms** (three tabs): New Route, Price update, Stop submission.
  - Uses map picker for origin/destination/stop; numeric price with MAD suffix; optional notes.
  - Validation with hard, clear errors; submit button red; success state shows a stamped confirmation.
- **Feed**: Table/cards of recent submissions with verification badge; sort by newest/price. Filter by corridor.
- **Map Overlay**: Taxi submissions layer togglable in Layers tab; unverified items striped; verified solid.

### 6) System Status & Alerts
- **Status Panel**: Backend latency, last data sync time, RAPTOR data version, DB health. Use red/yellow/green lozenges.
- **Alerts Feed**: Dismissible items with timestamps. Persistent critical alerts float as a bar over the map.

## Component Library (Shadcn, Brutalist Skins)
- **Shell/Layout**: Header, RightRail, BottomSheet (mobile), SplitPane.
- **Navigation**: Tabs (square, thick border), Accordion (outline only), Breadcrumb (monospace, arrows as `→`).
- **Inputs**: TextField, ComboBox, Date/Time Picker, Chip toggles, Switch (square), Slider (blocky handle), File drop (for future GTFS import admin).
- **Data**: Card (with offset shadow), Table (thick borders, zebra stripes muted), Badge (solid or outline), Tag pills for modes.
- **Feedback**: Toast (bottom-left, slide-in), Banner (full width, red/yellow), Skeleton (rectangular, striped), Spinner (square stepping dots).
- **Map Widgets**: ControlButton, LegendBlock, MiniCard tooltip for stops/lines, MeasureTool overlay, Snapshot overlay.
- **Journey-Specific**: JourneySummary, LegItem, TransferItem, FareHint chip, HeadwayPill, AlertChip.

## Data & API Contract (frontend expectations)
- **Lines** (`GET /lines`): Used for Line Explorer list, map overlays, and legend color mapping. Expect `id`, `code`, `name`, `type`, `color`, `origin`, `destination`, `stop_count`.
- **Line Details** (`GET /lines/{id}`): Provides `line` plus `stops` array with sequence; used for detail drawer and map highlight.
- **Stops Viewport** (`GET /stops?min_lat&min_lon&max_lat&max_lon`): Drives map clusters, nearby lists, and heatmap. Expect `id`, `code`, `name`, `lat`, `lon`, `type`.
- **Route Planning** (`GET /route?from_lat&from_lon&to_lat&to_lon`): Returns `Journey` with `legs[]` where each leg has `type`, `from_stop`, `to_stop`, `start_time`, `end_time`, `duration`, `route_code`, `route_color`, `wait_time`. Frontend shows summary + leg stack, maps legs, and computes totals.
- **Taxi Crowdsourcing** (per migrations): endpoints for taxi routes, price submissions, taxi stops (assumed REST). Forms should post JSON with origin/destination names and coords, price, and notes.

## Interaction & State Model
- **Global State**: theme (light/dark), geolocation permission/state, active journey, pinned stops, active layers, alerts cache.
- **Planner State**: origin/destination (lat/lon + label), departure time, day type, mode filter, last response (journey + latency), error state.
- **Line Explorer State**: filters, selected line, line detail cache, selected stop in line.
- **Stop Explorer State**: query, nearby list, selected stop, departures cache.
- **Taxi Hub State**: active tab, form data, submission status, filter for feed.
- **Status State**: backend latency, RAPTOR version, alert feed.

## Responsive & Layout Rules
- Desktop ≥1024px: Right rail visible; map and rail split. Hover tooltips active.
- Tablet 768–1023px: Right rail collapses to a toggle; bottom sheet for detail drawers; controls enlarge to 44–48px.
- Mobile <768px: Header compresses; primary actions stack; map controls bottom-left; planner in bottom sheet; cards become full-bleed.

## Visual Language Details (use existing CSS vars)
- Colors: Primary red (`--primary`), gold accent (`--accent`), grayscale for surfaces (`--card`, `--muted`). Borders black/white per theme.
- Shadows: Use `--shadow-sm` on interactive controls by default; elevate to `--shadow-md/lg` on hover/active. Offset shadows stay consistent (3px x/y).
- Spacing: Base `--spacing` 0.25rem. Compose in 1x/2x/3x multiples for rhythm.
- Radius: 0 across; keep edges sharp.

## Empty, Error, and Loading States
- **Loading**: Skeleton bars for lists/cards; map shows a striped placeholder overlay while fetching route/stops.
- **Empty**: Bordered box with bold uppercase label (“NO ROUTE FOUND”, “NO STOPS IN VIEW”). Provide one-line suggestion.
- **Error**: Red outline cards with clear message and retry. Network errors show latency badge turning yellow/red.

## Accessibility
- Keyboard: Tab order through header → planner → map controls → lists. Space/Enter activates controls. Esc closes drawers/modals.
- Focus: 2px red ring + 3px offset shadow. Ensure visible on dark/light.
- Screen readers: Landmarks for header/nav/main/aside. ARIA labels on map controls, inputs, and tabs. Leg items announce mode, line, times, and transfer instructions.

## Copy Tone & Microcopy
- Direct, uppercase labels for nav and section headers. Buttons: “COMPUTE ROUTE”, “SET ORIGIN”, “REPORT PRICE”. Errors concise: “No route found. Expand search radius.”

## Future Enhancements (non-blocking)
- Offline cache for last-known lines/stops.
- Real-time vehicle positions layer (if available) with ghost trails.
- Saved places (home/work) shortcuts in planner.
- Compare journeys (stack two results side-by-side on desktop).
