// FILE: ComposerQueuedHeader.tsx
// Purpose: Queued follow-up rows shown as a panel that merges into the top of the
// composer input (each with Steer / Delete / Edit actions). Rounded only on top with
// a flat, borderless bottom that fuses flush onto the composer; sits at 11/12 of the
// composer width while the composer below keeps its own full rounding.
// Layer: Chat composer UI
// Exports: ComposerQueuedHeader

import { memo } from "react";

import type { QueuedComposerTurn } from "../../composerDraftStore";
import {
  buildQueuedFollowUpSummaryLabel,
  shouldDisableQueuedSteerDuringCompaction,
} from "../../session-logic";
import { SteerIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import {
  ComposerStackedPanelRow,
  ComposerStackedPanelRowLabel,
  ComposerStackedPanelRowMain,
} from "./ComposerStackedPanelContent";
import {
  COMPOSER_STACKED_PANEL_DIVIDER_CLASS_NAME,
  ComposerStackedPanel,
} from "./ComposerStackedPanel";
import { COMPOSER_STACKED_PANEL_ICON_CLASS_NAME } from "./composerStackedPanelStyles";
import { QueuedComposerActions } from "./QueuedComposerActions";

interface ComposerQueuedHeaderProps {
  queuedTurns: QueuedComposerTurn[];
  onSteer: (queuedTurn: QueuedComposerTurn) => void;
  onRemove: (queuedTurnId: string) => void;
  onEdit: (queuedTurn: QueuedComposerTurn) => void;
  attachedToPrevious?: boolean;
  isContextCompacting?: boolean;
}

export const ComposerQueuedHeader = memo(function ComposerQueuedHeader({
  queuedTurns,
  onSteer,
  onRemove,
  onEdit,
  attachedToPrevious = false,
  isContextCompacting = false,
}: ComposerQueuedHeaderProps) {
  if (queuedTurns.length === 0) {
    return null;
  }

  return (
    <ComposerStackedPanel attachedToPrevious={attachedToPrevious} className="flex flex-col">
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-muted-foreground"
        data-testid="queued-follow-up-summary"
      >
        <span>
          {buildQueuedFollowUpSummaryLabel({
            queuedCount: queuedTurns.length,
            isContextCompacting,
          })}
        </span>
        {isContextCompacting ? <span className="text-amber-600">正在压缩上下文…</span> : null}
      </div>
      {queuedTurns.map((queuedTurn, queuedTurnIndex) => (
        <ComposerStackedPanelRow
          key={queuedTurn.id}
          compact
          data-testid="queued-follow-up-row"
          className={cn(queuedTurnIndex > 0 && COMPOSER_STACKED_PANEL_DIVIDER_CLASS_NAME)}
        >
          <ComposerStackedPanelRowMain>
            <SteerIcon className={COMPOSER_STACKED_PANEL_ICON_CLASS_NAME} />
            <ComposerStackedPanelRowLabel>{queuedTurn.previewText}</ComposerStackedPanelRowLabel>
          </ComposerStackedPanelRowMain>
          <QueuedComposerActions
            queuedTurn={queuedTurn}
            onSteer={onSteer}
            onRemove={onRemove}
            onEdit={onEdit}
            steerDisabled={shouldDisableQueuedSteerDuringCompaction(isContextCompacting)}
          />
        </ComposerStackedPanelRow>
      ))}
    </ComposerStackedPanel>
  );
});
