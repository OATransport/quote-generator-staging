import "server-only";

import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

export type GhlAccountCredentials = {
  ghlLocationId: string;
  privateIntegrationToken: string;
  quotePipelineId: string;
  defaultStageId: string;
};

const ACCOUNT_ENV_PREFIX: Record<string, string> = {
  [OAT_GHL_LOCATION_ID]: "OAT",
  [KEENER_GHL_LOCATION_ID]: "KEENER",
};

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function requireCredential(value: string | undefined, label: string, ghlLocationId: string) {
  if (!value) {
    throw new Error(`${label} is not configured for GHL location ${ghlLocationId}.`);
  }
  return value;
}

export function hasAnyGhlCredentials() {
  return Boolean(
    env("GHL_PRIVATE_INTEGRATION_TOKEN") ||
      env("OAT_GHL_PRIVATE_INTEGRATION_TOKEN") ||
      env("KEENER_GHL_PRIVATE_INTEGRATION_TOKEN"),
  );
}

export function getGhlCredentialsForLocation(ghlLocationId: string): GhlAccountCredentials {
  const normalized = ghlLocationId.trim();
  const prefix = ACCOUNT_ENV_PREFIX[normalized];
  const singleLocation = env("GHL_LOCATION_ID");
  const singleAccountFallback = Boolean(singleLocation && singleLocation === normalized);

  const privateIntegrationToken =
    (prefix ? env(`${prefix}_GHL_PRIVATE_INTEGRATION_TOKEN`) : undefined) ??
    (singleAccountFallback ? env("GHL_PRIVATE_INTEGRATION_TOKEN") : undefined);

  const resolvedLocationId =
    (prefix ? env(`${prefix}_GHL_LOCATION_ID`) : undefined) ??
    (singleAccountFallback ? singleLocation : undefined) ??
    normalized;

  const quotePipelineId =
    (prefix ? env(`${prefix}_GHL_QUOTE_PIPELINE_ID`) : undefined) ??
    (singleAccountFallback ? env("GHL_QUOTE_PIPELINE_ID") : undefined);

  const defaultStageId =
    (prefix ? env(`${prefix}_GHL_DEFAULT_STAGE_ID`) : undefined) ??
    (singleAccountFallback ? env("GHL_DEFAULT_STAGE_ID") : undefined);

  return {
    ghlLocationId: resolvedLocationId,
    privateIntegrationToken: requireCredential(
      privateIntegrationToken,
      "GHL private integration token",
      normalized,
    ),
    quotePipelineId: requireCredential(quotePipelineId, "GHL quote pipeline ID", normalized),
    defaultStageId: requireCredential(defaultStageId, "GHL default stage ID", normalized),
  };
}

export function getActiveGhlCredentials(): GhlAccountCredentials {
  const activeLocation = env("GHL_LOCATION_ID");
  if (activeLocation) {
    return getGhlCredentialsForLocation(activeLocation);
  }
  if (env("OAT_GHL_PRIVATE_INTEGRATION_TOKEN") || env("OAT_GHL_LOCATION_ID")) {
    return getGhlCredentialsForLocation(OAT_GHL_LOCATION_ID);
  }
  if (env("KEENER_GHL_PRIVATE_INTEGRATION_TOKEN") || env("KEENER_GHL_LOCATION_ID")) {
    return getGhlCredentialsForLocation(KEENER_GHL_LOCATION_ID);
  }
  throw new Error("No GHL credentials configured.");
}
