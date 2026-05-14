"use client";

import { TaskSourceDetails } from "@/components/task-source-indicator";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_LABELS } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import type { TaskPreFill } from "@/lib/calendar-utils";
import type { TaskPanelFormController } from "./use-task-panel-form";

type TaskPanelMode = "edit" | "create";

export function TaskPanelFields({
  form,
  mode,
  onStatusChange,
  onReadOnlyAttempt,
  preFill,
  task,
}: {
  form: TaskPanelFormController;
  mode: TaskPanelMode;
  onStatusChange: (status: string) => void;
  onReadOnlyAttempt: () => void;
  preFill: TaskPreFill | null;
  task: Task | null;
}) {
  const categorySuggestions = form.categorySuggestions;
  const locationSuggestions = form.locationSuggestions;
  const isReadOnly = mode === "edit" && task?.sourceInfo?.readOnly === true;

  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border/40">
      {mode === "edit" && task && (
        <TaskSourceDetails source={task.sourceInfo} />
      )}

      {mode === "edit" && task && (
        <>
          <span className="text-xs text-muted-foreground/60">status</span>
          <Select
            value={task.status}
            onValueChange={(value) => {
              if (!value) return;
              if (isReadOnly) {
                onReadOnlyAttempt();
                return;
              }
              onStatusChange(value);
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-7 text-xs w-full"
              onPointerDown={isReadOnly ? onReadOnlyAttempt : undefined}
            >
              <SelectValue>
                {TASK_STATUS_LABELS[task.status as TaskStatus]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <span className="text-xs text-muted-foreground/60">category</span>
      <div className="relative">
        <Input
          value={form.values.category}
          onChange={(event) => {
            if (isReadOnly) {
              onReadOnlyAttempt();
              return;
            }
            form.setCategory(event.target.value);
            categorySuggestions.show();
          }}
          readOnly={isReadOnly}
          onFocus={isReadOnly ? onReadOnlyAttempt : categorySuggestions.show}
          onBlur={categorySuggestions.hideSoon}
          placeholder="#"
          className="h-7 text-xs"
        />
        {categorySuggestions.visible &&
          categorySuggestions.items.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
              {categorySuggestions.items.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    categorySuggestions.select(category);
                  }}
                >
                  {category}
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
          value={form.values.due}
          readOnly={isReadOnly}
          onChange={(event) => {
            if (isReadOnly) {
              onReadOnlyAttempt();
              return;
            }
            form.setDue(event.target.value);
          }}
          onFocus={isReadOnly ? onReadOnlyAttempt : undefined}
          className="h-7 text-xs w-1/2"
        />
        <Input
          value={form.recurrenceInputValue}
          onChange={(event) => {
            if (isReadOnly) {
              onReadOnlyAttempt();
              return;
            }
            form.setRecurrence(event.target.value || null);
          }}
          readOnly={isReadOnly}
          onFocus={isReadOnly ? onReadOnlyAttempt : form.handleRecurrenceFocus}
          onBlur={form.handleRecurrenceBlur}
          placeholder="enter recurrence..."
          disabled={mode === "edit" && !!task?.recurringTaskId}
          className="h-7 text-xs w-1/2"
        />
      </div>

      <span className="text-xs text-muted-foreground/60">location</span>
      <div className="relative">
        <Input
          value={form.locationInputValue}
          placeholder="address or meeting link"
          readOnly={isReadOnly}
          onChange={(event) => {
            if (isReadOnly) {
              onReadOnlyAttempt();
              return;
            }
            locationSuggestions.setFromInput(event.target.value);
          }}
          onFocus={isReadOnly ? onReadOnlyAttempt : locationSuggestions.show}
          onBlur={locationSuggestions.hideSoon}
          onKeyDown={locationSuggestions.handleKeyDown}
          className="h-7 text-xs"
        />
        {locationSuggestions.visible &&
          (locationSuggestions.filteredLocations.length > 0 ||
            locationSuggestions.results.length > 0 ||
            locationSuggestions.error) && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1 max-h-48 overflow-y-auto">
              {locationSuggestions.filteredLocations.map((location, index) => (
                <button
                  key={location}
                  type="button"
                  className={`w-full px-2 py-1 text-xs text-left transition-colors ${locationSuggestions.activeIndex === index ? "bg-accent" : "hover:bg-accent"}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    locationSuggestions.selectStored(location);
                  }}
                >
                  {location}
                </button>
              ))}
              {locationSuggestions.filteredLocations.length > 0 &&
                locationSuggestions.results.length > 0 && (
                  <div className="border-t border-border/40 my-1" />
                )}
              {locationSuggestions.results.map((result, index) => {
                const suggestionIndex =
                  locationSuggestions.filteredLocations.length + index;
                return (
                  <button
                    key={result.displayName}
                    type="button"
                    className={`w-full px-2 py-1 text-xs text-left transition-colors ${locationSuggestions.activeIndex === suggestionIndex ? "bg-accent" : "hover:bg-accent"}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      locationSuggestions.selectResult(result);
                    }}
                  >
                    {result.displayName}
                  </button>
                );
              })}
              {locationSuggestions.error && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {locationSuggestions.error}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

export function TaskPanelNotes({
  form,
  mode,
  onReadOnlyAttempt,
  task,
}: {
  form: TaskPanelFormController;
  mode: TaskPanelMode;
  onReadOnlyAttempt: () => void;
  task: Task | null;
}) {
  const isReadOnly = mode === "edit" && task?.sourceInfo?.readOnly === true;

  return (
    <div className="flex-1 min-h-0 overflow-auto px-4 pt-3 pb-4">
      <TiptapEditor
        key={mode === "edit" ? task?.id : "create"}
        content={mode === "edit" ? (task?.notes ?? null) : null}
        onChange={(value) => {
          if (isReadOnly) {
            onReadOnlyAttempt();
            return;
          }
          form.handleNotesChange(value);
        }}
        editable={!isReadOnly}
        onReadOnlyAttempt={onReadOnlyAttempt}
      />
    </div>
  );
}
