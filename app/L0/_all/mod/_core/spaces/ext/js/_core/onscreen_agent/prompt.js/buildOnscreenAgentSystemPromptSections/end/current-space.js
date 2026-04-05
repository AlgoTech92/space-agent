import { SPACES_ROUTE_PATH } from "/mod/_core/spaces/constants.js";

function buildCurrentSpaceSnapshot(currentSpace) {
  const widgets = Array.isArray(currentSpace?.widgets)
    ? currentSpace.widgets.map((widget, index) => ({
        id: widget.id,
        name: widget.name,
        order: index,
        position: {
          col: widget.position?.col ?? widget.col ?? 0,
          row: widget.position?.row ?? widget.row ?? 0
        },
        renderedSize: {
          cols: widget.renderedSize?.cols ?? widget.cols ?? 0,
          rows: widget.renderedSize?.rows ?? widget.rows ?? 0
        },
        size: {
          cols: widget.size?.cols ?? widget.cols ?? 0,
          rows: widget.size?.rows ?? widget.rows ?? 0
        },
        state: widget.state || (widget.minimized ? "minimized" : "expanded")
      }))
    : [];

  return {
    agentInstructions: currentSpace?.agentInstructions ?? currentSpace?.specialInstructions ?? "",
    icon: currentSpace?.icon || "",
    iconColor: currentSpace?.iconColor || "",
    id: currentSpace?.id || "",
    title: currentSpace?.title || "",
    updatedAt: currentSpace?.updatedAt || "",
    widgetCount: widgets.length,
    widgets
  };
}

function buildCurrentSpaceAgentInstructionsPromptSection(snapshot) {
  const normalizedAgentInstructions = String(snapshot?.agentInstructions || "").trim();

  if (!normalizedAgentInstructions) {
    return "";
  }

  return [
    "## Current Space Agent Instructions",
    "",
    "These instructions apply only while this routed space remains open:",
    "",
    normalizedAgentInstructions
  ].join("\n");
}

function buildCurrentSpacePromptSection(snapshot) {
  const { agentInstructions, ...snapshotForPrompt } = snapshot;
  const lines = [
    "## Current Open Space",
    "",
    "The routed spaces canvas is currently open with this live widget state:"
  ];

  lines.push(
    "",
    "```json",
    JSON.stringify(snapshotForPrompt, null, 2),
    "```",
    "",
    "Current-space widget helpers:",
    "- `return await space.current.readWidget(\"widget-id-or-name\")`",
    "- `return await space.current.patchWidget(\"widget-id\", { name?, cols?, rows?, col?, row?, edits? })`",
    "- `return await space.current.renderWidget({ id, name, cols, rows, renderer })`",
    "- `return await space.current.rearrangeWidgets([{ id, col, row, cols, rows }, ...])`",
    "- `return await space.current.toggleWidgets([\"widget-id\", ...])`",
    "- `return await space.current.removeWidgets([\"widget-id\", ...])`",
    "- `return await space.current.removeAllWidgets()`",
    "",
    "Rules:",
    "- Widget size is capped at `24x24`; do not request larger `cols` or `rows` values.",
    "- When the user asks to patch, tweak, fix, or slightly modify an existing widget, default to `readWidget(...)` then `patchWidget(...)` instead of rewriting the full widget.",
    "- Do not read widget YAML directly through file APIs when `readWidget(...)` can provide the numbered source you need for patching.",
    "- Do not use `renderWidget(...)` for an existing widget unless the user explicitly wants a full rewrite or the change is broad enough that a patch would be less clear.",
    "- `readWidget(...)` returns plain metadata lines first, then `renderer:`, then zero-based numbered renderer lines such as `0 async (parent, currentSpace) => {`.",
    "- `patchWidget(...)` only edits the numbered renderer lines. Use `name`, `cols`, `rows`, `col`, or `row` inputs for metadata changes.",
    "- `patchWidget(...)` applies `edits: [{ from, to?, content? }]` against the most recent renderer line numbers from `readWidget(...)`: `from` and `to` are inclusive, omit `to` to insert before `from`, omit `content` on a ranged edit to delete, do not overlap edits, and do not renumber later edits after inserts or deletes.",
    "- In patch content, replace only the exact changed lines, do not include surrounding unchanged lines, and keep brackets or tags or function blocks syntactically complete.",
    "- Prefer renderer signatures like `async (parent, currentSpace) => { ... }`; do not shadow the global `space` runtime with a renderer parameter named `space`.",
    "- After `renderWidget(...)` or `patchWidget(...)`, use the returned `widgetText` field as the fresh numbered readback before making another patch.",
    "- `rearrangeWidgets(...)` uses the provided list order as the requested widget order; widgets you omit keep their relative order after the listed ones.",
    "- `toggleWidgets(...)` flips each listed widget between `expanded` and `minimized`.",
    "- Use widget ids from the snapshot above and `return await ...` when you need confirmation of a mutation."
  );

  return lines.join("\n");
}

export default function injectCurrentSpacePromptSection(hookContext) {
  const promptContext = hookContext?.result;

  if (!promptContext || !Array.isArray(promptContext.sections)) {
    return;
  }

  if (globalThis.space?.router?.current?.path !== SPACES_ROUTE_PATH) {
    return;
  }

  const currentSpace = globalThis.space?.current;

  if (!currentSpace?.id) {
    return;
  }

  const currentSpaceSnapshot = buildCurrentSpaceSnapshot(currentSpace);
  const currentSpaceAgentInstructionsPromptSection =
    buildCurrentSpaceAgentInstructionsPromptSection(currentSpaceSnapshot);
  const currentSpacePromptSection = buildCurrentSpacePromptSection(currentSpaceSnapshot);
  const promptSections = [currentSpaceAgentInstructionsPromptSection, currentSpacePromptSection].filter(Boolean);
  const sections = [...promptContext.sections];
  const skillsSectionIndex = promptContext.skillsSection ? sections.indexOf(promptContext.skillsSection) : -1;
  const insertIndex = skillsSectionIndex >= 0 ? skillsSectionIndex : sections.length;

  sections.splice(insertIndex, 0, ...promptSections);
  promptContext.currentSpaceAgentInstructionsPromptSection = currentSpaceAgentInstructionsPromptSection;
  promptContext.currentSpacePromptSection = currentSpacePromptSection;
  promptContext.sections = sections;
}
