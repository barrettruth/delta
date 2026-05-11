"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { rruleToText } from "@/core/recurrence";
import type { Task } from "@/core/types";
import {
  type LocationResult,
  useLocationSearch,
} from "@/hooks/use-location-search";
import type { TaskPreFill } from "@/lib/calendar-utils";
import type { TaskPanelFormValues } from "@/lib/task-panel-save";
import { detectMeetingPlatform } from "@/lib/utils";

type TaskPanelFieldValues = Omit<TaskPanelFormValues, "notes">;

interface StatusMessenger {
  error: (message: string) => void;
  message: (message: string) => void;
}

interface StoredLocationOptions {
  clearCoordinates?: boolean;
}

const EMPTY_FIELDS: TaskPanelFieldValues = {
  description: "",
  category: "",
  due: "",
  location: "",
  locationLat: null,
  locationLon: null,
  meetingUrl: "",
  recurrence: null,
  recurMode: "scheduled",
};

export function taskPanelFormValuesFromTask(task: Task): TaskPanelFormValues {
  const due = task.due ? task.due.slice(0, task.allDay === 1 ? 10 : 16) : "";

  return {
    description: task.description,
    category: task.category ?? "",
    due,
    location: task.location ?? "",
    locationLat: task.locationLat ?? null,
    locationLon: task.locationLon ?? null,
    meetingUrl: task.meetingUrl ?? "",
    recurrence: task.recurrence,
    recurMode: task.recurMode ?? "scheduled",
    notes: task.notes ?? null,
  };
}

export function taskPanelFormValuesFromPrefill(
  preFill: TaskPreFill | null,
): TaskPanelFormValues {
  const due = preFill?.startAt
    ? preFill.startAt.slice(0, preFill?.allDay === 1 ? 10 : 16)
    : "";

  return {
    description: "",
    category: preFill?.category ?? "",
    due,
    location: "",
    locationLat: null,
    locationLon: null,
    meetingUrl: "",
    recurrence: null,
    recurMode: "scheduled",
    notes: null,
  };
}

export interface TaskPanelFormController {
  titleRef: RefObject<HTMLInputElement | null>;
  values: TaskPanelFormValues;
  getCurrentFormValues: () => TaskPanelFormValues;
  reset: (nextForm: TaskPanelFormValues) => void;
  setDescription: (description: string) => void;
  setCategory: (category: string) => void;
  setDue: (due: string) => void;
  setRecurrence: (recurrence: string | null) => void;
  setRecurMode: (mode: "scheduled" | "completion") => void;
  recurrenceInputValue: string;
  handleRecurrenceFocus: () => void;
  handleRecurrenceBlur: () => Promise<void>;
  categorySuggestions: {
    visible: boolean;
    items: string[];
    show: () => void;
    hideSoon: () => void;
    select: (category: string) => void;
  };
  locationInputValue: string;
  locationSuggestions: {
    visible: boolean;
    error: string | null;
    filteredLocations: string[];
    results: LocationResult[];
    activeIndex: number;
    show: () => void;
    hideSoon: () => void;
    setFromInput: (value: string) => void;
    handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    selectStored: (location: string, options?: StoredLocationOptions) => void;
    selectResult: (result: LocationResult) => void;
  };
  handleNotesChange: (json: string) => void;
}

export function useTaskPanelForm({
  tasks,
  statusBar,
}: {
  tasks: Task[];
  statusBar: StatusMessenger;
}): TaskPanelFormController {
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<string | null>(null);
  const formDataRef = useRef<TaskPanelFormValues>({
    ...EMPTY_FIELDS,
    notes: null,
  });
  const [fields, setFields] = useState<TaskPanelFieldValues>(EMPTY_FIELDS);
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationIdx, setLocationIdx] = useState(-1);
  const [recurrenceFocused, setRecurrenceFocused] = useState(false);

  formDataRef.current = {
    ...fields,
    notes: notesRef.current,
  };

  const values = useMemo(
    (): TaskPanelFormValues => ({
      ...fields,
      notes: notesValue,
    }),
    [fields, notesValue],
  );

  const getCurrentFormValues = useCallback(
    (): TaskPanelFormValues => ({
      ...formDataRef.current,
    }),
    [],
  );

  const setField = useCallback(
    <K extends keyof TaskPanelFieldValues>(
      field: K,
      value: TaskPanelFieldValues[K],
    ) => {
      setFields((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const reset = useCallback((nextForm: TaskPanelFormValues) => {
    const { notes, ...nextFields } = nextForm;
    setFields(nextFields);
    notesRef.current = notes;
    setNotesValue(notes);
  }, []);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const task of tasks) {
      if (task.category) cats.add(task.category);
    }
    return [...cats].sort();
  }, [tasks]);

  const filteredCategories = useMemo(() => {
    if (!fields.category) return allCategories;
    const lower = fields.category.toLowerCase();
    return allCategories.filter(
      (category) =>
        category.toLowerCase().includes(lower) && category !== fields.category,
    );
  }, [allCategories, fields.category]);

  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    for (const task of tasks) {
      if (task.location) locs.add(task.location);
    }
    return [...locs].sort();
  }, [tasks]);

  const filteredLocations = useMemo(() => {
    if (!fields.location) return allLocations;
    const lower = fields.location.toLowerCase();
    return allLocations.filter(
      (location) =>
        location.toLowerCase().includes(lower) && location !== fields.location,
    );
  }, [allLocations, fields.location]);

  const { results: locationResults, error: locationLookupError } =
    useLocationSearch(fields.location);

  const rruleHuman = useMemo(() => {
    if (!fields.recurrence) return null;
    try {
      return rruleToText(fields.recurrence);
    } catch {
      return null;
    }
  }, [fields.recurrence]);

  const handleRecurrenceBlur = useCallback(async () => {
    setRecurrenceFocused(false);
    if (
      !fields.recurrence ||
      fields.recurrence.startsWith("RRULE:") ||
      fields.recurrence.startsWith("FREQ=")
    ) {
      return;
    }

    try {
      const res = await fetch("/api/nlp/parse-recurrence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fields.recurrence }),
      });
      if (!res.ok) {
        const data = await res.json();
        statusBar.error(data.error ?? "could not parse recurrence");
        return;
      }
      const data = await res.json();
      if (data.rrule) {
        setField("recurrence", data.rrule);
        statusBar.message(`parsed: ${data.humanText}`);
      }
    } catch {
      statusBar.error("failed to parse recurrence");
    }
  }, [fields.recurrence, setField, statusBar]);

  const setLocationFromInput = useCallback((value: string) => {
    setFields((prev) => {
      if (detectMeetingPlatform(value)) {
        return {
          ...prev,
          location: "",
          locationLat: null,
          locationLon: null,
          meetingUrl: value,
        };
      }

      return {
        ...prev,
        location: value,
        locationLat: null,
        locationLon: null,
        meetingUrl: "",
      };
    });
    setShowLocationSuggestions(true);
    setLocationIdx(-1);
  }, []);

  const selectStoredLocation = useCallback(
    (location: string, options: StoredLocationOptions = {}) => {
      setFields((prev) => ({
        ...prev,
        location,
        ...(options.clearCoordinates
          ? { locationLat: null, locationLon: null }
          : {}),
        meetingUrl: "",
      }));
      setShowLocationSuggestions(false);
      setLocationIdx(-1);
    },
    [],
  );

  const selectLocationResult = useCallback((result: LocationResult) => {
    setFields((prev) => ({
      ...prev,
      location: result.displayName,
      locationLat: result.lat,
      locationLon: result.lon,
      meetingUrl: "",
    }));
    setShowLocationSuggestions(false);
    setLocationIdx(-1);
  }, []);

  const handleLocationKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const allItems = [
        ...filteredLocations,
        ...locationResults.map((result) => result.displayName),
      ];
      if (!showLocationSuggestions || allItems.length === 0) return;

      if ((event.ctrlKey && event.key === "n") || event.key === "ArrowDown") {
        event.preventDefault();
        setLocationIdx((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
      } else if (
        (event.ctrlKey && event.key === "p") ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        setLocationIdx((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
      } else if (event.key === "Enter" && locationIdx >= 0) {
        event.preventDefault();
        const geoIdx = locationIdx - filteredLocations.length;
        const result = locationResults[geoIdx];
        if (geoIdx >= 0 && result) {
          selectLocationResult(result);
        } else {
          selectStoredLocation(allItems[locationIdx], {
            clearCoordinates: true,
          });
        }
      } else if (event.key === "Escape") {
        setShowLocationSuggestions(false);
        setLocationIdx(-1);
      }
    },
    [
      filteredLocations,
      locationIdx,
      locationResults,
      selectLocationResult,
      selectStoredLocation,
      showLocationSuggestions,
    ],
  );

  const handleNotesChange = useCallback((json: string) => {
    notesRef.current = json;
    setNotesValue(json);
  }, []);

  return {
    titleRef,
    values,
    getCurrentFormValues,
    reset,
    setDescription: (description) => setField("description", description),
    setCategory: (category) => setField("category", category),
    setDue: (due) => setField("due", due),
    setRecurrence: (recurrence) => setField("recurrence", recurrence),
    setRecurMode: (mode) => setField("recurMode", mode),
    recurrenceInputValue: recurrenceFocused
      ? (fields.recurrence ?? "")
      : (rruleHuman ?? fields.recurrence ?? ""),
    handleRecurrenceFocus: () => setRecurrenceFocused(true),
    handleRecurrenceBlur,
    categorySuggestions: {
      visible: showCategorySuggestions,
      items: filteredCategories,
      show: () => setShowCategorySuggestions(true),
      hideSoon: () => setTimeout(() => setShowCategorySuggestions(false), 150),
      select: (category) => {
        setField("category", category);
        setShowCategorySuggestions(false);
      },
    },
    locationInputValue: fields.location || fields.meetingUrl,
    locationSuggestions: {
      visible: showLocationSuggestions,
      error: locationLookupError,
      filteredLocations,
      results: locationResults,
      activeIndex: locationIdx,
      show: () => setShowLocationSuggestions(true),
      hideSoon: () => setTimeout(() => setShowLocationSuggestions(false), 150),
      setFromInput: setLocationFromInput,
      handleKeyDown: handleLocationKeyDown,
      selectStored: selectStoredLocation,
      selectResult: selectLocationResult,
    },
    handleNotesChange,
  };
}
