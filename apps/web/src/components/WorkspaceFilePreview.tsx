// FILE: WorkspaceFilePreview.tsx
// Purpose: Shared single-file preview (code with syntax highlighting, markdown
//          WYSIWYG editing, images, PDFs) for workspace files plus absolute
//          local file references reused by editor and right-dock panes.
// Layer: Web chat presentation component
// Exports: WorkspaceFilePreview, isMarkdownPreviewablePath, isMarkdownWysiwygPath

import {
  isSupportedLocalImagePath,
  isSupportedLocalPdfPath,
  lowerCaseExtensionOf,
} from "@t3tools/shared/localPreviewFiles";
import {
  isLocalAbsolutePath,
  isWorkspaceRelativePathSafe,
  joinWorkspaceRelativePath,
} from "@t3tools/shared/path";
import { isScratchWorkspacePath } from "@t3tools/shared/threadWorkspace";
import { Debouncer } from "@tanstack/react-pacer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Component,
  Suspense,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { basenameOfPath } from "~/file-icons";
import { useTheme } from "~/hooks/useTheme";
import { getSelectionWithin, type ChatFileReference } from "~/lib/chatReferences";
import { resolveDiffThemeName, type DiffThemeName } from "~/lib/diffRendering";
import { formatFileCommentRange, type FileCommentSelection } from "~/lib/fileComments";
import { showFileReferenceContextMenu } from "~/lib/fileReferenceContextMenu";
import { PlusIcon } from "~/lib/icons";
import {
  isLocalPreviewGrantUsable,
  projectLocalPreviewGrantQueryOptions,
  projectReadFileQueryOptions,
} from "~/lib/projectReactQuery";
import {
  MAX_SYNTAX_HIGHLIGHT_INPUT_CHARS,
  cacheSyntaxHighlightedHtml,
  createSyntaxHighlightCacheKey,
  getCachedSyntaxHighlightedHtml,
  getSyntaxHighlighterPromise,
  getSyntaxLanguageForPath,
  highlightCodeToHtmlWithFallback,
} from "~/lib/syntaxHighlighting";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import ChatMarkdown from "./ChatMarkdown";
import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";
import { FileLineCommentBox } from "./chat/FileLineCommentBox";
import { PanelStateMessage } from "./chat/PanelStateMessage";
import { useFileLineCommenting } from "./chat/useFileLineCommenting";
import { WorkspaceFilePreviewHeader } from "./chat/WorkspaceFilePreviewHeader";
import { TranscriptSelectionAction } from "./chat/TranscriptSelectionAction";
import { useCodeSelectionAction } from "./chat/useCodeSelectionAction";
import { LocalImagePreview } from "./LocalImagePreview";
import { PdfFilePreview } from "./PdfFilePreview";
import { Skeleton } from "./ui/skeleton";

const MARKDOWN_PREVIEW_EXTENSIONS = new Set([".markdown", ".md", ".mdx"]);
const MARKDOWN_WYSIWYG_EXTENSIONS = new Set([".markdown", ".md"]);

export function isMarkdownPreviewablePath(filePath: string): boolean {
  const extension = lowerCaseExtensionOf(filePath);
  return extension !== null && MARKDOWN_PREVIEW_EXTENSIONS.has(extension);
}

export function isMarkdownWysiwygPath(filePath: string): boolean {
  const extension = lowerCaseExtensionOf(filePath);
  return extension !== null && MARKDOWN_WYSIWYG_EXTENSIONS.has(extension);
}

function readMarkdownWysiwygSelection(
  container: HTMLElement,
): Pick<ChatFileReference, "snippet"> | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const snippet = selection.toString().trim();
  if (snippet.length === 0) {
    return null;
  }
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) {
    return null;
  }
  if (!container.contains(anchorNode) || !container.contains(focusNode)) {
    return null;
  }
  return { snippet };
}

function parentDirectoryFromPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const separatorIndex = normalized.lastIndexOf("/");
  if (separatorIndex <= 0) {
    return null;
  }
  return normalized.slice(0, separatorIndex);
}

function markdownPreviewCwd(workspaceRoot: string | null, filePath: string): string | undefined {
  const parentDirectory = parentDirectoryFromPath(filePath);
  if (isLocalAbsolutePath(filePath)) {
    return parentDirectory ?? undefined;
  }
  if (!workspaceRoot) {
    return undefined;
  }
  if (!parentDirectory) {
    return workspaceRoot;
  }
  return joinWorkspaceRelativePath(workspaceRoot, parentDirectory);
}

class FilePreviewHighlightErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Above this the plain fallback skips per-line spans (and therefore line
// numbers) to keep the DOM small for huge files.
const MAX_PLAIN_NUMBERED_LINES = 20_000;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function PlainFileContents(props: { contents: string }) {
  // Wrap each line in a .line span (mirroring Shiki output) so the CSS
  // counter gutter applies. Built as an HTML string to avoid per-line React
  // nodes; the trailing \n stays inside each span so selection math and
  // clipboard copies keep working.
  const numberedHtml = useMemo(() => {
    if (props.contents.length === 0) {
      return null;
    }
    const lines = props.contents.split("\n");
    if (lines.length > MAX_PLAIN_NUMBERED_LINES) {
      return null;
    }
    return `<code>${lines
      .map((line, index) =>
        index === lines.length - 1
          ? `<span class="line">${escapeHtml(line)}</span>`
          : `<span class="line">${escapeHtml(line)}\n</span>`,
      )
      .join("")}</code>`;
  }, [props.contents]);

  if (numberedHtml !== null) {
    return (
      <pre
        className="editor-file-viewer__plain"
        aria-readonly="true"
        dangerouslySetInnerHTML={{ __html: numberedHtml }}
      />
    );
  }

  return (
    <pre className="editor-file-viewer__plain" aria-readonly="true">
      {props.contents}
    </pre>
  );
}

function SyntaxHighlightedFileContents(props: {
  path: string;
  contents: string;
  themeName: DiffThemeName;
}) {
  const language = useMemo(() => getSyntaxLanguageForPath(props.path), [props.path]);
  // The cache key hashes the whole file, so keep it off incidental re-renders
  // (selection state, diff-warming churn) and only recompute when inputs change.
  const cacheKey = useMemo(
    () => createSyntaxHighlightCacheKey(props.contents, language, props.themeName),
    [props.contents, language, props.themeName],
  );
  const cachedHighlightedHtml = getCachedSyntaxHighlightedHtml(cacheKey);

  if (cachedHighlightedHtml != null) {
    return (
      <div
        className="editor-file-viewer__highlight"
        data-syntax-highlighted="true"
        dangerouslySetInnerHTML={{ __html: cachedHighlightedHtml }}
      />
    );
  }

  // The uncached path lives in its own component: an early return above must
  // not change this component's hook order once the cache fills.
  return (
    <UncachedSyntaxHighlightedFileContents
      cacheKey={cacheKey}
      contents={props.contents}
      language={language}
      themeName={props.themeName}
    />
  );
}

function UncachedSyntaxHighlightedFileContents(props: {
  cacheKey: string;
  contents: string;
  language: string;
  themeName: DiffThemeName;
}) {
  const highlighter = use(getSyntaxHighlighterPromise(props.language));
  const highlightedHtml = useMemo(() => {
    return highlightCodeToHtmlWithFallback(
      highlighter,
      props.contents,
      props.language,
      props.themeName,
    );
  }, [highlighter, props.contents, props.language, props.themeName]);

  useEffect(() => {
    cacheSyntaxHighlightedHtml(props.cacheKey, highlightedHtml, props.contents);
  }, [props.cacheKey, highlightedHtml, props.contents]);

  return (
    <div
      className="editor-file-viewer__highlight"
      data-syntax-highlighted="true"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
}

// Memoized: its inputs (path, contents, themeName) are stable across the
// preview re-renders triggered by selection state and diff-warming, so the
// highlighted body (and its cache lookup) is skipped unless the file changes.
const FileContentsView = memo(function FileContentsView(props: {
  path: string;
  contents: string;
  themeName: DiffThemeName;
}) {
  const plain = <PlainFileContents contents={props.contents} />;
  if (props.contents.length === 0 || props.contents.length > MAX_SYNTAX_HIGHLIGHT_INPUT_CHARS) {
    return plain;
  }

  return (
    <FilePreviewHighlightErrorBoundary key={props.path} fallback={plain}>
      <Suspense fallback={plain}>
        <SyntaxHighlightedFileContents
          path={props.path}
          contents={props.contents}
          themeName={props.themeName}
        />
      </Suspense>
    </FilePreviewHighlightErrorBoundary>
  );
});

// Mimics indented code lines so the placeholder reads as a file body
// instead of a generic spinner block.
const FILE_PREVIEW_SKELETON_LINES = [
  { indent: 0, width: "w-5/12" },
  { indent: 0, width: "w-8/12" },
  { indent: 1, width: "w-10/12" },
  { indent: 1, width: "w-7/12" },
  { indent: 2, width: "w-9/12" },
  { indent: 2, width: "w-4/12" },
  { indent: 1, width: "w-6/12" },
  { indent: 0, width: "w-3/12" },
  { indent: 0, width: "w-7/12" },
  { indent: 1, width: "w-9/12" },
  { indent: 1, width: "w-5/12" },
  { indent: 0, width: "w-2/12" },
];

function FilePreviewLoadingState() {
  return (
    <div
      className="min-h-0 flex-1 space-y-2.5 overflow-hidden px-3 py-3"
      role="status"
      aria-label="正在加载文件..."
    >
      {FILE_PREVIEW_SKELETON_LINES.map((line) => (
        <div key={`${line.indent}-${line.width}`} className="flex h-3 items-center gap-2">
          <Skeleton className="h-2.5 w-5 shrink-0 rounded-full opacity-60" />
          <Skeleton
            className={cn("h-2.5 rounded-full", line.width)}
            style={{ marginLeft: `${line.indent * 1}rem` }}
          />
        </div>
      ))}
      <span className="sr-only">正在加载文件...</span>
    </div>
  );
}

export interface WorkspaceFilePreviewProps {
  workspaceRoot: string | null;
  /**
   * Workspace-relative path of the previewed file. Binary previews (images,
   * PDFs) may instead be absolute paths outside the workspace — e.g. a
   * session's scratch directory — served by the local-image route, which never
   * touch the workspace-relative file-read RPC.
   */
  filePath: string | null;
  /** Shown when no file is selected yet. */
  emptyState?: ReactNode;
  onReferenceInChat?: ((reference: ChatFileReference) => void) | undefined;
  onAskWhyInChat?: ((reference: ChatFileReference) => void) | undefined;
  onCommentInChat?: ((comment: FileCommentSelection) => void) | undefined;
}

export function WorkspaceFilePreview(props: WorkspaceFilePreviewProps) {
  const { resolvedTheme } = useTheme();
  const diffThemeName = resolveDiffThemeName(resolvedTheme);
  const contentsRef = useRef<HTMLDivElement>(null);
  const markdownWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestMarkdownWriteVersionRef = useRef({ next: 0, byFile: new Map<string, number>() });
  const { filePath, onAskWhyInChat, onCommentInChat, onReferenceInChat, workspaceRoot } = props;
  const queryClient = useQueryClient();
  const fileIsImage = filePath !== null && isSupportedLocalImagePath(filePath);
  const fileIsPdf = filePath !== null && isSupportedLocalPdfPath(filePath);
  const fileIsLocalAbsolute = filePath !== null && isLocalAbsolutePath(filePath);
  const fileIsWorkspaceRelative = filePath !== null && isWorkspaceRelativePathSafe(filePath);
  const fileIsScratchBinaryPreview =
    filePath !== null && (fileIsImage || fileIsPdf) && isScratchWorkspacePath(filePath);
  const fileNeedsLocalPreviewGrant =
    filePath !== null && fileIsLocalAbsolute && !fileIsScratchBinaryPreview;
  const fileIsMarkdown = filePath !== null && isMarkdownPreviewablePath(filePath);
  const fileIsMarkdownWysiwyg = filePath !== null && isMarkdownWysiwygPath(filePath);
  const localPreviewGrantQuery = useQuery(
    projectLocalPreviewGrantQueryOptions({
      path: filePath,
      enabled: fileNeedsLocalPreviewGrant,
    }),
  );
  const localPreviewGrant =
    fileNeedsLocalPreviewGrant && isLocalPreviewGrantUsable(localPreviewGrantQuery.data)
      ? (localPreviewGrantQuery.data?.grant ?? null)
      : null;
  const fileQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: props.workspaceRoot,
      relativePath: filePath,
      previewGrant: localPreviewGrant,
      // Images and PDFs are binary: they stream through the local-image HTTP
      // route instead of the text file-read RPC.
      enabled:
        filePath !== null &&
        !fileIsImage &&
        !fileIsPdf &&
        (props.workspaceRoot !== null || localPreviewGrant !== null),
    }),
  );
  const fileContents = fileQuery.data?.contents ?? "";
  const fileIsTruncated = fileQuery.data?.truncated ?? false;
  const canEditMarkdownWysiwyg =
    fileIsMarkdownWysiwyg &&
    props.workspaceRoot !== null &&
    fileIsWorkspaceRelative &&
    fileQuery.data !== undefined &&
    !fileIsTruncated;
  const showMarkdownWysiwyg = canEditMarkdownWysiwyg;
  const showMarkdownReadOnly = fileIsMarkdown && !showMarkdownWysiwyg;
  const lineCount = useMemo(
    () => (fileContents.length === 0 ? 0 : fileContents.split("\n").length),
    [fileContents],
  );
  const readPreviewSelection = useCallback(
    (container: HTMLElement): Omit<ChatFileReference, "path"> | null => {
      if (showMarkdownWysiwyg) {
        return readMarkdownWysiwygSelection(container);
      }
      if (showMarkdownReadOnly) {
        return null;
      }
      return getSelectionWithin(container);
    },
    [showMarkdownReadOnly, showMarkdownWysiwyg],
  );
  const commitPreviewSelection = useCallback(
    (selection: Omit<ChatFileReference, "path">) => {
      if (filePath) {
        onReferenceInChat?.({ path: filePath, ...selection });
      }
    },
    [onReferenceInChat, filePath],
  );
  const previewSelectionAction = useCodeSelectionAction({
    enabled: Boolean(onReferenceInChat && filePath) && (showMarkdownWysiwyg || !fileIsMarkdown),
    readSelection: readPreviewSelection,
    onCommit: commitPreviewSelection,
  });
  const lineCommentingEnabled = Boolean(onCommentInChat && filePath) && !fileIsMarkdown;
  const lineCommenting = useFileLineCommenting({
    enabled: lineCommentingEnabled,
    resetKey: filePath,
  });
  const commitLineComment = useCallback(
    (selection: Pick<FileCommentSelection, "startLine" | "endLine" | "text">) => {
      if (filePath) {
        onCommentInChat?.({ path: filePath, ...selection });
      }
    },
    [filePath, onCommentInChat],
  );
  const handleContentsContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!filePath) {
        return;
      }
      event.preventDefault();
      const container = contentsRef.current;
      const selection = container ? readPreviewSelection(container) : null;
      void showFileReferenceContextMenu({
        path: filePath,
        position: { x: event.clientX, y: event.clientY },
        selection,
        onReferenceInChat,
        onAskWhyInChat,
      });
    },
    [onAskWhyInChat, onReferenceInChat, filePath, readPreviewSelection],
  );
  const persistMarkdownContents = useCallback(
    (nextContents: string) => {
      if (!workspaceRoot || !filePath || !fileQuery.data || fileQuery.data.truncated) {
        return;
      }
      const options = projectReadFileQueryOptions({ cwd: workspaceRoot, relativePath: filePath });
      const api = readNativeApi();
      if (!api) {
        return;
      }
      queryClient.setQueryData(options.queryKey, { ...fileQuery.data, contents: nextContents });
      const writeRelativePath = fileQuery.data.relativePath;
      const fileKey = `${workspaceRoot}\0${filePath}`;
      const writeVersion = latestMarkdownWriteVersionRef.current.next + 1;
      latestMarkdownWriteVersionRef.current.next = writeVersion;
      latestMarkdownWriteVersionRef.current.byFile.set(fileKey, writeVersion);
      markdownWriteQueueRef.current = markdownWriteQueueRef.current
        .catch(() => undefined)
        .then(() =>
          api.projects.writeFile({
            cwd: workspaceRoot,
            relativePath: writeRelativePath,
            contents: nextContents,
          }),
        )
        .then(() => undefined)
        .catch(() => {
          if (latestMarkdownWriteVersionRef.current.byFile.get(fileKey) !== writeVersion) {
            return;
          }
          void queryClient.invalidateQueries({ queryKey: options.queryKey });
        });
      void markdownWriteQueueRef.current;
    },
    [filePath, fileQuery.data, queryClient, workspaceRoot],
  );

  const markdownSaveDebouncer = useMemo(
    () =>
      new Debouncer(
        (nextContents: string) => {
          persistMarkdownContents(nextContents);
        },
        { wait: 600 },
      ),
    [persistMarkdownContents],
  );

  useEffect(() => {
    return () => {
      markdownSaveDebouncer.cancel();
    };
  }, [markdownSaveDebouncer]);

  const handleMarkdownWysiwygChange = useCallback(
    (nextContents: string) => {
      if (!canEditMarkdownWysiwyg) {
        return;
      }
      const options = projectReadFileQueryOptions({
        cwd: props.workspaceRoot,
        relativePath: filePath,
      });
      const current = queryClient.getQueryData(options.queryKey);
      if (!current || current.truncated || current.contents === nextContents) {
        return;
      }
      queryClient.setQueryData(options.queryKey, { ...current, contents: nextContents });
      markdownSaveDebouncer.maybeExecute(nextContents);
    },
    [canEditMarkdownWysiwyg, filePath, markdownSaveDebouncer, props.workspaceRoot, queryClient],
  );

  if (!props.workspaceRoot && !fileIsLocalAbsolute && !fileIsScratchBinaryPreview) {
    return (
      <PanelStateMessage density="compact" fill="flex">
        <p>当前聊天未关联工作区。</p>
      </PanelStateMessage>
    );
  }

  if (!filePath) {
    return (
      props.emptyState ?? (
        <PanelStateMessage density="compact" fill="flex">
          <p>从文件浏览器中选择一个文件。</p>
        </PanelStateMessage>
      )
    );
  }
  if (fileNeedsLocalPreviewGrant && !localPreviewGrant) {
    if (localPreviewGrantQuery.error) {
      return (
        <PanelStateMessage density="compact" fill="flex" className="items-start justify-start p-3">
          <p className="text-left text-[11px] text-destructive/85">
            {localPreviewGrantQuery.error instanceof Error
              ? localPreviewGrantQuery.error.message
              : "Could not create local file preview grant."}
          </p>
        </PanelStateMessage>
      );
    }
    return <FilePreviewLoadingState />;
  }

  // PDFs own their full surface — toolbar (file name, page nav, zoom, Open) plus
  // the rendered page stack — so they skip the shared breadcrumb header here.
  if (fileIsPdf) {
    const openInTarget =
      props.workspaceRoot && isWorkspaceRelativePathSafe(filePath)
        ? joinWorkspaceRelativePath(props.workspaceRoot, filePath)
        : filePath;
    return (
      <PdfFilePreview
        filePath={filePath}
        cwd={props.workspaceRoot}
        previewGrant={localPreviewGrant}
        openInTarget={openInTarget}
      />
    );
  }

  const hoveredCommentLine = lineCommenting.hoveredLine;
  const activeCommentLine = lineCommenting.activeLine;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-background-surface)]">
      <WorkspaceFilePreviewHeader
        workspaceRoot={props.workspaceRoot}
        filePath={filePath}
        onReferenceInChat={onReferenceInChat}
        onAskWhyInChat={onAskWhyInChat}
        truncated={fileIsTruncated}
      />
      {fileIsImage ? (
        <div
          className="editor-file-viewer min-h-0 flex-1 overflow-auto"
          onContextMenu={handleContentsContextMenu}
        >
          <LocalImagePreview
            src={filePath}
            cwd={props.workspaceRoot}
            previewGrant={localPreviewGrant}
            alt={basenameOfPath(filePath)}
            className="min-h-full"
            imageClassName="max-h-[calc(100vh-13rem)]"
          />
        </div>
      ) : fileQuery.isLoading ? (
        <FilePreviewLoadingState />
      ) : fileQuery.error ? (
        <PanelStateMessage density="compact" fill="flex" className="items-start justify-start p-3">
          <p className="text-left text-[11px] text-destructive/85">
            {fileQuery.error instanceof Error ? fileQuery.error.message : "Could not read file."}
          </p>
        </PanelStateMessage>
      ) : (
        <div
          ref={contentsRef}
          className={cn(
            "editor-file-viewer min-h-0 flex-1 overflow-auto",
            (showMarkdownWysiwyg || showMarkdownReadOnly) && "editor-file-viewer--markdown-preview",
          )}
          onContextMenu={handleContentsContextMenu}
          onMouseUp={previewSelectionAction.onContainerMouseUp}
          onMouseMove={lineCommenting.onContainerMouseMove}
          onMouseLeave={lineCommenting.onContainerMouseLeave}
        >
          {showMarkdownWysiwyg ? (
            <MarkdownWysiwygEditor
              fileKey={filePath}
              markdown={fileContents}
              editable
              className="editor-markdown-preview__body text-sm leading-relaxed"
              onMarkdownChange={handleMarkdownWysiwygChange}
            />
          ) : showMarkdownReadOnly ? (
            <div className="editor-markdown-preview">
              <ChatMarkdown
                text={fileContents}
                cwd={markdownPreviewCwd(props.workspaceRoot, filePath)}
                isStreaming={false}
                className="editor-markdown-preview__body text-sm leading-relaxed"
              />
            </div>
          ) : (
            <FileContentsView path={filePath} contents={fileContents} themeName={diffThemeName} />
          )}
          {!fileIsMarkdown && lineCount > 0 ? (
            <span className="sr-only">{lineCount} lines</span>
          ) : null}
          {previewSelectionAction.pendingAction ? (
            <TranscriptSelectionAction
              left={previewSelectionAction.pendingAction.left}
              top={previewSelectionAction.pendingAction.top}
              placement={previewSelectionAction.pendingAction.placement}
              onAddToChat={previewSelectionAction.commit}
            />
          ) : null}
          {lineCommentingEnabled && hoveredCommentLine && !activeCommentLine ? (
            <button
              type="button"
              className="editor-file-viewer__comment-add"
              style={{
                top: hoveredCommentLine.top,
                left: hoveredCommentLine.left,
                height: hoveredCommentLine.height,
              }}
              aria-label={`在第 ${hoveredCommentLine.lineNumber} 行评论`}
              title="评论"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                lineCommenting.openComment(hoveredCommentLine);
              }}
            >
              <span className="editor-file-viewer__comment-add-glyph">
                <PlusIcon className="size-3.5" />
              </span>
            </button>
          ) : null}
          {lineCommentingEnabled && activeCommentLine ? (
            <>
              <div
                className="editor-file-viewer__comment-line-highlight"
                style={{ top: activeCommentLine.top, height: activeCommentLine.height }}
                aria-hidden="true"
              />
              <FileLineCommentBox
                lineLabel={formatFileCommentRange({
                  startLine: activeCommentLine.lineNumber,
                  endLine: activeCommentLine.lineNumber,
                })}
                top={activeCommentLine.top + activeCommentLine.height}
                left={activeCommentLine.left}
                width={Math.max(
                  240,
                  Math.min(440, activeCommentLine.containerWidth - activeCommentLine.left - 16),
                )}
                onCancel={lineCommenting.closeComment}
                onSubmit={(text) => {
                  commitLineComment({
                    startLine: activeCommentLine.lineNumber,
                    endLine: activeCommentLine.lineNumber,
                    text,
                  });
                  lineCommenting.closeComment();
                }}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
