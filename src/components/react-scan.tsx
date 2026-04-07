"use client";

import { scan } from "react-scan";
import { useEffect } from "@/lib/react-client";

const enabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DELTA_REACT_SCAN === "true";
const log = process.env.NEXT_PUBLIC_DELTA_REACT_SCAN_LOG === "true";
const trackUnnecessaryRenders =
  process.env.NEXT_PUBLIC_DELTA_REACT_SCAN_TRACK_UNNECESSARY === "true";

let started = false;

export function ReactScan() {
  useEffect(() => {
    if (!enabled || started) return;

    started = true;
    scan({
      enabled: true,
      log,
      trackUnnecessaryRenders,
    });
  }, []);

  return null;
}
