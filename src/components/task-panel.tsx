"use client";

import { Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  saveTaskDetailsAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { ResizeHandle } from "@/components/resize-handle";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import { rruleToText } from "@/core/recurrence";
import { TASK_STATUS_LABELS } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import { useLocationSearch } from "@/hooks/use-location-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";
import {
  buildTaskPanelUpdateInput,
  isTaskPanelDirty,
  type TaskPanelFormValues,
} from "@/lib/task-panel-save";
import { detectMeetingPlatform } from "@/lib/utils";

export function TaskPanel({
  tasks,
  variant = "sidebar",
}: {
  tasks: Task[];
  variant?: "sidebar" | "popover";
}) {
  const panel = useTaskPanel();
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const recurrenceDelete = useRecurrenceDelete();
  const undo = useUndo();
  const {
    isOpen,
    mode,
    taskId,
    preFill,
    width,
    closeRequestSeq,
    optimisticTasks,
    setPendingEdit,
    clearPendingEdit,
    clearOptimisticTask,
    forceClose,
  } = panel;

  const task = useMemo(
    () =>
      taskId
        ? (tasks.find((t) => t.id === taskId) ??
          optimisticTasks.get(taskId) ??
          null)
        : null,
    [tasks, taskId, optimisticTasks],
  );

  // Once the server's canonical task list contains this id, drop the
  // optimistic shim so future edits see the real row.
  useEffect(() => {
    if (taskId == null) return;
    if (!optimisticTasks.has(taskId)) return;
    if (tasks.some((t) => t.id === taskId)) {
      clearOptimisticTask(taskId);
    }
  }, [tasks, taskId, optimisticTasks, clearOptimisticTask]);
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
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const prevTaskIdRef = useRef<number | null>(null);
  // Snapshot of the `due` input value when the form loaded for this task.
  // Used to skip rewriting `due` on save when the user didn't touch it —
  // otherwise the round-trip through `new Date(datetime-local).toISOString()`
  // shifts the stored timestamp by the local timezone offset, which can
  // push an all-day / due-only event onto the adjacent date.
  const initialDueRef = useRef<string>("");
  const initialFormRef = useRef<TaskPanelFormValues | null>(null);
  const saveQueueRef = useRef(Promise.resolve(true));
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledCloseRequestRef = useRef(0);

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

  const handleNotesChange = useCallback((json: string) => {
    notesRef.current = json;
    setNotesValue(json);
  }, []);

  useEffect(() => {
    // Only mirror form state into pendingEdits once we actually have the task
    // loaded. Otherwise a freshly-opened panel whose task hasn't hydrated yet
    // (e.g. just-materialized recurring instance awaiting revalidation) would
    // write the previous task's stale description/category/location/meetingUrl
    // under the new id and corrupt the calendar render.
    if (mode !== "edit" || !taskId || !task) return;
    setPendingEdit(taskId, {
      description,
      category: category || null,
      location: location || null,
      meetingUrl: meetingUrl || null,
    } as Partial<Task>);
  }, [
    mode,
    taskId,
    task,
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

  const getCurrentFormValues = useCallback(
    (): TaskPanelFormValues => ({
      ...formDataRef.current,
    }),
    [],
  );

  const currentFormValues = useMemo(
    (): TaskPanelFormValues => ({
      description,
      category,
      due,
      location,
      locationLat,
      locationLon,
      meetingUrl,
      recurrence,
      recurMode,
      notes: notesValue,
    }),
    [
      description,
      category,
      due,
      location,
      locationLat,
      locationLon,
      meetingUrl,
      recurrence,
      recurMode,
      notesValue,
    ],
  );

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const saveTask = useCallback(
    (id: number) => {
      const snapshot = {
        form: getCurrentFormValues(),
        initialDue: initialDueRef.current,
      };

      const run = async () => {
        if (!isTaskPanelDirty(initialFormRef.current, snapshot.form)) {
          return true;
        }

        const result = await saveTaskDetailsAction(id, {
          task: buildTaskPanelUpdateInput(snapshot.form, snapshot.initialDue),
        });

        if ("error" in result) {
          statusBar.error(result.error);
          return false;
        }

        initialFormRef.current = snapshot.form;
        initialDueRef.current = snapshot.form.due;

        return true;
      };

      const queued = saveQueueRef.current.then(run, run);
      saveQueueRef.current = queued.then(
        () => true,
        () => true,
      );

      return queued;
    },
    [getCurrentFormValues, statusBar],
  );

  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    if (prevId && prevId !== taskId) {
      void saveTask(prevId);
    }
    prevTaskIdRef.current = taskId;

    const t = taskRef.current;
    if (mode === "edit" && t) {
      const dueInit = t.due ? t.due.slice(0, t.allDay === 1 ? 10 : 16) : "";
      const nextForm = {
        description: t.description,
        category: t.category ?? "",
        due: dueInit,
        location: t.location ?? "",
        locationLat: t.locationLat ?? null,
        locationLon: t.locationLon ?? null,
        meetingUrl: t.meetingUrl ?? "",
        recurrence: t.recurrence,
        recurMode: t.recurMode ?? "scheduled",
        notes: t.notes ?? null,
      } satisfies TaskPanelFormValues;
      initialFormRef.current = nextForm;
      setDescription(t.description);
      setCategory(t.category ?? "");
      setDue(dueInit);
      initialDueRef.current = dueInit;
      setLocation(t.location ?? "");
      setLocationLat(t.locationLat ?? null);
      setLocationLon(t.locationLon ?? null);
      setMeetingUrl(t.meetingUrl ?? "");
      setRecurrence(t.recurrence);
      setRecurMode(t.recurMode ?? "scheduled");
      notesRef.current = t.notes ?? null;
      setNotesValue(t.notes ?? null);
    } else if (mode === "create") {
      const dueInit = preFill?.startAt
        ? preFill.startAt.slice(0, preFill?.allDay === 1 ? 10 : 16)
        : "";
      initialFormRef.current = {
        description: "",
        category: preFill?.category ?? "",
        due: dueInit,
        location: "",
        locationLat: null,
        locationLon: null,
        meetingUrl: "",
        recurrence: null,
        recurMode: "scheduled",
        notes: null,
      };
      setDescription("");
      setCategory(preFill?.category ?? "");
      setDue(dueInit);
      initialDueRef.current = dueInit;
      setLocation("");
      setLocationLat(null);
      setLocationLon(null);
      setMeetingUrl("");
      setRecurrence(null);
      setRecurMode("scheduled");
      notesRef.current = null;
      setNotesValue(null);
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

  const handleCreate = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

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
      forceClose();
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
    forceClose,
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
      forceClose();
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
    forceClose();
  }, [task, recurrenceDelete, undo, forceClose]);

  const handleClosePanel = useCallback(async () => {
    clearAutoSaveTimer();

    if (mode === "edit" && task) {
      if (await saveTask(task.id)) {
        forceClose();
      }
      return;
    }

    if (mode === "create") {
      if (description.trim()) {
        await handleCreate();
      } else {
        forceClose();
      }
    }
  }, [
    clearAutoSaveTimer,
    mode,
    task,
    saveTask,
    forceClose,
    description,
    handleCreate,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (matchesEvent("task_detail.save", e.nativeEvent)) {
        e.preventDefault();
        clearAutoSaveTimer();
        if (mode === "edit" && task) {
          void saveTask(task.id);
        } else if (mode === "create") void handleCreate();
        return;
      }

      const closeKey = getKeymap("task_detail.close").triggerKey;
      if (e.key === closeKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleClosePanel();
        return;
      }

      const createKey = getKeymap("task_detail.create").triggerKey;
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
    },
    [mode, task, saveTask, clearAutoSaveTimer, handleClosePanel, handleCreate],
  );

  useEffect(() => {
    if (isOpen && mode === "edit" && !task) {
      forceClose();
    }
  }, [isOpen, mode, task, forceClose]);

  useEffect(() => {
    if (!isOpen) {
      handledCloseRequestRef.current = closeRequestSeq;
      return;
    }
    if (closeRequestSeq === handledCloseRequestRef.current) return;
    handledCloseRequestRef.current = closeRequestSeq;
    void handleClosePanel();
  }, [closeRequestSeq, handleClosePanel, isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "edit" || !task) {
      clearAutoSaveTimer();
      return;
    }

    if (currentFormValues.description.trim().length === 0) {
      clearAutoSaveTimer();
      return;
    }

    if (!isTaskPanelDirty(initialFormRef.current, currentFormValues)) {
      clearAutoSaveTimer();
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void saveTask(task.id);
    }, 750);

    return clearAutoSaveTimer;
  }, [isOpen, mode, task, clearAutoSaveTimer, currentFormValues, saveTask]);

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
              onClick={() => void handleClosePanel()}
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
              onClick={() => void handleClosePanel()}
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
                    {TASK_STATUS_LABELS[task.status as TaskStatus]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
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
          forceClose();
        }}
      />
    </>
  );
}
