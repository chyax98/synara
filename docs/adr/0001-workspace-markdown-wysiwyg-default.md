---
status: accepted
---

# Workspace markdown opens in WYSIWYG by default

Synara has two markdown surfaces: the chat transcript (`ChatMarkdown`, react-markdown + remark-gfm) and workspace file preview. For in-workspace `.md` / `.markdown` files that are not truncated, we open `MarkdownWysiwygEditor` (Lexical) immediately — no read-only preview step and no separate “edit mode” toggle.

We considered defaulting file preview to lightweight read-only render and only mounting WYSIWYG on demand. That would shave main-thread cost when users only glance at docs, but Synara’s dominant markdown pressure is streaming assistant output in `MessagesTimeline` (already coalesced with `useDeferredValue` and virtualized rows). File WYSIWYG is occasional and UI-local, so the extra Lexical cost is acceptable for the common “open AGENTS.md and fix a table” flow.

**Boundaries**

- WYSIWYG: `.md`, `.markdown` in workspace, full file, debounced auto-save via `projects.writeFile`.
- Read-only `ChatMarkdown`: `.mdx`, truncated files, paths outside workspace.
- Chat messages always use `ChatMarkdown`; they are not edited through Lexical.

**GFM tables**

Lexical `TRANSFORMERS` recognize `| ... |` lines for line-merging only. GFM table import/export uses a playground-style `TABLE` element transformer in `markdownTableTransformer.ts` with `@lexical/table`.

**Known limitations (accepted for now)**

- WYSIWYG does not cover images, math (KaTeX), or MDX components; chat rendering remains the richer path for those.
- Markdown round-trip may normalize whitespace and table divider formatting.
- All markdown rendering runs on the browser main thread; only diff rendering uses workers.