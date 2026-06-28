import { createHeadlessEditor } from "@lexical/headless";
import { describe, expect, it } from "vitest";

import {
  exportMarkdownFromEditorState,
  importMarkdownToEditorState,
  MARKDOWN_WYSIWYG_NODES,
} from "./markdownWysiwygEditor";

describe("markdownWysiwygEditor", () => {
  it("round-trips basic markdown prose", () => {
    const input = "# Title\n\nParagraph with **bold** and a [link](https://example.com).\n";
    const editor = createHeadlessEditor({ nodes: [...MARKDOWN_WYSIWYG_NODES] });
    let output = "";
    editor.update(() => {
      importMarkdownToEditorState(input);
      output = exportMarkdownFromEditorState();
    });
    expect(output).toContain("# Title");
    expect(output).toContain("**bold**");
    expect(output).toContain("[link](https://example.com)");
  });

  it("preserves task list markers", () => {
    const input = "- [ ] open\n- [x] done\n";
    const editor = createHeadlessEditor({ nodes: [...MARKDOWN_WYSIWYG_NODES] });
    let output = "";
    editor.update(() => {
      importMarkdownToEditorState(input);
      output = exportMarkdownFromEditorState();
    });
    expect(output).toContain("[ ]");
    expect(output).toContain("[x]");
  });

  it("round-trips GFM tables with inline formatting and links", () => {
    const input = [
      "| Upstream | Repo | When to pull |",
      "| --- | --- | --- |",
      "| **First** (direct) | [Synara](https://github.com/Emanuele-web04/synara) | UI features |",
      "| Second | T3Code | Server work |",
      "",
    ].join("\n");
    const editor = createHeadlessEditor({ nodes: [...MARKDOWN_WYSIWYG_NODES] });
    let output = "";
    editor.update(() => {
      importMarkdownToEditorState(input);
      output = exportMarkdownFromEditorState();
    });
    expect(output).toContain("| Upstream | Repo | When to pull |");
    expect(output).toContain("| --- | --- | --- |");
    expect(output).toContain("**First**");
    expect(output).toContain("[Synara](https://github.com/Emanuele-web04/synara)");
    expect(output).toContain("| Second | T3Code | Server work |");
  });
});
