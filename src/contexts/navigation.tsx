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
  scrollTop?: number;
};

interface NavigationContextValue {
  pushJump: () => void;
  jumpBack: () => void;
  jumpForward: () => void;
  goAlternate: () => void;
  setTaskDetailOpen: (taskId: number | null) => void;
  consumePendingTaskDetail: () => number | null;
  saveViewState: (key: string, state: unknown) => void;
  getViewState: <T>(key: string) => T | undefined;
  registerScrollContainer: (el: HTMLElement | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function locationsEqual(a: NavLocation, b: NavLocation): boolean {
  return (
    a.pathname === b.pathname && a.search === b.search && a.taskId === b.taskId
  );
}

const MAX_JUMP_LIST = 100;
const STORAGE_KEY = "delta:nav";

function saveToSession(
  jumpList: NavLocation[],
  jumpCursor: number,
  alternate: NavLocation | null,
  viewState: Map<string, unknown>,
) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        jumpList,
        jumpCursor,
        alternate,
        viewState: Object.fromEntries(viewState),
      }),
    );
  } catch {}
}

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
  const pendingTaskDetailRef = useRef<number | null>(null);
  const viewStateRef = useRef<Map<string, unknown>>(new Map());
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    const search = searchParams.toString();
    currentLocationRef.current = {
      ...currentLocationRef.current,
      pathname,
      search,
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.jumpList) jumpListRef.current = data.jumpList;
        if (typeof data.jumpCursor === "number")
          jumpCursorRef.current = data.jumpCursor;
        if (data.alternate) alternateRef.current = data.alternate;
        if (data.viewState)
          viewStateRef.current = new Map(Object.entries(data.viewState));
      }
    } catch {}
  }, []);

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

  const consumePendingTaskDetail = useCallback((): number | null => {
    const id = pendingTaskDetailRef.current;
    pendingTaskDetailRef.current = null;
    return id;
  }, []);

  const navigateTo = useCallback(
    (loc: NavLocation) => {
      const url = loc.search ? `${loc.pathname}?${loc.search}` : loc.pathname;
      router.replace(url);
      if (loc.taskId != null) {
        taskDetailOpenRef.current = loc.taskId;
        pendingTaskDetailRef.current = loc.taskId;
        window.dispatchEvent(
          new CustomEvent("open-task-detail", {
            detail: { taskId: loc.taskId },
          }),
        );
      } else {
        if (taskDetailOpenRef.current != null) {
          taskDetailOpenRef.current = null;
          window.dispatchEvent(new Event("close-task-detail"));
        }
      }
      if (loc.scrollTop != null) {
        pendingScrollTopRef.current = loc.scrollTop;
      }
    },
    [router],
  );

  const pushJump = useCallback(() => {
    const current = { ...currentLocationRef.current };
    if (scrollContainerRef.current) {
      current.scrollTop = scrollContainerRef.current.scrollTop;
    }
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
    saveToSession(
      truncated,
      truncated.length - 1,
      current,
      viewStateRef.current,
    );
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
    saveToSession(list, newCursor, alternateRef.current, viewStateRef.current);
  }, [navigateTo]);

  const jumpForward = useCallback(() => {
    const list = jumpListRef.current;
    const cursor = jumpCursorRef.current;
    if (cursor >= list.length - 1) return;

    const newCursor = cursor + 1;
    jumpCursorRef.current = newCursor;
    navigateTo(list[newCursor]);
    saveToSession(list, newCursor, alternateRef.current, viewStateRef.current);
  }, [navigateTo]);

  const goAlternate = useCallback(() => {
    const alt = alternateRef.current;
    if (!alt) return;

    const current = { ...currentLocationRef.current };
    alternateRef.current = current;
    navigateTo(alt);
    saveToSession(
      jumpListRef.current,
      jumpCursorRef.current,
      current,
      viewStateRef.current,
    );
  }, [navigateTo]);

  const registerScrollContainer = useCallback((el: HTMLElement | null) => {
    scrollContainerRef.current = el;
    if (el && pendingScrollTopRef.current != null) {
      el.scrollTop = pendingScrollTopRef.current;
      pendingScrollTopRef.current = null;
    }
  }, []);

  const saveViewState = useCallback((key: string, state: unknown) => {
    viewStateRef.current.set(key, state);
    saveToSession(
      jumpListRef.current,
      jumpCursorRef.current,
      alternateRef.current,
      viewStateRef.current,
    );
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
    consumePendingTaskDetail,
    saveViewState,
    getViewState,
    registerScrollContainer,
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
