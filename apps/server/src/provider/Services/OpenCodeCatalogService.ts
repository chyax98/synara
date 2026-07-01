import type {
  OpenCodeAuthMutationResult,
  OpenCodeAuthRemoveInput,
  OpenCodeAuthSetInput,
  OpenCodeCatalogInput,
  OpenCodeCatalogOverviewResult,
  OpenCodeConfigProvidersResult,
  OpenCodeOauthAuthorizeInput,
  OpenCodeOauthAuthorizeResult,
  OpenCodeOauthCallbackInput,
  OpenCodeOauthCallbackResult,
  OpenCodeProviderAuthMethodsResult,
  OpenCodeProviderAvailabilityResult,
  OpenCodeProviderConfigSources,
  OpenCodeProviderConfigSourcesInput,
  OpenCodeConfigGetResult,
  OpenCodeConfigUpdateInput,
  OpenCodeConfigMutationResult,
  OpenCodeProviderDisconnectInput,
  OpenCodeProviderDisconnectResult,
  OpenCodeAddProviderModelInput,
  OpenCodeUpsertCustomProviderInput,
  OpenCodeRemoveProviderModelInput,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { OpenCodeRuntimeError } from "../opencodeRuntime.ts";

export type OpenCodeCatalogServiceError = OpenCodeRuntimeError;

export interface OpenCodeCatalogServiceShape {
  readonly catalogOverview: (
    input: OpenCodeCatalogInput,
  ) => Effect.Effect<OpenCodeCatalogOverviewResult, OpenCodeCatalogServiceError>;
  readonly configProviders: (
    input: OpenCodeCatalogInput,
  ) => Effect.Effect<OpenCodeConfigProvidersResult, OpenCodeCatalogServiceError>;
  readonly providerAvailable: (
    input: OpenCodeCatalogInput,
  ) => Effect.Effect<OpenCodeProviderAvailabilityResult, OpenCodeCatalogServiceError>;
  readonly providerAuth: (
    input: OpenCodeCatalogInput,
  ) => Effect.Effect<OpenCodeProviderAuthMethodsResult, OpenCodeCatalogServiceError>;
  readonly authSet: (
    input: OpenCodeAuthSetInput,
  ) => Effect.Effect<OpenCodeAuthMutationResult, OpenCodeCatalogServiceError>;
  readonly authRemove: (
    input: OpenCodeAuthRemoveInput,
  ) => Effect.Effect<OpenCodeAuthMutationResult, OpenCodeCatalogServiceError>;
  readonly oauthAuthorize: (
    input: OpenCodeOauthAuthorizeInput,
  ) => Effect.Effect<OpenCodeOauthAuthorizeResult, OpenCodeCatalogServiceError>;
  readonly oauthCallback: (
    input: OpenCodeOauthCallbackInput,
  ) => Effect.Effect<OpenCodeOauthCallbackResult, OpenCodeCatalogServiceError>;
  readonly providerConfigSources: (
    input: OpenCodeProviderConfigSourcesInput,
  ) => Effect.Effect<OpenCodeProviderConfigSources, OpenCodeCatalogServiceError>;
  readonly configGet: (
    input: OpenCodeCatalogInput,
  ) => Effect.Effect<OpenCodeConfigGetResult, OpenCodeCatalogServiceError>;
  readonly configUpdate: (
    input: OpenCodeConfigUpdateInput,
  ) => Effect.Effect<OpenCodeConfigMutationResult, OpenCodeCatalogServiceError>;
  readonly providerDisconnect: (
    input: OpenCodeProviderDisconnectInput,
  ) => Effect.Effect<OpenCodeProviderDisconnectResult, OpenCodeCatalogServiceError>;
  readonly addProviderModel: (
    input: OpenCodeAddProviderModelInput,
  ) => Effect.Effect<OpenCodeConfigMutationResult, OpenCodeCatalogServiceError>;
  readonly upsertCustomProvider: (
    input: OpenCodeUpsertCustomProviderInput,
  ) => Effect.Effect<OpenCodeConfigMutationResult, OpenCodeCatalogServiceError>;
  readonly removeProviderModel: (
    input: OpenCodeRemoveProviderModelInput,
  ) => Effect.Effect<OpenCodeConfigMutationResult, OpenCodeCatalogServiceError>;
}

export class OpenCodeCatalogService extends ServiceMap.Service<
  OpenCodeCatalogService,
  OpenCodeCatalogServiceShape
>()("t3/provider/Services/OpenCodeCatalogService") {}
