/**
 * ProviderIcon - shared provider glyphs for chat, sidebar, and picker surfaces.
 *
 * OpenCode-only: single provider icon mapping.
 */
import { type ProviderKind } from "@t3tools/contracts";
import type { ReactNode, SVGProps } from "react";

import { CentralIcon } from "~/lib/central-icons";
import { cn } from "~/lib/utils";
import { OpenCodeIcon } from "./Icons";

export type ProviderIconTone = "default" | "header";

const OpenCodeProviderIcon = ({
  className,
  style,
  title,
  role,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  ...svgProps
}: SVGProps<SVGSVGElement> & { title?: string }) => {
  const centralIconLabel =
    ariaHidden === true || ariaHidden === "true" || typeof ariaLabel !== "string"
      ? undefined
      : ariaLabel;

  return (
    <>
      <OpenCodeIcon
        {...svgProps}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        role={role}
        className={cn(className, "dark:hidden")}
        style={style}
      />
      <CentralIcon
        name="opencode"
        label={centralIconLabel}
        title={title}
        className={cn(className, "hidden dark:inline-block dark:text-foreground/90")}
        style={style}
      />
    </>
  );
};

export const PROVIDER_ICON_COMPONENT_BY_PROVIDER = {
  opencode: OpenCodeProviderIcon,
} as Record<ProviderKind, typeof OpenCodeProviderIcon>;

export function providerIconToneClassName(
  _provider: ProviderKind | null | undefined,
  _tone: ProviderIconTone = "default",
): string {
  return "text-muted-foreground/70";
}

export type ProviderIconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
  readonly provider: ProviderKind | null | undefined;
  readonly fallback?: ReactNode;
  readonly tone?: ProviderIconTone;
};

export function ProviderIcon({
  provider,
  fallback = null,
  tone = "default",
  className,
  "aria-hidden": ariaHidden = true,
  ...svgProps
}: ProviderIconProps) {
  if (provider === null || provider === undefined) {
    return fallback;
  }

  const Icon = PROVIDER_ICON_COMPONENT_BY_PROVIDER.opencode;
  return (
    <Icon
      aria-hidden={ariaHidden}
      {...svgProps}
      className={cn(providerIconToneClassName(provider, tone), className)}
    />
  );
}

export function ProviderOptionLabel({
  provider,
  label,
  className,
  iconClassName,
}: {
  provider: ProviderKind;
  label: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ProviderIcon provider={provider} className={cn("size-3.5", iconClassName)} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}