"use client";

import { MapPin } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { ResizeHandle } from "@/components/resize-handle";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Button } from "@/components/ui/button";
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
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import { useLocationSearch } from "@/hooks/use-location-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { formatTime } from "@/lib/calendar-utils";
import { detectMeetingPlatform } from "@/lib/utils";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const nav = useNavigation();
  const undo = useUndo();
  const keymaps = useKeymaps();
  const statusBar = useStatusBar();
  const recurrenceDelete = useRecurrenceDelete();
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

  const detectedPlatform = useMemo(
    () => (meetingUrl ? detectMeetingPlatform(meetingUrl) : null),
    [meetingUrl],
  );

  const rruleHuman = useMemo(() => {
    if (!recurrence) return null;
    try {
      return rruleToText(recurrence);
    } catch {
      return null;
    }
  }, [recurrence]);

  const { results: locationResults } = useLocationSearch(location);

  const saveTask = useCallback(async (id: number) => {
    const f = formDataRef.current;
    await updateTaskAction(id, {
      description: f.description,
      category: f.category || null,
      due: f.due ? new Date(f.due).toISOString() : null,
      notes: f.notes || null,
      location: f.location || null,
      locationLat: f.location ? f.locationLat : null,
      locationLon: f.location ? f.locationLon : null,
      meetingUrl: f.meetingUrl || null,
      recurrence: f.recurrence || null,
      recurMode: f.recurrence ? f.recurMode : null,
    });
  }, []);

  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    if (prevId && prevId !== taskId) {
      saveTask(prevId);
    }
    prevTaskIdRef.current = taskId;

    const t = taskRef.current;
    if (mode === "edit" && t) {
      setDescription(t.description);
      setCategory(t.category ?? "");
      setDue(t.due ? t.due.slice(0, 16) : "");
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
      setDue(preFill?.startAt ? preFill.startAt.slice(0, 16) : "");
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
      if (id) saveTask(id);
      prevTaskIdRef.current = null;
    };
  }, [isOpen, saveTask]);

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
      panel.close();
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
  ]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (
      (task.recurrence || task.recurringTaskId) &&
      recurrenceDelete.requestDelete(task)
    ) {
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
    deleteTaskAction(task.id);
    panel.close();
  }, [task, recurrenceDelete, undo, panel]);

  async function handleStatusChange(status: string) {
    if (!task) return;
    if (status === "done") {
      await completeTaskAction(task.id);
    } else {
      await updateTaskAction(task.id, { status: status as TaskStatus });
    }
  }

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
        if (mode === "edit" && task) saveTask(task.id);
        else if (mode === "create") handleCreate();
        return;
      }

      const closeKey =
        keymaps.getResolvedKeymap("task_detail.close").triggerKey;
      if (e.key === closeKey) {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "edit" && task) saveTask(task.id);
        if (mode === "create" && description.trim()) handleCreate();
        panel.close();
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
    function onSave() {
      if (mode === "edit" && task) {
        saveTask(task.id);
        statusBar.message("saved");
      } else if (mode === "create") {
        handleCreate();
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

  return (
    <>
      {!isMobile && <ResizeHandle onResize={panel.setWidth} />}
      <div
        role="region"
        style={isMobile ? undefined : { width: `${width}%` }}
        className="flex flex-col h-full border-l border-border bg-card shrink-0 overflow-hidden w-full"
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 pt-3 pb-2">
          {isMobile && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground mb-2 min-h-[44px] flex items-center"
              onClick={() => {
                if (mode === "edit" && task) saveTask(task.id);
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
                className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-1"
                onClick={handleShare}
              >
                &#x2197;
              </button>
            )}
          </div>
        </div>

        {mode === "create" && preFill && (preFill.startAt || preFill.due) && (
          <div className="flex gap-2 px-4 pb-2 text-xs text-muted-foreground">
            {preFill.startAt && (
              <span>
                {formatTime(new Date(preFill.startAt))}
                {preFill.endAt &&
                  `\u2013${formatTime(new Date(preFill.endAt))}`}
              </span>
            )}
            {preFill.allDay === 1 && <span>all day</span>}
          </div>
        )}

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
              type="datetime-local"
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
              onBlur={() => setRecurrenceFocused(false)}
              placeholder="repeat..."
              disabled={mode === "edit" && !!task?.recurringTaskId}
              className="h-7 text-xs w-1/2"
            />
          </div>

          <span className="text-xs text-muted-foreground/60 inline-flex items-center gap-1">
            <MapPin size={12} weight="bold" />
            location
          </span>
          <div className="flex gap-2 items-start">
            <div className="relative w-1/2">
              <Input
                value={location}
                onChange={(e) => {
                  const val = e.target.value;
                  if (detectMeetingPlatform(val)) {
                    setMeetingUrl(val);
                    setLocation("");
                  } else {
                    setLocation(val);
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
                (filteredLocations.length > 0 ||
                  locationResults.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1 max-h-48 overflow-y-auto">
                    {filteredLocations.map((l, i) => (
                      <button
                        key={l}
                        type="button"
                        className={`w-full px-2 py-1 text-xs text-left transition-colors ${locationIdx === i ? "bg-accent" : "hover:bg-accent"}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setLocation(l);
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
            <div className="flex items-center gap-1 w-1/2">
              <Input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="link"
                className="h-7 text-xs flex-1"
              />
              {detectedPlatform && (
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center h-7 px-2 text-xs hover:bg-accent transition-colors border border-transparent shrink-0"
                >
                  Join
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 pt-3 pb-4">
          <TiptapEditor
            key={mode === "edit" ? task?.id : "create"}
            content={mode === "edit" ? (task?.notes ?? null) : null}
            onChange={(json) => {
              notesRef.current = json;
            }}
          />
        </div>

        {mode === "edit" && task && (
          <div className="flex gap-2 px-4 py-3 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => saveTask(task.id)}
            >
              save
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={handleDelete}
            >
              delete
            </Button>
          </div>
        )}
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
