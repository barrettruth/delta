import { useEffect, useRef, useState } from "react";

export interface PhotonResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

function buildDisplayName(props: PhotonFeature["properties"]): string {
  const parts = [props.name, props.city, props.state].filter(
    (p): p is string => !!p,
  );
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const part of parts) {
    if (!seen.has(part)) {
      seen.add(part);
      deduped.push(part);
    }
  }
  return deduped.join(", ");
}

export function usePhotonSearch(query: string): {
  results: PhotonResult[];
  loading: boolean;
} {
  const [results, setResults] = useState<PhotonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=10`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        const features: PhotonFeature[] = data.features ?? [];
        setResults(
          features.map((f) => ({
            name: f.properties.name ?? "",
            displayName: buildDisplayName(f.properties),
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
