import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getRoot, ParagraphNode, TextNode, type Klass, type LexicalNode } from "lexical";

import { createMarkdownTableTransformer } from "./markdownTableTransformer";

export const MARKDOWN_WYSIWYG_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  ParagraphNode,
  TextNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
];

const MARKDOWN_WYSIWYG_BASE_TRANSFORMERS: Transformer[] = [...TRANSFORMERS, CHECK_LIST];

export const MARKDOWN_WYSIWYG_TRANSFORMERS: Transformer[] = [
  createMarkdownTableTransformer(() => MARKDOWN_WYSIWYG_TRANSFORMERS),
  ...MARKDOWN_WYSIWYG_BASE_TRANSFORMERS,
];

export function importMarkdownToEditorState(markdown: string): void {
  $convertFromMarkdownString(markdown, MARKDOWN_WYSIWYG_TRANSFORMERS);
}

export function exportMarkdownFromEditorState(): string {
  return $convertToMarkdownString(MARKDOWN_WYSIWYG_TRANSFORMERS, $getRoot()).trimEnd();
}
