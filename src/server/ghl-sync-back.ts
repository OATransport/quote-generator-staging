import "server-only";

import type { GhlFieldMapping, GhlSyncStatus, Prisma, Quote } from "@prisma/client";
import { quoteResultFields } from "@/lib/ghl-field-mapping-config";
import {
  getGhlFieldMappingsForLocation,
  resolveQuoteGhlLocationIdOrNull,
} from "@/lib/ghl-field-mappings";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";
import { isMockGhlMode, updateGhlOpportunityCustomFields } from "@/server/ghl";
import { evaluateSyncBackWritePermission } from "@/server/ghl-sync-back-policy";

export type SyncQuoteToGhlResult = {
  status: GhlSyncStatus;
  message: string;
  logId: string;
};

type QuoteForSync = Quote & {
  customerMessages: Array<{ customerName: string; message: string; createdAt: Date }>;
};

type PreparedField = {
  appFieldKey: string;
  value: string | null;
  mapping?: GhlFieldMapping;
  skippedReason?: string;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function absoluteUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : appUrl(path);
}

function buildFieldValues(quote: QuoteForSync): Record<string, string | null> {
  const latestQuestion = quote.customerMessages[0];
  return {
    quoteNumber: quote.quoteNumber,
    quoteMode: quote.quoteMode,
    quoteStatus: quote.status,
    quoteTotal: quote.customerTotal.toString(),
    depositDue: quote.depositDue.toString(),
    balanceDue: quote.balanceDue.toString(),
    quotePdfUrl: absoluteUrl(quote.quotePdfUrl),
    quoteAcceptanceUrl: quote.acceptanceUrl ?? appUrl(`/accept/${quote.secureAccessToken}`),
    quoteExpirationDate: quote.validUntil?.toISOString() ?? null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    declinedAt: quote.declinedAt?.toISOString() ?? null,
    declineReason: quote.declineReason ?? null,
    latestCustomerQuestion: latestQuestion ? `${latestQuestion.customerName}: ${latestQuestion.message}` : null,
  };
}

function prepareMappedFields(
  values: Record<string, string | null>,
  mappings: GhlFieldMapping[],
): { mapped: PreparedField[]; skipped: PreparedField[] } {
  const mappingByKey = new Map(mappings.map((mapping) => [mapping.appFieldKey, mapping]));
  const allKeys = quoteResultFields.map((field) => field.key);

  const mapped: PreparedField[] = [];
  const skipped: PreparedField[] = [];

  for (const appFieldKey of allKeys) {
    const value = values[appFieldKey] ?? null;
    const mapping = mappingByKey.get(appFieldKey);
    const entry = { appFieldKey, value, mapping };

    if (value == null || value === "") {
      skipped.push({ ...entry, skippedReason: "No value on quote to sync." });
      continue;
    }

    if (!mapping?.ghlCustomFieldId && !mapping?.ghlCustomFieldName) {
      skipped.push({ ...entry, skippedReason: "No GHL field mapping configured." });
      continue;
    }

    mapped.push(entry);
  }

  return { mapped, skipped };
}

function buildGhlUpdatePayload(quote: QuoteForSync, mapped: PreparedField[]) {
  return {
    opportunityId: quote.ghlOpportunityId,
    contactId: quote.ghlContactId,
    monetaryValue: Number(quote.customerTotal),
    status: quote.status,
    customFields: mapped.map((field) => ({
      appFieldKey: field.appFieldKey,
      ghlCustomFieldId: field.mapping?.ghlCustomFieldId ?? null,
      ghlCustomFieldName: field.mapping?.ghlCustomFieldName ?? null,
      value: field.value,
    })),
  };
}

function buildBaseRequestPayload(quoteId: string, trigger: string, extra: Record<string, unknown> = {}) {
  const permission = evaluateSyncBackWritePermission(trigger);
  return jsonValue({
    action: "SYNC_QUOTE_TO_GHL",
    trigger,
    triggerKind: permission.triggerKind,
    syncBackEnabled: permission.syncBackEnabled,
    autoSyncBackEnabled: permission.autoSyncBackEnabled,
    realWriteAllowed: permission.realWriteAllowed,
    skipReason: permission.skipReason ?? null,
    quoteId,
    mockMode: isMockGhlMode(),
    ...extra,
  });
}

function formatSuccessMessage(trigger: string, fieldCount: number) {
  return `[${trigger}] Synced ${fieldCount} quote result custom field${fieldCount === 1 ? "" : "s"} to GoHighLevel opportunity.`;
}

function parseGhlError(error: unknown) {
  if (error instanceof Error) {
    const match = error.message.match(/^GHL request failed (\d+): ([\s\S]*)$/);
    if (match) {
      return { status: Number(match[1]), body: match[2], message: error.message };
    }
    return { status: null, body: null, message: error.message };
  }
  return { status: null, body: null, message: "Unknown sync-back error." };
}

function buildApiCustomFields(mapped: PreparedField[]) {
  return mapped
    .filter((field) => field.mapping?.ghlCustomFieldId && field.value)
    .map((field) => ({
      id: field.mapping!.ghlCustomFieldId!,
      field_value: field.value!,
    }));
}

function formatSkipMessage(trigger: string, reason: string) {
  return `[${trigger}] ${reason}`;
}

async function writeSyncLog(data: {
  quoteId: string;
  status: GhlSyncStatus;
  requestPayload: Prisma.InputJsonValue;
  responsePayload?: Prisma.InputJsonValue;
  errorMessage?: string;
}) {
  return prisma.ghlSyncLog.create({
    data: {
      quoteId: data.quoteId,
      direction: "APP_TO_GHL",
      status: data.status,
      requestPayload: data.requestPayload,
      responsePayload: data.responsePayload,
      errorMessage: data.errorMessage,
    },
  });
}

async function persistSyncLog(data: {
  quoteId: string;
  trigger: string;
  status: GhlSyncStatus;
  message: string;
  requestPayload: Prisma.InputJsonValue;
  responsePayload?: Prisma.InputJsonValue;
}): Promise<SyncQuoteToGhlResult> {
  try {
    const log = await writeSyncLog({
      quoteId: data.quoteId,
      status: data.status,
      requestPayload: data.requestPayload,
      responsePayload: data.responsePayload,
      errorMessage: data.message,
    });

    return {
      status: data.status,
      message: data.message,
      logId: log.id,
    };
  } catch (error) {
    console.error(`[GHL sync-back] Failed to persist sync log for quote ${data.quoteId} (${data.trigger}):`, error);
    throw error;
  }
}

async function persistSyncFailure(
  quoteId: string,
  trigger: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<SyncQuoteToGhlResult> {
  return persistSyncLog({
    quoteId,
    trigger,
    status: "FAILED",
    message: formatSkipMessage(trigger, message),
    requestPayload: buildBaseRequestPayload(quoteId, trigger, { ...extra, unexpectedFailure: true }),
    responsePayload: jsonValue({ reason: message }),
  });
}

export async function syncQuoteToGhl(
  quoteId: string,
  options?: { trigger?: string },
): Promise<SyncQuoteToGhlResult> {
  const trigger = options?.trigger ?? "MANUAL";

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customerMessages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!quote) {
      return persistSyncFailure(quoteId, trigger, "Quote not found.");
    }

    const fieldValues = buildFieldValues(quote);
    const ghlLocationId = resolveQuoteGhlLocationIdOrNull(quote);
    const mappings = ghlLocationId ? await getGhlFieldMappingsForLocation(ghlLocationId) : [];
    const { mapped, skipped } = prepareMappedFields(fieldValues, mappings);
    const requestPayload = buildBaseRequestPayload(quoteId, trigger, {
      quoteNumber: quote.quoteNumber,
      ghlLocationId,
      fieldValues,
      mappedFields: mapped.map((field) => ({
        appFieldKey: field.appFieldKey,
        value: field.value,
        ghlCustomFieldId: field.mapping?.ghlCustomFieldId ?? null,
        ghlCustomFieldName: field.mapping?.ghlCustomFieldName ?? null,
      })),
      skippedFields: skipped.map((field) => ({
        appFieldKey: field.appFieldKey,
        value: field.value,
        reason: field.skippedReason,
      })),
    });

    if (isMockGhlMode()) {
      return persistSyncLog({
        quoteId,
        trigger,
        status: "SKIPPED",
        message: formatSkipMessage(trigger, "Mock GHL mode is active. No real GoHighLevel API call was made."),
        requestPayload,
        responsePayload: jsonValue({ reason: "Mock GHL mode — sync-back was not sent to GoHighLevel." }),
      });
    }

    if (!quote.ghlOpportunityId) {
      return persistSyncLog({
        quoteId,
        trigger,
        status: "FAILED",
        message: formatSkipMessage(trigger, "Quote is not linked to a GoHighLevel opportunity."),
        requestPayload,
      });
    }

    if (!ghlLocationId) {
      return persistSyncLog({
        quoteId,
        trigger,
        status: "SKIPPED",
        message: formatSkipMessage(
          trigger,
          "No GHL location could be resolved for this quote. Sync-back was not sent to GoHighLevel.",
        ),
        requestPayload,
        responsePayload: jsonValue({ skippedFields: skipped }),
      });
    }

    const updatePayload = buildGhlUpdatePayload(quote, mapped);
    const apiCustomFields = buildApiCustomFields(mapped);
    const permission = evaluateSyncBackWritePermission(trigger);

    if (!mapped.length) {
      return persistSyncLog({
        quoteId,
        trigger,
        status: "SKIPPED",
        message: formatSkipMessage(
          trigger,
          "No mapped quote result fields were ready to sync. No real GoHighLevel API call was made.",
        ),
        requestPayload,
        responsePayload: jsonValue({ updatePayload, skippedFields: skipped, permission }),
      });
    }

    if (!permission.realWriteAllowed) {
      const skipMessage =
        permission.skipReason === "GHL_SYNC_BACK_ENABLED is not true."
          ? "Real GHL sync-back is disabled (GHL_SYNC_BACK_ENABLED is not true). Payload validated and ready."
          : (permission.skipReason ?? "Real GHL sync-back was not allowed for this trigger.");

      return persistSyncLog({
        quoteId,
        trigger,
        status: "SKIPPED",
        message: formatSkipMessage(trigger, skipMessage),
        requestPayload,
        responsePayload: jsonValue({
          updatePayload,
          skippedFields: skipped,
          permission,
        }),
      });
    }

    if (!apiCustomFields.length) {
      return persistSyncLog({
        quoteId,
        trigger,
        status: "FAILED",
        message: formatSkipMessage(
          trigger,
          "Mapped quote result fields are missing GHL custom field IDs required for a real sync-back write.",
        ),
        requestPayload,
        responsePayload: jsonValue({ updatePayload, skippedFields: skipped }),
      });
    }

    const apiRequestBody = { customFields: apiCustomFields };

    try {
      const apiResponse = await updateGhlOpportunityCustomFields(
        quote.ghlOpportunityId,
        apiCustomFields,
        ghlLocationId,
      );

      return persistSyncLog({
        quoteId,
        trigger,
        status: "SUCCESS",
        message: formatSuccessMessage(trigger, apiCustomFields.length),
        requestPayload: buildBaseRequestPayload(quoteId, trigger, {
          quoteNumber: quote.quoteNumber,
          ghlLocationId,
          ghlOpportunityId: quote.ghlOpportunityId,
          fieldValues,
          mappedFields: mapped.map((field) => ({
            appFieldKey: field.appFieldKey,
            value: field.value,
            ghlCustomFieldId: field.mapping?.ghlCustomFieldId ?? null,
            ghlCustomFieldName: field.mapping?.ghlCustomFieldName ?? null,
          })),
          skippedFields: skipped.map((field) => ({
            appFieldKey: field.appFieldKey,
            value: field.value,
            reason: field.skippedReason,
          })),
          apiRequest: apiRequestBody,
        }),
        responsePayload: jsonValue({
          endpoint: `PUT /opportunities/${quote.ghlOpportunityId}`,
          updatePayload,
          skippedFields: skipped,
          apiRequest: apiRequestBody,
          apiResponseSummary: {
            opportunityId: quote.ghlOpportunityId,
            customFieldCount: apiCustomFields.length,
            responseKeys:
              apiResponse && typeof apiResponse === "object" ? Object.keys(apiResponse as Record<string, unknown>) : [],
          },
        }),
      });
    } catch (error) {
      const parsed = parseGhlError(error);

      return persistSyncLog({
        quoteId,
        trigger,
        status: "FAILED",
        message: formatSkipMessage(
          trigger,
          parsed.status
            ? `GoHighLevel opportunity update failed (${parsed.status}).`
            : "GoHighLevel opportunity update failed.",
        ),
        requestPayload: buildBaseRequestPayload(quoteId, trigger, {
          quoteNumber: quote.quoteNumber,
          ghlLocationId,
          ghlOpportunityId: quote.ghlOpportunityId,
          fieldValues,
          mappedFields: mapped.map((field) => ({
            appFieldKey: field.appFieldKey,
            value: field.value,
            ghlCustomFieldId: field.mapping?.ghlCustomFieldId ?? null,
            ghlCustomFieldName: field.mapping?.ghlCustomFieldName ?? null,
          })),
          skippedFields: skipped.map((field) => ({
            appFieldKey: field.appFieldKey,
            value: field.value,
            reason: field.skippedReason,
          })),
          apiRequest: apiRequestBody,
        }),
        responsePayload: jsonValue({
          endpoint: `PUT /opportunities/${quote.ghlOpportunityId}`,
          updatePayload,
          skippedFields: skipped,
          apiRequest: apiRequestBody,
          httpStatus: parsed.status,
          errorBody: parsed.body,
        }),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync-back error.";
    console.error(`[GHL sync-back] Unexpected error for quote ${quoteId} (${trigger}):`, error);

    try {
      return await persistSyncFailure(quoteId, trigger, message, {
        stage: "unexpected_error",
      });
    } catch (logError) {
      console.error(
        `[GHL sync-back] Could not persist failure log for quote ${quoteId} (${trigger}):`,
        logError,
      );
      return {
        status: "FAILED",
        message: formatSkipMessage(trigger, message),
        logId: "",
      };
    }
  }
}

export async function getLatestQuoteSyncLog(quoteId: string) {
  return prisma.ghlSyncLog.findFirst({
    where: { quoteId, direction: "APP_TO_GHL" },
    orderBy: { createdAt: "desc" },
  });
}
