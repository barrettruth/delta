"use client";

import { KanbanGrid } from "@/components/kanban/kanban-grid";
import { TaskOperationDialogs } from "@/components/task-operation-dialogs";
import { TaskSearchBar } from "@/components/task-search-bar";
import type { Task } from "@/core/types";
import { useKanbanBoardController } from "@/hooks/use-kanban-board-controller";

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const controller = useKanbanBoardController({ tasks });

  return (
    <div className="flex flex-col h-full w-full">
      {controller.search.active && (
        <TaskSearchBar
          className="px-4 border-border/60 shrink-0"
          inputRef={controller.search.searchRef}
          onInputKeyDown={controller.search.handleInputKeyDown}
          onQueryChange={controller.search.setQuery}
          query={controller.search.query}
          resultCount={controller.search.resultCount}
          slashClassName="text-muted-foreground"
          totalCount={controller.search.totalCount}
        />
      )}
      <KanbanGrid {...controller.grid} />
      <TaskOperationDialogs recurrenceDelete={controller.recurrenceDelete} />
    </div>
  );
}
