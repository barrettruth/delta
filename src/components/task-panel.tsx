"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  createTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
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
import { useTaskPanel } from "@/contexts/task-panel";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import { formatTime } from "@/lib/calendar-utils";
import { detectMeetingPlatform, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  "0": "\u2014",
  "1": "!",
  "2": "!!",
  "3": "!!!",
};

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const nav = useNavigation();
  const { isOpen, mode, taskId, preFill, width } = panel;

  const task = useMemo(
    () => (taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null),
    [tasks, taskId],
  );
  const taskRef = useRef(task);
  taskRef.current = task;

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState("0");
  const [due, setDue] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const notesRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const prevTaskIdRef = useRef<number | null>(null);

  const formDataRef = useRef({
    description: "",
    category: "",
    label: "",
    priority: "0",
    due: "",
    location: "",
    meetingUrl: "",
    notes: null as string | null,
  });

  formDataRef.current = {
    description,
    category,
    label,
    priority,
    due,
    location,
    meetingUrl,
    notes: notesRef.current,
  };

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

  const saveTask = useCallback(async (id: number) => {
    const f = formDataRef.current;
    await updateTaskAction(id, {
      description: f.description,
      category: f.category || null,
      label: f.label || null,
      priority: Number(f.priority),
      due: f.due ? new Date(f.due).toISOString() : null,
      notes: f.notes || null,
      location: f.location || null,
      meetingUrl: f.meetingUrl || null,
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
      setLabel(t.label ?? "");
      setPriority(String(t.priority ?? 0));
      setDue(t.due ? t.due.slice(0, 16) : "");
      setLocation(t.location ?? "");
      setMeetingUrl(t.meetingUrl ?? "");
      notesRef.current = t.notes ?? null;
    } else if (mode === "create") {
      setDescription("");
      setCategory(preFill?.category ?? "");
      setLabel("");
      setPriority("0");
      setDue(preFill?.startAt ? preFill.startAt.slice(0, 16) : "");
      setLocation("");
      setMeetingUrl("");
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
      priority: Number(priority) || undefined,
      due: due ? new Date(due).toISOString() : undefined,
      notes: notesRef.current || undefined,
      location: location || undefined,
      meetingUrl: meetingUrl || undefined,
      startAt: preFill?.startAt,
      endAt: preFill?.endAt,
      allDay: preFill?.allDay,
      timezone: preFill?.timezone,
    });

    if ("data" in result && result.data) {
      panel.open(result.data.id);
    }
  }, [
    description,
    category,
    priority,
    due,
    location,
    meetingUrl,
    preFill,
    panel,
  ]);

  async function handleStatusChange(status: string) {
    if (!task) return;
    if (status === "done") {
      await completeTaskAction(task.id);
    } else {
      await updateTaskAction(task.id, { status: status as TaskStatus });
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (mode === "edit" && task) saveTask(task.id);
        else if (mode === "create") handleCreate();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "edit" && task) saveTask(task.id);
        panel.close();
        return;
      }

      if (
        mode === "create" &&
        e.key === "Enter" &&
        !e.shiftKey &&
        e.target === titleRef.current
      ) {
        e.preventDefault();
        handleCreate();
        return;
      }
    },
    [mode, task, saveTask, panel, handleCreate],
  );

  useEffect(() => {
    if (isOpen && mode === "edit" && !task) {
      panel.close();
    }
  }, [isOpen, mode, task, panel]);

  if (!isOpen) return null;
  if (mode === "edit" && !task) return null;

  return (
    <>
      <ResizeHandle onResize={panel.setWidth} />
      <div
        role="region"
        style={{ width: `${width}%` }}
        className="flex flex-col h-full border-l border-border bg-card shrink-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 pt-3 pb-2">
          <input
            ref={titleRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            placeholder={mode === "create" ? "New task..." : "Task description"}
          />
        </div>

        {mode === "create" && preFill && (preFill.startAt || preFill.due) && (
          <div className="flex gap-2 px-4 pb-2 text-[10px] text-muted-foreground">
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

        <div className="flex flex-col gap-2 px-4 pb-3 border-b border-border/40">
          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">status</span>
            {mode === "edit" && task ? (
              <Select
                value={task.status}
                onValueChange={(v) => v && handleStatusChange(v)}
              >
                <SelectTrigger size="sm" className="h-7 w-full">
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
            ) : (
              <span className="text-xs text-muted-foreground/50">pending</span>
            )}
          </div>

          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">category</span>
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
          </div>

          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">priority</span>
            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger size="sm" className="h-7 w-full">
                <SelectValue>{PRIORITY_LABELS[priority]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="0">{"\u2014"} None</SelectItem>
                <SelectItem value="1">! Low</SelectItem>
                <SelectItem value="2">!! Medium</SelectItem>
                <SelectItem value="3">!!! High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">due</span>
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">location</span>
            <div className="relative">
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
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() =>
                  setTimeout(() => setShowLocationSuggestions(false), 150)
                }
                className="h-7 text-xs"
              />
              {showLocationSuggestions && filteredLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
                  {filteredLocations.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setLocation(l);
                        setShowLocationSuggestions(false);
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
            <span className="text-xs text-muted-foreground">meeting</span>
            <div className="flex items-center gap-1">
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

          {mode === "edit" && task?.createdAt && (
            <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2">
              <span className="text-xs text-muted-foreground">created</span>
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {formatDate(new Date(task.createdAt))}
              </span>
            </div>
          )}
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
      </div>
    </>
  );
}
