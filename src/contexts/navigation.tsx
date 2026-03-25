"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

type NavLocation = {
  pathname: string;
  search: string;
  taskId?: number;
};

interface NavigationContextValue {
  pushJump: () => void;
  jumpBack: () => void;
  jumpForward: () => void;
  goAlternate: () => void;
  setTaskDetailOpen: (taskId: number | null) => void;
  saveViewState: (key: string, state: unknown) => void;
  getViewState: <T>(key: string) => T | undefined;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function locationsEqual(a: NavLocation, b: NavLocation): boolean {
  return (
    a.pathname === b.pathname && a.search === b.search && a.taskId === b.taskId
  );
}

const MAX_JUMP_LIST = 100;

export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const jumpListRef = useRef<NavLocation[]>([]);
  const jumpCursorRef = useRef<number>(-1);
  const alternateRef = useRef<NavLocation | null>(null);
  const currentLocationRef = useRef<NavLocation>({ pathname: "/", search: "" });
  const taskDetailOpenRef = useRef<number | null>(null);
  const viewStateRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    const search = searchParams.toString();
    const loc: NavLocation = {
      pathname,
      search,
      ...(taskDetailOpenRef.current != null
        ? { taskId: taskDetailOpenRef.current }
        : {}),
    };
    currentLocationRef.current = loc;
  }, [pathname, searchParams]);

  const setTaskDetailOpen = useCallback((taskId: number | null) => {
    taskDetailOpenRef.current = taskId;
    if (taskId != null) {
      currentLocationRef.current = {
        ...currentLocationRef.current,
        taskId,
      };
    } else {
      const { taskId: _, ...rest } = currentLocationRef.current;
      currentLocationRef.current = rest;
    }
  }, []);

  const navigateTo = useCallback(
    (loc: NavLocation) => {
      const url = loc.search ? `${loc.pathname}?${loc.search}` : loc.pathname;
      router.replace(url);
      if (loc.taskId != null) {
        taskDetailOpenRef.current = loc.taskId;
      } else {
        if (taskDetailOpenRef.current != null) {
          taskDetailOpenRef.current = null;
          window.dispatchEvent(new Event("close-task-detail"));
        }
      }
    },
    [router],
  );

  const pushJump = useCallback(() => {
    const current = { ...currentLocationRef.current };
    const list = jumpListRef.current;
    const cursor = jumpCursorRef.current;

    if (
      list.length > 0 &&
      cursor >= 0 &&
      locationsEqual(list[cursor], current)
    ) {
      return;
    }

    const truncated = list.slice(0, cursor + 1);
    truncated.push(current);

    if (truncated.length > MAX_JUMP_LIST) {
      truncated.splice(0, truncated.length - MAX_JUMP_LIST);
    }

    jumpListRef.current = truncated;
    jumpCursorRef.current = truncated.length - 1;
    alternateRef.current = current;
  }, []);

  const jumpBack = useCallback(() => {
    const list = jumpListRef.current;
    const cursor = jumpCursorRef.current;
    if (cursor <= 0 || list.length === 0) return;

    if (cursor === list.length - 1) {
      const current = { ...currentLocationRef.current };
      if (!locationsEqual(list[cursor], current)) {
        list.push(current);
        jumpCursorRef.current = list.length - 1;
      }
    }

    const newCursor = jumpCursorRef.current - 1;
    jumpCursorRef.current = newCursor;
    navigateTo(list[newCursor]);
  }, [navigateTo]);

  const jumpForward = useCallback(() => {
    const list = jumpListRef.current;
    const cursor = jumpCursorRef.current;
    if (cursor >= list.length - 1) return;

    const newCursor = cursor + 1;
    jumpCursorRef.current = newCursor;
    navigateTo(list[newCursor]);
  }, [navigateTo]);

  const goAlternate = useCallback(() => {
    const alt = alternateRef.current;
    if (!alt) return;

    const current = { ...currentLocationRef.current };
    alternateRef.current = current;
    navigateTo(alt);
  }, [navigateTo]);

  const saveViewState = useCallback((key: string, state: unknown) => {
    viewStateRef.current.set(key, state);
  }, []);

  const getViewState = useCallback(<T,>(key: string): T | undefined => {
    return viewStateRef.current.get(key) as T | undefined;
  }, []);

  const value: NavigationContextValue = {
    pushJump,
    jumpBack,
    jumpForward,
    goAlternate,
    setTaskDetailOpen,
    saveViewState,
    getViewState,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}
