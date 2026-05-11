"use client";

import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import type { RecurrenceDeleteController } from "@/hooks/use-recurrence-delete";

export function TaskOperationDialogs({
  recurrenceDelete,
}: {
  recurrenceDelete: RecurrenceDeleteController;
}) {
  return (
    <RecurrenceStrategyDialog
      open={!!recurrenceDelete.pending}
      onOpenChange={(open) => {
        if (!open) recurrenceDelete.cancel();
      }}
      mode="delete"
      onSelect={(strategy) => {
        recurrenceDelete.executeStrategy(strategy);
      }}
    />
  );
}
