import { z } from "zod";

export const quoteDraftSchema = z.object({
  leadId: z.string().min(1),
  companyId: z.string().min(1),
  mode: z.enum(["OAT_DIRECT", "KEENER_LOGISTICS", "OAT_IF_BROKERED"]),
  transportPrice: z.coerce.number().min(0),
  brokerFee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const quoteUpdateSchema = quoteDraftSchema.extend({
  quoteId: z.string().min(1),
  feeLabel: z.array(z.string()).optional(),
  feeType: z.array(z.enum(["FLAT", "PERCENT"])).optional(),
  feeAmount: z.array(z.coerce.number().min(0)).optional(),
  feeSelected: z.array(z.string()).optional(),
});

export const mappingSchema = z.object({
  id: z.string().optional(),
  locationId: z.string().min(1),
  pipelineId: z.string().optional(),
  opportunityStageId: z.string().optional(),
  pickupCityKey: z.string().min(1),
  pickupStateKey: z.string().min(1),
  deliveryCityKey: z.string().min(1),
  deliveryStateKey: z.string().min(1),
  vehicleYearKey: z.string().min(1),
  vehicleMakeKey: z.string().min(1),
  vehicleModelKey: z.string().min(1),
  quoteNumberKey: z.string().min(1),
  quoteTotalKey: z.string().min(1),
  pdfUrlKey: z.string().min(1),
  acceptanceUrlKey: z.string().min(1),
  quoteStatusKey: z.string().min(1),
});
