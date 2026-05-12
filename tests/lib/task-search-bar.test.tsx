import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskSearchBar } from "@/components/task-search-bar";

describe("TaskSearchBar", () => {
  it("renders the compact search input and result count", () => {
    const markup = renderToStaticMarkup(
      <TaskSearchBar
        className="px-3 border-border"
        inputRef={createRef<HTMLInputElement>()}
        onInputKeyDown={() => {}}
        onQueryChange={() => {}}
        query="ops"
        resultCount={2}
        slashClassName="text-primary font-bold"
        totalCount={5}
      />,
    );

    expect(markup).toContain("filter tasks...");
    expect(markup).toContain("2/5");
    expect(markup).toContain("border-border");
    expect(markup).toContain("text-primary");
    expect(markup).toContain('value="ops"');
  });
});
