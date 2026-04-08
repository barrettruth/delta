import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskPanelReminders } from "@/components/task-panel-reminders";

describe("TaskPanelReminders", () => {
  it("renders a settings handoff when no reminder destinations exist", () => {
    const html = renderToStaticMarkup(
      createElement(TaskPanelReminders, {
        allDay: false,
        endpoints: [],
        reminders: [],
        loading: false,
        error: null,
        expanded: true,
        onExpandedChange: () => {},
        onAddReminder: () => {},
        onChangeReminder: () => {},
        onRemoveReminder: () => {},
      }),
    );

    expect(html).toContain("needs setup");
    expect(html).toContain("set up a reminder destination in settings first");
    expect(html).toContain("/settings/integrations");
    expect(html).toContain("open reminder settings");
  });
});
