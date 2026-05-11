import { useEffect, useRef, useState } from "react";
import type { LocationResult } from "@/core/geocoding";

export type { LocationResult } from "@/core/geocoding";

export function useLocationSearch(query: string): {
  results: LocationResult[];
  loading: boolean;
  error: string | null;
} {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, LocationResult[]>>(new Map());

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = cacheRef.current.get(query);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(data?.error ?? "Location lookup failed");
          return;
        }
        const data: LocationResult[] = await res.json();
        cacheRef.current.set(query, data);
        setResults(data);
        setError(null);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setError("Location lookup failed");
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

  return { results, loading, error };
}
