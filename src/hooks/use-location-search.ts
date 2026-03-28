import { useEffect, useRef, useState } from "react";

export interface LocationResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
}

export function useLocationSearch(query: string): {
  results: LocationResult[];
  loading: boolean;
} {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, LocationResult[]>>(new Map());

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(query);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data: LocationResult[] = await res.json();
        cacheRef.current.set(query, data);
        setResults(data);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  return { results, loading };
}
