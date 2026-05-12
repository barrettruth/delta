"use client";

import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { filterTasksByQuery, type SearchableTask } from "@/lib/task-search";

export interface TaskSearchPersistence {
  load: () => string | undefined;
  save: (query: string | undefined) => void;
}

export interface UseTaskSearchOptions<T extends SearchableTask> {
  tasks: T[];
  persistence?: TaskSearchPersistence;
}

export interface UseTaskSearchResult<T extends SearchableTask> {
  active: boolean;
  clear: () => void;
  filteredTasks: T[];
  handleInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  open: () => void;
  query: string;
  resultCount: number;
  searchRef: RefObject<HTMLInputElement | null>;
  setQuery: Dispatch<SetStateAction<string>>;
  totalCount: number;
}

function focusInput(ref: RefObject<HTMLInputElement | null>): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => ref.current?.focus());
    return;
  }

  ref.current?.focus();
}

export function useTaskSearch<T extends SearchableTask>({
  tasks,
  persistence,
}: UseTaskSearchOptions<T>): UseTaskSearchResult<T> {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const restoredRef = useRef(false);

  const filteredTasks = useMemo(
    () => filterTasksByQuery(tasks, query),
    [tasks, query],
  );

  const clear = useCallback(() => {
    setQuery("");
    setActive(false);
  }, []);

  const open = useCallback(() => {
    setActive(true);
    focusInput(searchRef);
  }, []);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clear();
      }

      if (event.key === "Enter") {
        event.preventDefault();
        searchRef.current?.blur();
      }
    },
    [clear],
  );

  useEffect(() => {
    if (!persistence || restoredRef.current) return;

    restoredRef.current = true;
    const saved = persistence.load();
    if (typeof saved === "string") {
      setQuery(saved);
      setActive(true);
    }
  }, [persistence]);

  useEffect(() => {
    if (!persistence) return;

    persistence.save(query || undefined);
  }, [persistence, query]);

  return {
    active,
    clear,
    filteredTasks,
    handleInputKeyDown,
    open,
    query,
    resultCount: filteredTasks.length,
    searchRef,
    setQuery,
    totalCount: tasks.length,
  };
}
