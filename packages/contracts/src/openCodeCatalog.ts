// FILE: openCodeCatalog.ts
// Purpose: WebSocket contracts for OpenCode provider catalog and auth proxy RPCs.
// Layer: Shared contracts
// Exports: catalog/auth input and result schemas used by server and web.

import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

export const OpenCodeCatalogInput = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  cwd: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
});
export type OpenCodeCatalogInput = typeof OpenCodeCatalogInput.Type;

export const OpenCodeCatalogProviderSource = Schema.Literals(["env", "config", "custom", "api"]);
export type OpenCodeCatalogProviderSource = typeof OpenCodeCatalogProviderSource.Type;

export const OpenCodeCatalogProvider = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: Schema.optional(OpenCodeCatalogProviderSource),
  env: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  models: Schema.optional(Schema.Record(TrimmedNonEmptyString, Schema.Unknown)),
  options: Schema.optional(Schema.Record(TrimmedNonEmptyString, Schema.Unknown)),
});
export type OpenCodeCatalogProvider = typeof OpenCodeCatalogProvider.Type;

export const OpenCodeCatalogDefaultModels = Schema.Record(
  TrimmedNonEmptyString,
  TrimmedNonEmptyString,
);
export type OpenCodeCatalogDefaultModels = typeof OpenCodeCatalogDefaultModels.Type;

export const OpenCodeConfigProvidersResult = Schema.Struct({
  providers: Schema.Array(OpenCodeCatalogProvider),
  default: OpenCodeCatalogDefaultModels,
});
export type OpenCodeConfigProvidersResult = typeof OpenCodeConfigProvidersResult.Type;

export const OpenCodeProviderAvailabilityResult = Schema.Struct({
  all: Schema.Array(OpenCodeCatalogProvider),
  connected: Schema.Array(TrimmedNonEmptyString),
  default: OpenCodeCatalogDefaultModels,
});
export type OpenCodeProviderAvailabilityResult = typeof OpenCodeProviderAvailabilityResult.Type;

export const OpenCodeProviderAuthMethod = Schema.Struct({
  type: Schema.Literals(["oauth", "api"]),
  label: TrimmedNonEmptyString,
  prompts: Schema.optional(Schema.Array(Schema.Unknown)),
});
export type OpenCodeProviderAuthMethod = typeof OpenCodeProviderAuthMethod.Type;

export const OpenCodeProviderAuthMethodsResult = Schema.Record(
  TrimmedNonEmptyString,
  Schema.Array(OpenCodeProviderAuthMethod),
);
export type OpenCodeProviderAuthMethodsResult = typeof OpenCodeProviderAuthMethodsResult.Type;

/** Single SDK session: provider availability + auth methods (settings/catalog reads). */
export const OpenCodeCatalogOverviewResult = Schema.Struct({
  availability: OpenCodeProviderAvailabilityResult,
  authMethods: OpenCodeProviderAuthMethodsResult,
});
export type OpenCodeCatalogOverviewResult = typeof OpenCodeCatalogOverviewResult.Type;

const OpenCodeCatalogConnectionFields = {
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  cwd: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
} as const;

export const OpenCodeAuthSetInput = Schema.Struct({
  ...OpenCodeCatalogConnectionFields,
  providerID: TrimmedNonEmptyString,
  apiKey: TrimmedNonEmptyString,
});
export type OpenCodeAuthSetInput = typeof OpenCodeAuthSetInput.Type;

export const OpenCodeAuthRemoveInput = Schema.Struct({
  ...OpenCodeCatalogConnectionFields,
  providerID: TrimmedNonEmptyString,
});
export type OpenCodeAuthRemoveInput = typeof OpenCodeAuthRemoveInput.Type;

export const OpenCodeAuthMutationResult = Schema.Struct({
  ok: Schema.Literal(true),
});
export type OpenCodeAuthMutationResult = typeof OpenCodeAuthMutationResult.Type;

export const OpenCodeOauthAuthorizeInput = Schema.Struct({
  ...OpenCodeCatalogConnectionFields,
  providerID: TrimmedNonEmptyString,
  method: Schema.Number,
  inputs: Schema.optional(Schema.Record(TrimmedNonEmptyString, TrimmedNonEmptyString)),
});
export type OpenCodeOauthAuthorizeInput = typeof OpenCodeOauthAuthorizeInput.Type;

export const OpenCodeOauthAuthorizeResult = Schema.Struct({
  url: TrimmedNonEmptyString,
  method: Schema.Literals(["auto", "code"]),
  instructions: Schema.String,
});
export type OpenCodeOauthAuthorizeResult = typeof OpenCodeOauthAuthorizeResult.Type;

export const OpenCodeOauthCallbackInput = Schema.Struct({
  ...OpenCodeCatalogConnectionFields,
  providerID: TrimmedNonEmptyString,
  method: Schema.Number,
  code: Schema.optional(TrimmedNonEmptyString),
});
export type OpenCodeOauthCallbackInput = typeof OpenCodeOauthCallbackInput.Type;

export const OpenCodeOauthCallbackResult = OpenCodeAuthMutationResult;
export type OpenCodeOauthCallbackResult = typeof OpenCodeOauthCallbackResult.Type;
