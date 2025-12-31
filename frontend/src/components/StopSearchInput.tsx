import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Station = {
  id: number | string
  name: string
  lat: number
  lon: number
  lines: string[]
  type?: string
}

type StopSearchInputProps = {
  label: string
  placeholder?: string
  value: string
  stops: Station[]
  onSelect: (station: Station) => void
  onChange?: (value: string) => void
  onPickFromMap?: () => void
}

export function StopSearchInput({ label, placeholder, value, stops, onSelect, onChange, onPickFromMap }: StopSearchInputProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Station[]>([])
  const [justSelected, setJustSelected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Deduplicate stops by name (case-insensitive)
  const deduplicatedStops = useMemo(() => {
    const seen = new Map<string, Station>()
    stops.forEach((stop) => {
      const key = stop.name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.set(key, stop)
      }
    })
    return Array.from(seen.values())
  }, [stops])

  useEffect(() => {
    setQuery(value)
    setJustSelected(true) // Mark that value was set externally
  }, [value])

  useEffect(() => {
    // Don't search if empty or just selected a station
    if (!query.trim()) {
      setResults([])
      return
    }
    // If just selected, clear flag and don't search yet
    if (justSelected) {
      setJustSelected(false)
      setResults([])
      return
    }
    const term = query.toLowerCase()
    const matches = deduplicatedStops
      .filter((s) => s.name.toLowerCase().includes(term))
      .slice(0, 8)
    setResults(matches)
  }, [query, deduplicatedStops, justSelected])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (station: Station) => {
    setQuery(station.name)
    setJustSelected(true)
    setOpen(false)
    setResults([])
    onSelect(station)
    if (onChange) onChange(station.name)
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <Input
        value={query}
        onChange={(event) => {
          const newValue = event.target.value
          setQuery(newValue)
          setJustSelected(false) // User is typing, allow search
          setOpen(true)
          if (onChange) onChange(newValue)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (results.length > 0 || onPickFromMap) && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-56 overflow-y-auto border-2 border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
          {onPickFromMap && (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm border-b-2 border-[var(--border)]',
                'hover:bg-[var(--muted)] text-[var(--muted-foreground)]',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false)
                onPickFromMap()
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="font-bold uppercase text-xs">Pick location from map</span>
            </button>
          )}
          {results.map((station) => (
            <button
              key={station.id}
              type="button"
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                'hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(station)}
            >
              <span className="font-bold">{station.name}</span>
              <span className="text-[10px] uppercase tracking-wide opacity-70">{station.type || 'stop'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
