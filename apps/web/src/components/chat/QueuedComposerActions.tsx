// FILE: QueuedComposerActions.tsx
// Purpose: Inline action cluster (Steer / Delete / Menu) rendered on each queued
// composer row. Used in both the compact and expanded composer layouts so the
// action chrome stays in lockstep across surfaces.
// Layer: Chat composer UI primitive
// Exports: QueuedComposerActions

import { EllipsisIcon, SteerIcon, Trash2 } from "~/lib/icons";

import type { QueuedComposerTurn } from "../../composerDraftStore";

import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Menu, MenuItem, MenuTrigger } from "../ui/menu";
import { ComposerPickerMenuPopup } from "./ComposerPickerMenuPopup";

type QueuedComposerActionsProps = {
  queuedTurn: QueuedComposerTurn;
  onSteer: (queuedTurn: QueuedComposerTurn) => void;
  onRemove: (queuedTurnId: string) => void;
  onEdit: (queuedTurn: QueuedComposerTurn) => void;
};

function QueuedComposerActions({
  queuedTurn,
  onSteer,
  onRemove,
  onEdit,
}: QueuedComposerActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-0">
      <Button variant="subtle" size="chip" onClick={() => void onSteer(queuedTurn)}>
        <SteerIcon />
        <span>引导</span>
      </Button>
      <IconButton
        variant="ghost"
        size="icon-chip"
        label="删除排队中的后续消息"
        onClick={() => onRemove(queuedTurn.id)}
      >
        <Trash2 />
      </IconButton>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-chip"
              aria-label="排队的后续操作"
              className="[&_svg]:mx-0"
            />
          }
        >
          <EllipsisIcon />
        </MenuTrigger>
        <ComposerPickerMenuPopup align="end" side="top" sideOffset={6}>
          <MenuItem onClick={() => onEdit(queuedTurn)}>编辑排队的提示词</MenuItem>
          <MenuItem onClick={() => onRemove(queuedTurn.id)}>删除排队中的提示词</MenuItem>
        </ComposerPickerMenuPopup>
      </Menu>
    </div>
  );
}

export { QueuedComposerActions };
