"use client";

import { Copy, Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { ResizeHandle } from "@/components/resize-handle";
import { TaskPanelReminders } from "@/components/task-panel-reminders";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKeymaps } from "@/contexts/keymaps";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import { rruleToText } from "@/core/recurrence";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { TaskReminder } from "@/core/reminders/types";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import { useLocationSearch } from "@/hooks/use-location-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import {
  createTaskPanelReminderDraft,
  type TaskPanelReminderDraft,
  taskPanelRemindersEqual,
  taskReminderToDraft,
} from "@/lib/task-panel-reminders";
import { detectMeetingPlatform } from "@/lib/utils";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

interface ApiErrorResponse {
  error?: string;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | T
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? body.error : null;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }

  return body as T;
}

function cloneReminderDrafts(
  drafts: TaskPanelReminderDraft[],
): TaskPanelReminderDraft[] {
  return drafts.map((draft) => ({ ...draft }));
}

export function TaskPanel({
  tasks,
  variant = "sidebar",
}: {
  tasks: Task[];
  variant?: "sidebar" | "popover";
}) {
  const panel = useTaskPanel();
  const nav = useNavigation();
  const keymaps = useKeymaps();
  const statusBar = useStatusBar();
  const recurrenceDelete = useRecurrenceDelete();
  const undo = useUndo();
  const {
    isOpen,
    mode,
    taskId,
    preFill,
    width,
    setPendingEdit,
    clearPendingEdit,
  } = panel;

  const task = useMemo(
    () => (taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null),
    [tasks, taskId],
  );
  const taskRef = useRef(task);
  taskRef.current = task;
  const activeTaskIdRef = useRef<number | null>(taskId);
  activeTaskIdRef.current = taskId;
  const panelOpenRef = useRef(isOpen);
  panelOpenRef.current = isOpen;

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [due, setDue] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLon, setLocationLon] = useState<number | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [recurMode, setRecurMode] = useState<"scheduled" | "completion">(
    "scheduled",
  );
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationIdx, setLocationIdx] = useState(-1);
  const [recurrenceFocused, setRecurrenceFocused] = useState(false);
  const notesRef = useRef<string | null>(null);
  const pendingYRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const prevTaskIdRef = useRef<number | null>(null);
  // Snapshot of the `due` input value when the form loaded for this task.
  // Used to skip rewriting `due` on save when the user didn't touch it —
  // otherwise the round-trip through `new Date(datetime-local).toISOString()`
  // shifts the stored timestamp by the local timezone offset, which can
  // push an all-day / due-only event onto the adjacent date.
  const initialDueRef = useRef<string>("");
  const reminderClientIdRef = useRef(0);
  const reminderDraftsRef = useRef<TaskPanelReminderDraft[]>([]);
  const initialReminderDraftsRef = useRef<TaskPanelReminderDraft[]>([]);
  const remindersReadyRef = useRef(false);

  const [reminderEndpoints, setReminderEndpoints] = useState<
    ReminderEndpointRecord[]
  >([]);
  const [reminderDrafts, setReminderDrafts] = useState<
    TaskPanelReminderDraft[]
  >([]);
  const [remindersExpanded, setRemindersExpanded] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const formDataRef = useRef({
    description: "",
    category: "",
    due: "",
    location: "",
    locationLat: null as number | null,
    locationLon: null as number | null,
    meetingUrl: "",
    recurrence: null as string | null,
    recurMode: "scheduled" as "scheduled" | "completion",
    notes: null as string | null,
  });

  formDataRef.current = {
    description,
    category,
    due,
    location,
    locationLat,
    locationLon,
    meetingUrl,
    recurrence,
    recurMode,
    notes: notesRef.current,
  };

  reminderDraftsRef.current = reminderDrafts;

  const isAllDayTask =
    mode === "edit" ? task?.allDay === 1 : preFill?.allDay === 1;
  const defaultReminderAnchor =
    !due &&
    (mode === "edit" ? !!task?.startAt : !!preFill?.startAt) &&
    !(mode === "edit" ? !!task?.due : !!preFill?.due)
      ? "start"
      : "due";

  const createReminderClientId = useCallback(() => {
    reminderClientIdRef.current += 1;
    return `reminder-${reminderClientIdRef.current}`;
  }, []);

  const resetReminderState = useCallback(() => {
    setReminderEndpoints([]);
    setReminderDrafts([]);
    setRemindersExpanded(false);
    setRemindersLoading(false);
    setReminderError(null);
    initialReminderDraftsRef.current = [];
    remindersReadyRef.current = false;
  }, []);

  const handleNotesChange = useCallback((json: string) => {
    notesRef.current = json;
  }, []);

  const loadReminderState = useCallback(
    async (panelMode: "edit" | "create", currentTaskId: number | null) => {
      const endpoints = await fetchJson<ReminderEndpointRecord[]>(
        "/api/reminders/endpoints",
      );
      const reminders =
        panelMode === "edit" && currentTaskId
          ? await fetchJson<TaskReminder[]>(
              `/api/tasks/${currentTaskId}/reminders`,
            )
          : [];
      const drafts = reminders.map((reminder) =>
        taskReminderToDraft(reminder, createReminderClientId()),
      );

      return { endpoints, drafts };
    },
    [createReminderClientId],
  );

  const buildReminderPayload = useCallback(
    (reminder: TaskPanelReminderDraft) => {
      if (reminder.endpointId === null) {
        throw new Error("Reminder endpoint is required");
      }

      return {
        endpointId: reminder.endpointId,
        anchor: reminder.anchor,
        offsetMinutes: reminder.offsetMinutes,
        allDayLocalTime: reminder.allDayLocalTime,
        enabled: reminder.enabled,
      };
    },
    [],
  );

  const saveTaskReminders = useCallback(
    async (
      currentTaskId: number,
      input?: {
        initial: TaskPanelReminderDraft[];
        current: TaskPanelReminderDraft[];
        applyState?: boolean;
      },
    ) => {
      if (!remindersReadyRef.current && !input) return true;

      const initial = input?.initial ?? initialReminderDraftsRef.current;
      const current = input?.current ?? reminderDraftsRef.current;
      const initialById = new Map(
        initial
          .filter((reminder) => reminder.id !== null)
          .map((reminder) => [reminder.id as number, reminder]),
      );
      const currentIds = new Set(
        current
          .filter((reminder) => reminder.id !== null)
          .map((reminder) => reminder.id as number),
      );
      const deletedIds = initial
        .filter(
          (reminder) => reminder.id !== null && !currentIds.has(reminder.id),
        )
        .map((reminder) => reminder.id as number);
      const created = current.filter((reminder) => reminder.id === null);
      const updated = current.filter((reminder) => {
        if (reminder.id === null) return false;
        const existing = initialById.get(reminder.id);
        return existing ? !taskPanelRemindersEqual(existing, reminder) : false;
      });

      if (
        deletedIds.length === 0 &&
        created.length === 0 &&
        updated.length === 0
      ) {
        return true;
      }

      for (const id of deletedIds) {
        await fetchJson<{ ok: boolean }>(
          `/api/tasks/${currentTaskId}/reminders/${id}`,
          {
            method: "DELETE",
          },
        );
      }

      const createdByClientId = new Map<string, TaskReminder>();
      for (const reminder of created) {
        const saved = await fetchJson<TaskReminder>(
          `/api/tasks/${currentTaskId}/reminders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildReminderPayload(reminder)),
          },
        );
        createdByClientId.set(reminder.clientId, saved);
      }

      const updatedById = new Map<number, TaskReminder>();
      for (const reminder of updated) {
        const saved = await fetchJson<TaskReminder>(
          `/api/tasks/${currentTaskId}/reminders/${reminder.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildReminderPayload(reminder)),
          },
        );
        updatedById.set(reminder.id as number, saved);
      }

      const nextDrafts = current
        .filter(
          (reminder) =>
            reminder.id === null || !deletedIds.includes(reminder.id),
        )
        .map((reminder) => {
          const createdReminder = createdByClientId.get(reminder.clientId);
          if (createdReminder) {
            return taskReminderToDraft(createdReminder, reminder.clientId);
          }

          if (reminder.id !== null && updatedById.has(reminder.id as number)) {
            return taskReminderToDraft(
              updatedById.get(reminder.id as number) as TaskReminder,
              reminder.clientId,
            );
          }

          return reminder;
        });

      if (
        input?.applyState !== false &&
        panelOpenRef.current &&
        activeTaskIdRef.current === currentTaskId
      ) {
        initialReminderDraftsRef.current = nextDrafts;
        reminderDraftsRef.current = nextDrafts;
        setReminderDrafts(nextDrafts);
      }

      return true;
    },
    [buildReminderPayload],
  );

  const updateReminderDraft = useCallback(
    (
      clientId: string,
      patch: Partial<Omit<TaskPanelReminderDraft, "clientId">>,
    ) => {
      setReminderDrafts((prev) =>
        prev.map((reminder) =>
          reminder.clientId === clientId ? { ...reminder, ...patch } : reminder,
        ),
      );
    },
    [],
  );

  const removeReminderDraft = useCallback((clientId: string) => {
    setReminderDrafts((prev) =>
      prev.filter((reminder) => reminder.clientId !== clientId),
    );
  }, []);

  const addReminderDraft = useCallback(() => {
    if (reminderEndpoints.length === 0) {
      setRemindersExpanded(true);
      return;
    }

    const endpoint =
      reminderEndpoints.find((candidate) => candidate.enabled === 1) ??
      reminderEndpoints[0];

    setReminderDrafts((prev) => [
      ...prev,
      createTaskPanelReminderDraft(createReminderClientId(), {
        endpointId: endpoint?.id ?? null,
        anchor: defaultReminderAnchor,
        allDay: isAllDayTask,
      }),
    ]);
    setRemindersExpanded(true);
  }, [
    createReminderClientId,
    defaultReminderAnchor,
    isAllDayTask,
    reminderEndpoints,
  ]);

  useEffect(() => {
    if (mode === "edit" && taskId) {
      setPendingEdit(taskId, {
        description,
        category: category || null,
        location: location || null,
        meetingUrl: meetingUrl || null,
      } as Partial<Task>);
    }
  }, [
    mode,
    taskId,
    description,
    category,
    location,
    meetingUrl,
    setPendingEdit,
  ]);

  useEffect(() => {
    return () => {
      if (taskId) clearPendingEdit(taskId);
    };
  }, [taskId, clearPendingEdit]);

  useEffect(() => {
    if (!isOpen) {
      resetReminderState();
      return;
    }

    let active = true;
    setRemindersLoading(true);
    setReminderError(null);
    setRemindersExpanded(false);
    remindersReadyRef.current = false;

    void loadReminderState(mode, taskId)
      .then(({ endpoints, drafts }) => {
        if (!active) return;
        setReminderEndpoints(endpoints);
        setReminderDrafts(drafts);
        initialReminderDraftsRef.current = drafts;
        remindersReadyRef.current = true;
      })
      .catch((error) => {
        if (!active) return;
        setReminderEndpoints([]);
        setReminderDrafts([]);
        initialReminderDraftsRef.current = [];
        setReminderError(
          error instanceof Error ? error.message : "Failed to load reminders",
        );
      })
      .finally(() => {
        if (!active) return;
        setRemindersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, loadReminderState, mode, resetReminderState, taskId]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of tasks) {
      if (t.category) cats.add(t.category);
    }
    return [...cats].sort();
  }, [tasks]);

  const filteredCategories = useMemo(() => {
    if (!category) return allCategories;
    const lower = category.toLowerCase();
    return allCategories.filter(
      (c) => c.toLowerCase().includes(lower) && c !== category,
    );
  }, [allCategories, category]);

  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    for (const t of tasks) {
      if (t.location) locs.add(t.location);
    }
    return [...locs].sort();
  }, [tasks]);

  const filteredLocations = useMemo(() => {
    if (!location) return allLocations;
    const lower = location.toLowerCase();
    return allLocations.filter(
      (l) => l.toLowerCase().includes(lower) && l !== location,
    );
  }, [allLocations, location]);

  const handleRecurrenceBlur = useCallback(async () => {
    setRecurrenceFocused(false);
    if (
      !recurrence ||
      recurrence.startsWith("RRULE:") ||
      recurrence.startsWith("FREQ=")
    )
      return;
    try {
      const res = await fetch("/api/nlp/parse-recurrence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: recurrence }),
      });
      if (!res.ok) {
        const data = await res.json();
        statusBar.error(data.error ?? "could not parse recurrence");
        return;
      }
      const data = await res.json();
      if (data.rrule) {
        setRecurrence(data.rrule);
        statusBar.message(`parsed: ${data.humanText}`);
      }
    } catch {
      statusBar.error("failed to parse recurrence");
    }
  }, [recurrence, statusBar]);

  const rruleHuman = useMemo(() => {
    if (!recurrence) return null;
    try {
      return rruleToText(recurrence);
    } catch {
      return null;
    }
  }, [recurrence]);

  const { results: locationResults } = useLocationSearch(location);

  const saveTask = useCallback(
    async (id: number, options?: { applyReminderState?: boolean }) => {
      const f = formDataRef.current;
      const initialReminderDrafts = cloneReminderDrafts(
        initialReminderDraftsRef.current,
      );
      const currentReminderDrafts = cloneReminderDrafts(
        reminderDraftsRef.current,
      );
      const dueChanged = f.due !== initialDueRef.current;
      const result = await updateTaskAction(id, {
        description: f.description,
        category: f.category || null,
        ...(dueChanged
          ? { due: f.due ? new Date(f.due).toISOString() : null }
          : {}),
        notes: f.notes || null,
        location: f.location || null,
        locationLat: f.location ? f.locationLat : null,
        locationLon: f.location ? f.locationLon : null,
        meetingUrl: f.meetingUrl || null,
        recurrence: f.recurrence || null,
        recurMode: f.recurrence ? f.recurMode : null,
      });

      if ("error" in result) {
        statusBar.error(result.error);
        return false;
      }

      try {
        await saveTaskReminders(id, {
          initial: initialReminderDrafts,
          current: currentReminderDrafts,
          applyState: options?.applyReminderState,
        });
      } catch (error) {
        statusBar.error(
          error instanceof Error ? error.message : "Failed to save reminders",
        );
        return false;
      }

      return true;
    },
    [saveTaskReminders, statusBar],
  );

  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    if (prevId && prevId !== taskId) {
      void saveTask(prevId, { applyReminderState: false });
    }
    prevTaskIdRef.current = taskId;

    const t = taskRef.current;
    if (mode === "edit" && t) {
      setDescription(t.description);
      setCategory(t.category ?? "");
      const dueInit = t.due ? t.due.slice(0, t.allDay === 1 ? 10 : 16) : "";
      setDue(dueInit);
      initialDueRef.current = dueInit;
      setLocation(t.location ?? "");
      setLocationLat(t.locationLat ?? null);
      setLocationLon(t.locationLon ?? null);
      setMeetingUrl(t.meetingUrl ?? "");
      setRecurrence(t.recurrence);
      setRecurMode(t.recurMode ?? "scheduled");
      notesRef.current = t.notes ?? null;
    } else if (mode === "create") {
      setDescription("");
      setCategory(preFill?.category ?? "");
      const dueInit = preFill?.startAt
        ? preFill.startAt.slice(0, preFill?.allDay === 1 ? 10 : 16)
        : "";
      setDue(dueInit);
      initialDueRef.current = dueInit;
      setLocation("");
      setLocationLat(null);
      setLocationLon(null);
      setMeetingUrl("");
      setRecurrence(null);
      setRecurMode("scheduled");
      notesRef.current = null;
    }
  }, [taskId, mode, preFill, saveTask]);

  useEffect(() => {
    void taskId;
    if (isOpen) {
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    if (isOpen && taskId) {
      nav.setTaskDetailOpen(taskId);
    } else if (!isOpen) {
      nav.setTaskDetailOpen(null);
    }
  }, [isOpen, taskId, nav]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      const id = prevTaskIdRef.current;
      if (id) void saveTask(id, { applyReminderState: false });
      prevTaskIdRef.current = null;
    };
  }, [isOpen, saveTask]);

  const handleCreate = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed) return;
    const initialReminderDrafts = cloneReminderDrafts(
      initialReminderDraftsRef.current,
    );
    const currentReminderDrafts = cloneReminderDrafts(
      reminderDraftsRef.current,
    );

    const result = await createTaskAction({
      description: trimmed,
      category: category || undefined,
      due: due ? new Date(due).toISOString() : undefined,
      notes: notesRef.current || undefined,
      location: location || undefined,
      locationLat: location && locationLat != null ? locationLat : undefined,
      locationLon: location && locationLon != null ? locationLon : undefined,
      meetingUrl: meetingUrl || undefined,
      startAt: preFill?.startAt,
      endAt: preFill?.endAt,
      allDay: preFill?.allDay,
      timezone: preFill?.timezone,
      recurrence: recurrence || undefined,
      recurMode: recurrence ? recurMode : undefined,
    });

    if ("data" in result && result.data) {
      try {
        await saveTaskReminders(result.data.id, {
          initial: initialReminderDrafts,
          current: currentReminderDrafts,
          applyState: false,
        });
      } catch (error) {
        statusBar.error(
          error instanceof Error
            ? `task created, but ${error.message.toLowerCase()}`
            : "task created, but reminders failed to save",
        );
      }
      panel.close();
      return;
    }

    if ("error" in result) {
      statusBar.error(result.error);
    }
  }, [
    description,
    category,
    due,
    location,
    locationLat,
    locationLon,
    meetingUrl,
    recurrence,
    recurMode,
    preFill,
    panel,
    saveTaskReminders,
    statusBar,
  ]);

  async function handleStatusChange(status: string) {
    if (!task) return;
    if (status === "done") {
      await completeTaskAction(task.id);
    } else {
      await updateTaskAction(task.id, { status: status as TaskStatus });
    }
  }

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (
      (task.recurrence || task.recurringTaskId) &&
      recurrenceDelete.requestDelete(task)
    ) {
      panel.close();
      return;
    }
    undo.push({
      id: `delete-${Date.now()}-${task.id}`,
      op: "delete",
      label: "1 task deleted",
      mutations: [
        {
          taskId: task.id,
          restore: {
            status: (task.status as TaskStatus) ?? "pending",
            completedAt: task.completedAt ?? null,
          },
        },
      ],
      timestamp: Date.now(),
    });
    prevTaskIdRef.current = null;
    deleteTaskAction(task.id);
    panel.close();
  }, [task, recurrenceDelete, undo, panel]);

  const handleShare = useCallback(async () => {
    if (!task?.startAt) return;
    try {
      const res = await fetch(`/api/events/${task.id}/share`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        statusBar.error(data.error ?? "failed to share");
        return;
      }
      await navigator.clipboard.writeText(data.url);
      statusBar.message("share link copied");
    } catch {
      statusBar.error("failed to share");
    }
  }, [task, statusBar]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (keymaps.resolvedMatchesEvent("task_detail.save", e.nativeEvent)) {
        e.preventDefault();
        if (mode === "edit" && task) void saveTask(task.id);
        else if (mode === "create") void handleCreate();
        return;
      }

      const closeKey =
        keymaps.getResolvedKeymap("task_detail.close").triggerKey;
      if (e.key === closeKey) {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "edit" && task) {
          void saveTask(task.id, { applyReminderState: false });
          panel.close();
        } else if (mode === "create") {
          if (description.trim()) {
            void handleCreate();
          } else {
            panel.close();
          }
        }
        return;
      }

      const createKey =
        keymaps.getResolvedKeymap("task_detail.create").triggerKey;
      if (
        mode === "create" &&
        e.key === createKey &&
        !e.shiftKey &&
        e.target === titleRef.current
      ) {
        e.preventDefault();
        handleCreate();
        return;
      }

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (!isInput && e.key === "y" && mode === "edit") {
        e.preventDefault();
        if (pendingYRef.current) {
          pendingYRef.current = false;
          handleShare();
        } else {
          pendingYRef.current = true;
          setTimeout(() => {
            pendingYRef.current = false;
          }, 500);
        }
        return;
      }
    },
    [
      mode,
      task,
      saveTask,
      panel,
      handleCreate,
      handleShare,
      description,
      keymaps,
    ],
  );

  useEffect(() => {
    if (isOpen && mode === "edit" && !task) {
      panel.close();
    }
  }, [isOpen, mode, task, panel]);

  useEffect(() => {
    async function onSave() {
      if (mode === "edit" && task) {
        if (await saveTask(task.id)) {
          statusBar.message("saved");
        }
      } else if (mode === "create") {
        await handleCreate();
      }
    }
    function onDiscard() {
      prevTaskIdRef.current = null;
      panel.close();
    }
    window.addEventListener("command-save-task", onSave);
    window.addEventListener("command-discard-task", onDiscard);
    return () => {
      window.removeEventListener("command-save-task", onSave);
      window.removeEventListener("command-discard-task", onDiscard);
    };
  }, [mode, task, saveTask, handleCreate, panel, statusBar]);

  const isMobile = useIsMobile();

  if (!isOpen) return null;
  if (mode === "edit" && !task) return null;

  const isSidebar = variant === "sidebar";

  return (
    <>
      {isSidebar && !isMobile && <ResizeHandle onResize={panel.setWidth} />}
      <div
        role="region"
        style={isSidebar && !isMobile ? { width: `${width}%` } : undefined}
        className={
          isSidebar
            ? "flex flex-col h-full border-l border-border bg-card shrink-0 overflow-hidden w-full"
            : "flex flex-col h-full w-full bg-card overflow-hidden"
        }
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 pt-3 pb-2">
          {isMobile && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground mb-2 min-h-[44px] flex items-center"
              onClick={() => {
                if (mode === "edit" && task) {
                  void saveTask(task.id, { applyReminderState: false });
                }
                panel.close();
              }}
            >
              &larr; back
            </button>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={titleRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 text-base font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              placeholder={
                mode === "create" ? "New task..." : "Task description"
              }
            />
            {mode === "edit" && task?.startAt && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0 p-1 border border-border hover:border-foreground/30 transition-colors cursor-pointer"
                onClick={handleShare}
              >
                <Copy size={14} />
              </button>
            )}
            {mode === "edit" && task && (
              <button
                type="button"
                aria-label="delete task"
                className="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors cursor-pointer"
                onClick={handleDelete}
              >
                <Trash size={14} />
              </button>
            )}
            <button
              type="button"
              aria-label="close task panel"
              className="text-muted-foreground hover:text-foreground shrink-0 p-1 border border-border hover:border-foreground/30 transition-colors cursor-pointer"
              onClick={() => {
                if (mode === "edit" && task) {
                  void saveTask(task.id, { applyReminderState: false });
                  panel.close();
                } else if (mode === "create") {
                  if (description.trim()) {
                    void handleCreate();
                  } else {
                    panel.close();
                  }
                }
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border/40">
          {mode === "edit" && task && (
            <>
              <span className="text-xs text-muted-foreground/60">status</span>
              <Select
                value={task.status}
                onValueChange={(v) => v && handleStatusChange(v)}
              >
                <SelectTrigger size="sm" className="h-7 text-xs w-full">
                  <SelectValue>
                    {STATUS_LABELS[task.status as TaskStatus]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <span className="text-xs text-muted-foreground/60">category</span>
          <div className="relative">
            <Input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setShowCategorySuggestions(true);
              }}
              onFocus={() => setShowCategorySuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCategorySuggestions(false), 150)
              }
              placeholder="#"
              className="h-7 text-xs"
            />
            {showCategorySuggestions && filteredCategories.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
                {filteredCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCategory(c);
                      setShowCategorySuggestions(false);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground/60">due</span>
          <div className="flex gap-2 items-center">
            <Input
              type={
                (mode === "edit" ? task?.allDay === 1 : preFill?.allDay === 1)
                  ? "date"
                  : "datetime-local"
              }
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-7 text-xs w-1/2"
            />
            <Input
              value={
                recurrenceFocused
                  ? (recurrence ?? "")
                  : (rruleHuman ?? recurrence ?? "")
              }
              onChange={(e) => setRecurrence(e.target.value || null)}
              onFocus={() => setRecurrenceFocused(true)}
              onBlur={handleRecurrenceBlur}
              placeholder="enter recurrence..."
              disabled={mode === "edit" && !!task?.recurringTaskId}
              className="h-7 text-xs w-1/2"
            />
          </div>

          <span className="text-xs text-muted-foreground/60">location</span>
          <div className="relative">
            <Input
              value={location || meetingUrl}
              placeholder="address or meeting link"
              onChange={(e) => {
                const val = e.target.value;
                if (detectMeetingPlatform(val)) {
                  setMeetingUrl(val);
                  setLocation("");
                } else {
                  setLocation(val);
                  setMeetingUrl("");
                }
                setLocationLat(null);
                setLocationLon(null);
                setShowLocationSuggestions(true);
                setLocationIdx(-1);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowLocationSuggestions(false), 150)
              }
              onKeyDown={(e) => {
                const allItems = [
                  ...filteredLocations,
                  ...locationResults.map((r) => r.displayName),
                ];
                if (!showLocationSuggestions || allItems.length === 0) return;
                if ((e.ctrlKey && e.key === "n") || e.key === "ArrowDown") {
                  e.preventDefault();
                  setLocationIdx((prev) =>
                    prev < allItems.length - 1 ? prev + 1 : 0,
                  );
                } else if (
                  (e.ctrlKey && e.key === "p") ||
                  e.key === "ArrowUp"
                ) {
                  e.preventDefault();
                  setLocationIdx((prev) =>
                    prev > 0 ? prev - 1 : allItems.length - 1,
                  );
                } else if (e.key === "Enter" && locationIdx >= 0) {
                  e.preventDefault();
                  setLocation(allItems[locationIdx]);
                  setMeetingUrl("");
                  const geoIdx = locationIdx - filteredLocations.length;
                  if (geoIdx >= 0 && locationResults[geoIdx]) {
                    setLocationLat(locationResults[geoIdx].lat);
                    setLocationLon(locationResults[geoIdx].lon);
                  } else {
                    setLocationLat(null);
                    setLocationLon(null);
                  }
                  setShowLocationSuggestions(false);
                  setLocationIdx(-1);
                } else if (e.key === "Escape") {
                  setShowLocationSuggestions(false);
                  setLocationIdx(-1);
                }
              }}
              className="h-7 text-xs"
            />
            {showLocationSuggestions &&
              (filteredLocations.length > 0 || locationResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1 max-h-48 overflow-y-auto">
                  {filteredLocations.map((l, i) => (
                    <button
                      key={l}
                      type="button"
                      className={`w-full px-2 py-1 text-xs text-left transition-colors ${locationIdx === i ? "bg-accent" : "hover:bg-accent"}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setLocation(l);
                        setMeetingUrl("");
                        setShowLocationSuggestions(false);
                        setLocationIdx(-1);
                      }}
                    >
                      {l}
                    </button>
                  ))}
                  {filteredLocations.length > 0 &&
                    locationResults.length > 0 && (
                      <div className="border-t border-border/40 my-1" />
                    )}
                  {locationResults.map((r, i) => {
                    const idx = filteredLocations.length + i;
                    return (
                      <button
                        key={r.displayName}
                        type="button"
                        className={`w-full px-2 py-1 text-xs text-left transition-colors ${locationIdx === idx ? "bg-accent" : "hover:bg-accent"}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setLocation(r.displayName);
                          setMeetingUrl("");
                          setLocationLat(r.lat);
                          setLocationLon(r.lon);
                          setShowLocationSuggestions(false);
                          setLocationIdx(-1);
                        }}
                      >
                        {r.displayName}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        </div>

        <TaskPanelReminders
          allDay={isAllDayTask}
          endpoints={reminderEndpoints}
          reminders={reminderDrafts}
          loading={remindersLoading}
          error={reminderError}
          expanded={remindersExpanded}
          onExpandedChange={setRemindersExpanded}
          onAddReminder={addReminderDraft}
          onChangeReminder={updateReminderDraft}
          onRemoveReminder={removeReminderDraft}
        />

        <div className="flex-1 min-h-0 overflow-auto px-4 pt-3 pb-4">
          <TiptapEditor
            key={mode === "edit" ? task?.id : "create"}
            content={mode === "edit" ? (task?.notes ?? null) : null}
            onChange={handleNotesChange}
          />
        </div>
      </div>

      <RecurrenceStrategyDialog
        open={!!recurrenceDelete.pending}
        onOpenChange={(open) => {
          if (!open) recurrenceDelete.cancel();
        }}
        mode="delete"
        onSelect={(strategy) => {
          recurrenceDelete.executeStrategy(strategy);
          panel.close();
        }}
      />
    </>
  );
}
