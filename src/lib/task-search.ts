export interface SearchableTask {
  description: string;
  category?: string | null;
}

export function filterTasksByQuery<T extends SearchableTask>(
  tasks: T[],
  query: string,
): T[] {
  if (!query) return tasks;

  const q = query.toLowerCase();
  return tasks.filter(
    (task) =>
      task.description.toLowerCase().includes(q) ||
      task.category?.toLowerCase().includes(q),
  );
}

export function formatTaskSearchCount(
  resultCount: number,
  totalCount: number,
): string {
  return `${resultCount}/${totalCount}`;
}
