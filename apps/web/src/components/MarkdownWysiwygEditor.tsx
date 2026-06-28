// FILE: MarkdownWysiwygEditor.tsx
// Purpose: WYSIWYG markdown editor for workspace file previews using Lexical.
// Layer: Web editor component
// Exports: MarkdownWysiwygEditor

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { type EditorState } from "lexical";
import { memo, useCallback } from "react";

import {
  exportMarkdownFromEditorState,
  importMarkdownToEditorState,
  MARKDOWN_WYSIWYG_NODES,
  MARKDOWN_WYSIWYG_TRANSFORMERS,
} from "~/lib/markdownWysiwygEditor";
import { cn } from "~/lib/utils";

interface MarkdownWysiwygEditorProps {
  fileKey: string;
  markdown: string;
  editable: boolean;
  className?: string;
  onMarkdownChange: (markdown: string) => void;
}

function handleMarkdownEditorChange(
  editorState: EditorState,
  onMarkdownChange: (markdown: string) => void,
): void {
  editorState.read(() => {
    onMarkdownChange(exportMarkdownFromEditorState());
  });
}

export const MarkdownWysiwygEditor = memo(function MarkdownWysiwygEditor(
  props: MarkdownWysiwygEditorProps,
) {
  const { editable, fileKey, markdown, onMarkdownChange } = props;

  const handleChange = useCallback(
    (editorState: EditorState) => {
      handleMarkdownEditorChange(editorState, onMarkdownChange);
    },
    [onMarkdownChange],
  );

  return (
    <LexicalComposer
      key={fileKey}
      initialConfig={{
        namespace: "MarkdownWysiwygEditor",
        nodes: [...MARKDOWN_WYSIWYG_NODES],
        editable,
        editorState: () => {
          importMarkdownToEditorState(markdown);
        },
        onError(error) {
          throw error;
        },
        theme: {
          paragraph: "editor-markdown-wysiwyg__paragraph",
          heading: {
            h1: "editor-markdown-wysiwyg__h1",
            h2: "editor-markdown-wysiwyg__h2",
            h3: "editor-markdown-wysiwyg__h3",
            h4: "editor-markdown-wysiwyg__h4",
            h5: "editor-markdown-wysiwyg__h5",
            h6: "editor-markdown-wysiwyg__h6",
          },
          list: {
            ul: "editor-markdown-wysiwyg__ul",
            ol: "editor-markdown-wysiwyg__ol",
            listitem: "editor-markdown-wysiwyg__li",
            listitemChecked: "editor-markdown-wysiwyg__li-checked",
            listitemUnchecked: "editor-markdown-wysiwyg__li-unchecked",
          },
          quote: "editor-markdown-wysiwyg__quote",
          code: "editor-markdown-wysiwyg__code",
          text: {
            bold: "editor-markdown-wysiwyg__bold",
            italic: "editor-markdown-wysiwyg__italic",
            strikethrough: "editor-markdown-wysiwyg__strikethrough",
            underline: "editor-markdown-wysiwyg__underline",
            code: "editor-markdown-wysiwyg__inline-code",
          },
          link: "editor-markdown-wysiwyg__link",
        },
      }}
    >
      <div className={cn("editor-markdown-wysiwyg", props.className)}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="editor-markdown-wysiwyg__content"
              aria-label="Markdown 编辑器"
              spellCheck
            />
          }
          placeholder={<div className="editor-markdown-wysiwyg__placeholder">开始书写…</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <TablePlugin hasHorizontalScroll />
        <MarkdownShortcutPlugin transformers={MARKDOWN_WYSIWYG_TRANSFORMERS} />
        {editable ? <OnChangePlugin ignoreSelectionChange onChange={handleChange} /> : null}
      </div>
    </LexicalComposer>
  );
});
