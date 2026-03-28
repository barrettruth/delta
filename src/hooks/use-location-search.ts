import { useEffect, useRef, useState } from "react";

export interface LocationResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
}

interface MapboxFeature {
  properties: {
    name?: string;
    full_address?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

export function useLocationSearch(query: string): {
  results: LocationResult[];
  loading: boolean;
} {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${token}&limit=10`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        const features: MapboxFeature[] = data.features ?? [];
        setResults(
          features.map((f) => ({
            name: f.properties.name ?? "",
            displayName: f.properties.full_address ?? "",
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          })),
        );
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
