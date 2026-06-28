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
import { $getRoot, ParagraphNode, TextNode, type Klass, type LexicalNode } from "lexical";

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
];

export const MARKDOWN_WYSIWYG_TRANSFORMERS: Transformer[] = [...TRANSFORMERS, CHECK_LIST];

export function importMarkdownToEditorState(markdown: string): void {
  $convertFromMarkdownString(markdown, MARKDOWN_WYSIWYG_TRANSFORMERS);
}

export function exportMarkdownFromEditorState(): string {
  return $convertToMarkdownString(MARKDOWN_WYSIWYG_TRANSFORMERS, $getRoot()).trimEnd();
}
