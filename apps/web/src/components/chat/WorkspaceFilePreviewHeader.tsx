// FILE: WorkspaceFilePreviewHeader.tsx
// Purpose: Editor-style header for the shared workspace file preview — a path
//          breadcrumb (project › …dirs › file) on the left, and an overflow
//          menu + "Open in editor" split button on the right. Shared by the
//          right-dock file/explorer panes and the editor center pane so every
//          surface reads identically. The header is a `header-actions` inline-size
//          query container, so the breadcrumb collapses dir-first then truncates
//          the filename, and the controls shed their text labels for icons as the
//          pane narrows — no overlap at any width.
// Layer: Chat/editor file-preview UI
// Exports: WorkspaceFilePreviewHeader

import { isWorkspaceRelativePathSafe, joinWorkspaceRelativePath } from "@t3tools/shared/path";
import { Fragment, memo, useCallback, useMemo } from "react";

import { basenameOfPath } from "~/file-icons";
import type { ChatFileReference } from "~/lib/chatReferences";
import { ChevronRightIcon, EllipsisIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { Menu, MenuItem, MenuTrigger } from "../ui/menu";
import { CHAT_SURFACE_HEADER_DIVIDER_CLASS_NAME, ChatHeaderIconButton } from "./chatHeaderControls";
import { ComposerPickerMenuPopup } from "./ComposerPickerMenuPopup";
import { OpenInPicker } from "./OpenInPicker";

interface WorkspaceFilePreviewHeaderProps {
  workspaceRoot: string | null;
  filePath: string;
  /** Whole-file chat actions, surfaced in the overflow menu when wired. */
  onReferenceInChat?: ((reference: ChatFileReference) => void) | undefined;
  onAskWhyInChat?: ((reference: ChatFileReference) => void) | undefined;
  /** Shown when the preview only holds a partial read of a large file. */
  truncated?: boolean;
}

export const WorkspaceFilePreviewHeader = memo(function WorkspaceFilePreviewHeader(
  props: WorkspaceFilePreviewHeaderProps,
) {
  const { filePath, workspaceRoot } = props;

  const fileIsOutsideWorkspace = !isWorkspaceRelativePathSafe(filePath);

  const { prefixSegments, fileSegment } = useMemo(() => {
    const projectName =
      fileIsOutsideWorkspace || !workspaceRoot ? null : basenameOfPath(workspaceRoot);
    const relativeSegments = filePath
      .replace(/\\/g, "/")
      .split("/")
      .filter((segment) => segment.length > 0);
    const segments = projectName ? [projectName, ...relativeSegments] : relativeSegments;
    const prefix = segments.slice(0, -1).map((name, index) => ({
      name,
      key: segments.slice(0, index + 1).join("/"),
    }));
    return {
      prefixSegments: prefix,
      fileSegment: segments.at(-1) ?? filePath,
    };
  }, [fileIsOutsideWorkspace, filePath, workspaceRoot]);

  const { onReferenceInChat, onAskWhyInChat } = props;
  const referenceWholeFile = useCallback(() => {
    onReferenceInChat?.({ path: filePath });
  }, [filePath, onReferenceInChat]);
  const askWhyWholeFile = useCallback(() => {
    onAskWhyInChat?.({ path: filePath });
  }, [filePath, onAskWhyInChat]);

  const hasChatActions = Boolean(onReferenceInChat || onAskWhyInChat);

  return (
    <div
      className={cn(
        "@container/header-actions flex h-10 w-full shrink-0 items-center gap-2 px-3",
        CHAT_SURFACE_HEADER_DIVIDER_CLASS_NAME,
      )}
    >
      <nav
        aria-label="文件路径"
        className="flex min-w-0 flex-1 items-center text-[12px] leading-none"
      >
        <span className="flex min-w-0 shrink-[9999] items-center overflow-hidden">
          {prefixSegments.map((segment) => (
            <Fragment key={segment.key}>
              <span className="truncate text-muted-foreground/80">{segment.name}</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="mx-0.5 size-3 shrink-0 text-muted-foreground/40"
              />
            </Fragment>
          ))}
        </span>
        <span className="min-w-0 shrink truncate font-medium text-foreground" title={filePath}>
          {fileSegment}
        </span>
      </nav>

      {props.truncated ? (
        <span className="hidden shrink-0 text-[10px] text-muted-foreground/70 @sm/header-actions:inline">
          部分显示
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-1.5">
        {hasChatActions ? (
          <Menu>
            <MenuTrigger render={<ChatHeaderIconButton label="更多操作" tone="plain" />}>
              <EllipsisIcon aria-hidden="true" className="size-3.5" />
            </MenuTrigger>
            <ComposerPickerMenuPopup align="end" side="bottom" className="w-52 min-w-52">
              {onReferenceInChat ? (
                <MenuItem onClick={referenceWholeFile}>在聊天中引用</MenuItem>
              ) : null}
              {onAskWhyInChat ? <MenuItem onClick={askWhyWholeFile}>询问为何更改</MenuItem> : null}
            </ComposerPickerMenuPopup>
          </Menu>
        ) : null}

        <OpenInPicker
          openInTarget={
            fileIsOutsideWorkspace || !workspaceRoot
              ? filePath
              : joinWorkspaceRelativePath(workspaceRoot, filePath)
          }
        />
      </div>
    </div>
  );
});
