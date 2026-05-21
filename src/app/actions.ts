"use server";

import { randomUUID } from "crypto";
import type { QuoteMode, QuoteStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveGhlImportAccountKey } from "@/lib/ghl-accounts";
import {
  getActiveGhlLocationId,
  ghlFieldMappingWhere,
} from "@/lib/ghl-field-mappings";
import { allMappingFields } from "@/lib/ghl-field-mapping-config";
import { prisma } from "@/lib/prisma";
import { generateQuotePdf } from "@/lib/pdf";
import { parseMoney, parseQuoteMode, parseQuoteStatus, toDecimal } from "@/lib/form-parsing";
import { buildFeeRowsForSave, parseFeesFromFormData, readBreakdownModeFromFormData } from "@/lib/quote-form-preview";
import { calculateQuotePricing } from "@/lib/quote-pricing";
import { isQuotePubliclyActive } from "@/lib/quote-active";
import { getRequestMeta } from "@/lib/request-meta";
import { appUrl } from "@/lib/utils";
import {
  createMissingQuoteResultFields,
  getGhlCustomFields,
  importGhlOpportunityToQuote,
  refreshQuoteFromGhl,
} from "@/server/ghl";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";

async function triggerQuoteSyncBack(quoteId: string, trigger: string) {
  try {
    const result = await syncQuoteToGhl(quoteId, { trigger });
    if (!result.logId) {
      console.error(
        `[GHL sync-back] ${trigger} for quote ${quoteId} completed without a sync log: ${result.message}`,
      );
    }
  } catch (error) {
    console.error(`[GHL sync-back] ${trigger} for quote ${quoteId} failed unexpectedly:`, error);
  }
}

export async function importGhlOpportunityAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const account = resolveGhlImportAccountKey(String(formData.get("account") ?? ""));
  const returnPath = String(formData.get("returnPath") ?? "/dashboard/import-ghl");
  if (!opportunityId) {
    redirect(`${returnPath}?error=missing-opportunity&account=${account}`);
  }

  const quote = await importGhlOpportunityToQuote(opportunityId, { account });
  revalidatePath("/import");
  revalidatePath("/dashboard/import-ghl");
  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}/edit`);
}

export async function refreshQuoteFromGhlAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) redirect("/quotes");

  await refreshQuoteFromGhl(quoteId);
  revalidatePath(`/quotes/${quoteId}/edit`);
  redirect(`/quotes/${quoteId}/edit`);
}

export async function syncQuoteToGhlAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) redirect("/quotes");

  const result = await syncQuoteToGhl(quoteId, { trigger: "MANUAL" });
  revalidatePath(`/quotes/${quoteId}/edit`);
  redirect(
    `/quotes/${quoteId}/edit?syncStatus=${result.status}&syncMessage=${encodeURIComponent(result.message)}`,
  );
}

export async function createQuoteAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const customerSnapshotId = String(formData.get("customerSnapshotId") ?? "");
  const customerTotal = Number(formData.get("customerTotal") ?? 0);
  const quoteMode = String(formData.get("quoteMode") ?? "OAT_DIRECT") as QuoteMode;
  const count = await prisma.quote.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } } });
  const secureAccessToken = randomUUID();

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `Q-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`,
      quoteMode,
      status: "DRAFT",
      companyId,
      customerSnapshotId,
      customerTotal,
      balanceDue: customerTotal,
      secureAccessToken,
      acceptanceUrl: appUrl(`/accept/${secureAccessToken}`),
    },
  });

  redirect(`/quotes/${quote.id}/edit`);
}

export async function updateQuoteAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  if (!quoteId) {
    redirect("/quotes?saveError=missing-quote");
  }

  try {
    const existing = await prisma.quote.findUnique({ where: { id: quoteId }, select: { status: true, quoteMode: true } });
    if (!existing) {
      redirect("/quotes?saveError=quote-not-found");
    }

    const depositDue = parseMoney(formData.get("depositDue"));
    const customerTotal = parseMoney(formData.get("customerTransportationPrice")) ?? 0;
    const carrierPay = parseMoney(formData.get("carrierPay")) ?? 0;
    const breakdownFees = parseFeesFromFormData(formData);
    const showItemizedBreakdown = readBreakdownModeFromFormData(formData);
    const pricing = calculateQuotePricing({ customerPrice: customerTotal, depositDue, carrierPay });
    const feeRows = buildFeeRowsForSave({
      breakdownFees,
      showItemizedBreakdown,
      carrierPay,
      carrierNotes: String(formData.get("carrierNotes") ?? "") || null,
    });
    const pickupDateRaw = String(formData.get("pickupDateWindow") ?? "").trim();
    const parsedPickupDate = pickupDateRaw ? new Date(pickupDateRaw) : null;
    const pickupDate = parsedPickupDate && !Number.isNaN(parsedPickupDate.getTime()) ? parsedPickupDate : null;
    const deliveryWindow = pickupDate ? null : pickupDateRaw || null;

    const vehicleYear = String(formData.get("vehicleYear") ?? "").trim() || null;
    const vehicleMake = String(formData.get("vehicleMake") ?? "").trim() || null;
    const vehicleModel = String(formData.get("vehicleModel") ?? "").trim() || null;
    const vehicleType = String(formData.get("vehicleType") ?? "").trim() || null;
    const vehicleCondition = String(formData.get("vehicleCondition") ?? "").trim() || null;
    const vehicleNotes = String(formData.get("vehicleNotes") ?? "").trim() || null;

    const existingVehicle = await prisma.vehicleSnapshot.findFirst({ where: { quoteId }, select: { id: true } });
    const hasVehicleData = Boolean(vehicleYear || vehicleMake || vehicleModel || vehicleType || vehicleCondition || vehicleNotes);

    await prisma.$transaction(async (tx) => {
      await tx.quoteFee.deleteMany({ where: { quoteId } });
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          quoteMode: parseQuoteMode(formData.get("quoteMode"), existing.quoteMode),
          status: parseQuoteStatus(formData.get("status"), existing.status),
          pickupAddress: String(formData.get("pickupAddress") ?? "") || null,
          pickupCity: String(formData.get("pickupCity") ?? "") || null,
          pickupState: String(formData.get("pickupState") ?? "") || null,
          pickupZip: String(formData.get("pickupZip") ?? "") || null,
          deliveryAddress: String(formData.get("deliveryAddress") ?? "") || null,
          deliveryCity: String(formData.get("deliveryCity") ?? "") || null,
          deliveryState: String(formData.get("deliveryState") ?? "") || null,
          deliveryZip: String(formData.get("deliveryZip") ?? "") || null,
          trailerType: String(formData.get("trailerType") ?? "") || null,
          pickupDate,
          deliveryWindow,
          customerTotal: toDecimal(pricing.customerPrice) ?? 0,
          depositDue: toDecimal(pricing.depositDue) ?? 0,
          balanceDue: toDecimal(pricing.balanceDue) ?? 0,
          internalEstimatedCarrierPay: carrierPay > 0 ? toDecimal(carrierPay) : null,
          internalGrossMargin: toDecimal(pricing.brokerFee),
          internalMarginPercentage: toDecimal(pricing.marginPercent),
          customerNotes: String(formData.get("customerNotes") ?? "") || null,
          internalNotes: String(formData.get("internalNotes") ?? "") || null,
          fees: { create: feeRows },
        },
      });

      if (existingVehicle) {
        await tx.vehicleSnapshot.update({
          where: { id: existingVehicle.id },
          data: {
            year: vehicleYear,
            make: vehicleMake,
            model: vehicleModel,
            type: vehicleType,
            condition: vehicleCondition,
            notes: vehicleNotes,
          },
        });
      } else if (hasVehicleData) {
        await tx.vehicleSnapshot.create({
          data: {
            quoteId,
            year: vehicleYear,
            make: vehicleMake,
            model: vehicleModel,
            type: vehicleType,
            condition: vehicleCondition,
            notes: vehicleNotes,
          },
        });
      }
    });

    revalidatePath(`/quotes/${quoteId}/edit`);
    revalidatePath("/quotes");
    redirect(`/quotes/${quoteId}/edit?saved=1`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    console.error("[updateQuote] save failed", {
      quoteId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    redirect(`/quotes/${quoteId}/edit?saveError=save-failed`);
  }
}

export async function archiveQuoteAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return;

  await prisma.quote.update({
    where: { id: quoteId },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/quotes");
  revalidatePath("/");
  revalidatePath(`/quotes/${quoteId}/edit`);
  redirect("/quotes");
}

export async function generatePdfAndSyncAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId"));
  try {
    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { company: true, customerSnapshot: true, fees: true, vehicles: true },
    });
    const quotePdfUrl = await generateQuotePdf(quote);
    await prisma.quote.update({
      where: { id: quoteId },
      data: { quotePdfUrl, status: "PDF_GENERATED" },
    });
  } finally {
    await triggerQuoteSyncBack(quoteId, "PDF_GENERATED");
  }
  revalidatePath(`/quotes/${quoteId}/edit`);
  redirect(`/quotes/${quoteId}/edit?syncMessage=${encodeURIComponent("Optional PDF generated successfully.")}`);
}

export async function saveMappingAction(formData: FormData) {
  const appFieldKey = String(formData.get("appFieldKey") ?? "");
  if (!appFieldKey) return;
  const ghlLocationId = getActiveGhlLocationId();
  await prisma.ghlFieldMapping.upsert({
    where: ghlFieldMappingWhere(ghlLocationId, appFieldKey),
    update: {
      ghlCustomFieldId: String(formData.get("ghlCustomFieldId") ?? "") || null,
      ghlCustomFieldName: String(formData.get("ghlCustomFieldName") ?? "") || null,
      fallbackPath: String(formData.get("fallbackPath") ?? "") || null,
      isRequired: formData.get("isRequired") === "on",
    },
    create: {
      ghlLocationId,
      appFieldKey,
      ghlCustomFieldId: String(formData.get("ghlCustomFieldId") ?? "") || null,
      ghlCustomFieldName: String(formData.get("ghlCustomFieldName") ?? "") || null,
      fallbackPath: String(formData.get("fallbackPath") ?? "") || null,
      isRequired: formData.get("isRequired") === "on",
    },
  });
  revalidatePath("/settings/ghl");
}

export async function saveGhlFieldMappingsAction(formData: FormData) {
  const ghlLocationId = getActiveGhlLocationId();
  const customFields = await getGhlCustomFields();
  for (const field of allMappingFields) {
    const ghlCustomFieldId = String(formData.get(`field_${field.key}`) ?? "");
    const selectedField = customFields.find((item) => item.id === ghlCustomFieldId);
    await prisma.ghlFieldMapping.upsert({
      where: ghlFieldMappingWhere(ghlLocationId, field.key),
      update: {
        ghlCustomFieldId: ghlCustomFieldId || null,
        ghlCustomFieldName: selectedField?.name ?? null,
        fallbackPath: String(formData.get(`fallback_${field.key}`) ?? "") || null,
        isRequired: Boolean(field.critical),
      },
      create: {
        ghlLocationId,
        appFieldKey: field.key,
        ghlCustomFieldId: ghlCustomFieldId || null,
        ghlCustomFieldName: selectedField?.name ?? null,
        fallbackPath: String(formData.get(`fallback_${field.key}`) ?? "") || null,
        isRequired: Boolean(field.critical),
      },
    });
  }

  revalidatePath("/dashboard/settings/ghl-field-mapping");
}

export async function createMissingQuoteResultFieldsAction() {
  const result = await createMissingQuoteResultFields();
  revalidatePath("/dashboard/settings/ghl-field-mapping");
  redirect(
    `/dashboard/settings/ghl-field-mapping?created=${result.created.length}&mapped=${result.mappedExisting.length}&skipped=${result.skipped.length}&failed=${result.failed.length}`,
  );
}

async function getQuoteByToken(token: string) {
  if (!token) return null;
  return prisma.quote.findUnique({ where: { secureAccessToken: token } });
}

export async function acceptQuoteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const customerSignature = String(formData.get("customerSignature") ?? "").trim();
  const agreeTerms = formData.get("agreeTerms") === "on";

  if (!customerSignature) redirect(`/accept/${token}?error=missing-signature`);
  if (!agreeTerms) redirect(`/accept/${token}?error=terms-required`);

  const quote = await getQuoteByToken(token);
  if (!quote) redirect("/");

  if (!isQuotePubliclyActive(quote)) {
    redirect(`/accept/${token}?error=quote-inactive`);
  }

  if (quote.status === "ACCEPTED") {
    redirect(`/accept/${token}?accepted=1`);
  }
  if (quote.status === "DECLINED") {
    redirect(`/accept/${token}?error=already-declined`);
  }

  const { ip, userAgent } = await getRequestMeta();
  const acceptedAt = new Date();

  try {
    await prisma.$transaction([
      prisma.quote.update({
        where: { secureAccessToken: token },
        data: {
          status: "ACCEPTED",
          acceptedAt,
          customerSignature,
          acceptedIp: ip,
          acceptedUserAgent: userAgent,
          lastCustomerActionAt: acceptedAt,
        },
      }),
      prisma.quoteEvent.create({
        data: {
          quoteId: quote.id,
          type: "CUSTOMER_ACCEPTED",
          message: `Quote accepted by ${customerSignature}.`,
          metadata: { customerSignature, ip, userAgent },
        },
      }),
      prisma.notification.create({
        data: {
          quoteId: quote.id,
          type: "QUOTE_ACCEPTED",
          title: "Quote accepted",
          message: `${quote.quoteNumber} accepted by ${customerSignature}.`,
        },
      }),
    ]);
  } finally {
    await triggerQuoteSyncBack(quote.id, "CUSTOMER_ACCEPTED");
  }

  revalidatePath(`/accept/${token}`);
  revalidatePath(`/quotes/${quote.id}/edit`);
  revalidatePath("/");
  redirect(`/accept/${token}?accepted=1`);
}

export async function declineQuoteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const declineReason = String(formData.get("declineReason") ?? "").trim();

  if (!declineReason) redirect(`/accept/${token}?error=missing-decline-reason`);

  const quote = await getQuoteByToken(token);
  if (!quote) redirect("/");

  if (!isQuotePubliclyActive(quote)) {
    redirect(`/accept/${token}?error=quote-inactive`);
  }

  if (quote.status === "DECLINED") {
    redirect(`/accept/${token}?declined=1`);
  }
  if (quote.status === "ACCEPTED") {
    redirect(`/accept/${token}?error=already-accepted`);
  }

  const { ip, userAgent } = await getRequestMeta();
  const declinedAt = new Date();

  try {
    await prisma.$transaction([
      prisma.quote.update({
        where: { secureAccessToken: token },
        data: {
          status: "DECLINED",
          declinedAt,
          declineReason,
          declinedIp: ip,
          declinedUserAgent: userAgent,
          lastCustomerActionAt: declinedAt,
        },
      }),
      prisma.quoteEvent.create({
        data: {
          quoteId: quote.id,
          type: "CUSTOMER_DECLINED",
          message: "Quote declined by customer.",
          metadata: { declineReason, ip, userAgent },
        },
      }),
      prisma.notification.create({
        data: {
          quoteId: quote.id,
          type: "QUOTE_DECLINED",
          title: "Quote declined",
          message: `${quote.quoteNumber} declined. Reason: ${declineReason}`,
        },
      }),
    ]);
  } finally {
    await triggerQuoteSyncBack(quote.id, "CUSTOMER_DECLINED");
  }

  revalidatePath(`/accept/${token}`);
  revalidatePath(`/quotes/${quote.id}/edit`);
  revalidatePath("/");
  redirect(`/accept/${token}?declined=1`);
}

export async function askQuoteQuestionAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!customerName) redirect(`/accept/${token}?error=missing-name`);
  if (!message) redirect(`/accept/${token}?error=missing-question`);

  const quote = await getQuoteByToken(token);
  if (!quote) redirect("/");

  const { ip, userAgent } = await getRequestMeta();
  const submittedAt = new Date();
  const nextStatus =
    quote.status === "ACCEPTED" || quote.status === "DECLINED" ? quote.status : ("QUESTION" as QuoteStatus);

  try {
    await prisma.$transaction([
      prisma.quoteCustomerMessage.create({
        data: {
          quoteId: quote.id,
          customerName,
          message,
          ipAddress: ip,
          userAgent,
        },
      }),
      prisma.quote.update({
        where: { secureAccessToken: token },
        data: {
          status: nextStatus,
          lastCustomerActionAt: submittedAt,
        },
      }),
      prisma.quoteEvent.create({
        data: {
          quoteId: quote.id,
          type: "CUSTOMER_QUESTION",
          message: `Question from ${customerName}.`,
          metadata: { customerName, message, ip, userAgent },
        },
      }),
      prisma.notification.create({
        data: {
          quoteId: quote.id,
          type: "QUOTE_QUESTION",
          title: "Customer question",
          message: `${quote.quoteNumber} — ${customerName}: ${message}`,
        },
      }),
    ]);
  } finally {
    await triggerQuoteSyncBack(quote.id, "CUSTOMER_QUESTION");
  }

  revalidatePath(`/accept/${token}`);
  revalidatePath(`/quotes/${quote.id}/edit`);
  revalidatePath("/");
  redirect(`/accept/${token}?question=1`);
}
