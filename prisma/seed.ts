import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_QUOTE_NUMBER = "Q-SAMPLE-00001";
const SAMPLE_ACCEPT_TOKEN = "test-accept-token";
const SAMPLE_CUSTOMER_ID = "sample-test-customer";

function appUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

const mappings = [
  ["pickupAddress", "pickup_address", "customFields.pickup_address"],
  ["pickupCity", "pickup_city", "customFields.pickup_city"],
  ["pickupState", "pickup_state", "customFields.pickup_state"],
  ["pickupZip", "pickup_zip", "customFields.pickup_zip"],
  ["pickupContactName", "pickup_contact_name", "customFields.pickup_contact_name"],
  ["pickupContactPhone", "pickup_contact_phone", "customFields.pickup_contact_phone"],
  ["deliveryAddress", "delivery_address", "customFields.delivery_address"],
  ["deliveryCity", "delivery_city", "customFields.delivery_city"],
  ["deliveryState", "delivery_state", "customFields.delivery_state"],
  ["deliveryZip", "delivery_zip", "customFields.delivery_zip"],
  ["deliveryContactName", "delivery_contact_name", "customFields.delivery_contact_name"],
  ["deliveryContactPhone", "delivery_contact_phone", "customFields.delivery_contact_phone"],
  ["deliveryWindow", "delivery_window", "customFields.delivery_window"],
  ["trailerType", "trailer_type", "customFields.trailer_type"],
  ["customerTotal", "customer_total", "monetaryValue"],
  ["depositDue", "deposit_due", "customFields.deposit_due"],
  ["balanceDue", "balance_due", "customFields.balance_due"],
  ["internalEstimatedCarrierPay", "estimated_carrier_pay", "customFields.estimated_carrier_pay"],
  ["customerNotes", "customer_notes", "customFields.customer_notes"],
  ["internalNotes", "internal_notes", "customFields.internal_notes"],
  ["vehicleYear", "vehicle_year", "customFields.vehicle_year"],
  ["vehicleMake", "vehicle_make", "customFields.vehicle_make"],
  ["vehicleModel", "vehicle_model", "customFields.vehicle_model"],
  ["vehicleType", "vehicle_type", "customFields.vehicle_type"],
  ["vehicleCondition", "vehicle_condition", "customFields.vehicle_condition"],
  ["vehicleVin", "vehicle_vin", "customFields.vehicle_vin"],
  ["vehicleIsRunning", "vehicle_is_running", "customFields.vehicle_is_running"],
  ["vehicleNotes", "vehicle_notes", "customFields.vehicle_notes"],
] as const;

const OAT_GHL_LOCATION_ID = "iisYmOgIc6Ef6uoJ2sVx";
const KEENER_GHL_LOCATION_ID = "secdHfMuJKMfpDpHFMHw";
const SEED_GHL_LOCATIONS = [OAT_GHL_LOCATION_ID, KEENER_GHL_LOCATION_ID] as const;

const COMPANY_BRANDING = {
  "organized-auto-transport": {
    logoUrl: "/branding/oat-logo.jpg",
    iconUrl: "/branding/oat-icon.png",
  },
  "keener-logistics": {
    logoUrl: "/branding/keener-logo.png",
    iconUrl: "/branding/keener-icon.png",
  },
} as const;

async function main() {
  await prisma.company.upsert({
    where: { id: "organized-auto-transport" },
    update: COMPANY_BRANDING["organized-auto-transport"],
    create: {
      id: "organized-auto-transport",
      name: "Organized Auto Transport",
      legalName: "Organized Auto Transport LLC",
      ...COMPANY_BRANDING["organized-auto-transport"],
      email: "quotes@organizedautotransport.com",
      phone: "(317) 555-0188",
      address: "Indianapolis, IN",
      website: "https://organizedautotransport.com",
      defaultTerms:
        "Quote is valid until the expiration date shown. Final dispatch depends on carrier availability, route conditions, vehicle condition, and customer-provided pickup and delivery details.",
    },
  });

  await prisma.company.upsert({
    where: { id: "keener-logistics" },
    update: COMPANY_BRANDING["keener-logistics"],
    create: {
      id: "keener-logistics",
      name: "Keener Logistics",
      legalName: "Keener Logistics",
      ...COMPANY_BRANDING["keener-logistics"],
      email: "quotes@keenerlogistics.com",
      phone: "(317) 555-0144",
      address: "Indianapolis, IN",
      website: "https://keenerlogistics.com",
      defaultTerms:
        "Quote is valid until the expiration date shown. Pricing may change if shipment details, vehicle condition, or requested service window changes before acceptance.",
    },
  });

  for (const ghlLocationId of SEED_GHL_LOCATIONS) {
    for (const [appFieldKey, ghlCustomFieldName, fallbackPath] of mappings) {
      await prisma.ghlFieldMapping.upsert({
        where: {
          ghlLocationId_appFieldKey: {
            ghlLocationId,
            appFieldKey,
          },
        },
        update: {},
        create: {
          ghlLocationId,
          appFieldKey,
          ghlCustomFieldName,
          fallbackPath,
          isRequired: ["pickupCity", "pickupState", "deliveryCity", "deliveryState", "vehicleMake", "vehicleModel"].includes(
            appFieldKey,
          ),
        },
      });
    }
  }

  await seedSampleQuote();
}

async function seedSampleQuote() {
  const companyId = "organized-auto-transport";
  const customerTotal = 1295;
  const depositDue = 300;
  const balanceDue = 995;
  const carrierPay = 950;
  const acceptanceUrl = appUrl(`/accept/${SAMPLE_ACCEPT_TOKEN}`);

  const customer = await prisma.customerSnapshot.upsert({
    where: { id: SAMPLE_CUSTOMER_ID },
    update: {
      name: "Test Customer",
      email: "test@example.com",
      phone: "317-555-0100",
      companyName: null,
      ghlContactId: "sample-ghl-contact",
      ghlOpportunityId: "sample-ghl-opportunity",
    },
    create: {
      id: SAMPLE_CUSTOMER_ID,
      name: "Test Customer",
      email: "test@example.com",
      phone: "317-555-0100",
      ghlContactId: "sample-ghl-contact",
      ghlOpportunityId: "sample-ghl-opportunity",
    },
  });

  const quote = await prisma.quote.upsert({
    where: { quoteNumber: SAMPLE_QUOTE_NUMBER },
    update: {
      companyId,
      customerSnapshotId: customer.id,
      quoteMode: "OAT_DIRECT",
      status: "READY_TO_SEND",
      pickupCity: "Indianapolis",
      pickupState: "IN",
      pickupZip: "46204",
      deliveryCity: "Tampa",
      deliveryState: "FL",
      deliveryZip: "33602",
      trailerType: "Open carrier",
      customerTotal,
      depositDue,
      balanceDue,
      internalEstimatedCarrierPay: carrierPay,
      internalGrossMargin: customerTotal - carrierPay,
      internalMarginPercentage: ((customerTotal - carrierPay) / customerTotal) * 100,
      secureAccessToken: SAMPLE_ACCEPT_TOKEN,
      acceptanceUrl,
      ghlContactId: "sample-ghl-contact",
      ghlOpportunityId: "sample-ghl-opportunity",
      customerNotes: "SAMPLE / TEST QUOTE — for local development and customer flow testing only.",
      internalNotes: "SAMPLE / TEST QUOTE — do not send to real customers.",
      acceptedAt: null,
      declinedAt: null,
      declineReason: null,
      customerSignature: null,
      acceptedIp: null,
      acceptedUserAgent: null,
      declinedIp: null,
      declinedUserAgent: null,
      lastCustomerActionAt: null,
    },
    create: {
      quoteNumber: SAMPLE_QUOTE_NUMBER,
      quoteMode: "OAT_DIRECT",
      status: "READY_TO_SEND",
      companyId,
      customerSnapshotId: customer.id,
      pickupCity: "Indianapolis",
      pickupState: "IN",
      pickupZip: "46204",
      deliveryCity: "Tampa",
      deliveryState: "FL",
      deliveryZip: "33602",
      trailerType: "Open carrier",
      customerTotal,
      depositDue,
      balanceDue,
      internalEstimatedCarrierPay: carrierPay,
      internalGrossMargin: customerTotal - carrierPay,
      internalMarginPercentage: ((customerTotal - carrierPay) / customerTotal) * 100,
      secureAccessToken: SAMPLE_ACCEPT_TOKEN,
      acceptanceUrl,
      ghlContactId: "sample-ghl-contact",
      ghlOpportunityId: "sample-ghl-opportunity",
      customerNotes: "SAMPLE / TEST QUOTE — for local development and customer flow testing only.",
      internalNotes: "SAMPLE / TEST QUOTE — do not send to real customers.",
    },
  });

  await prisma.quoteFee.deleteMany({ where: { quoteId: quote.id } });
  await prisma.quoteFee.createMany({
    data: [
      {
        quoteId: quote.id,
        feeType: "CARRIER_PAY",
        label: "Carrier Pay",
        amount: carrierPay,
        isEnabled: true,
        showOnPdf: false,
        isInternalOnly: true,
        sortOrder: 10,
      },
      {
        quoteId: quote.id,
        feeType: "BROKER_FEE",
        label: "Transport Service",
        amount: customerTotal,
        isEnabled: true,
        showOnPdf: true,
        isInternalOnly: false,
        sortOrder: 20,
      },
    ],
  });

  await prisma.vehicleSnapshot.deleteMany({ where: { quoteId: quote.id } });
  await prisma.vehicleSnapshot.create({
    data: {
      quoteId: quote.id,
      year: "2020",
      make: "Ford",
      model: "F-150",
      type: "Truck",
      condition: "Running",
      isRunning: true,
    },
  });

  await prisma.quoteCustomerMessage.deleteMany({ where: { quoteId: quote.id } });
  await prisma.notification.deleteMany({ where: { quoteId: quote.id } });

  console.log(`Sample quote ready: ${quote.quoteNumber} (${quote.id})`);
  console.log(`Internal edit: ${appUrl(`/quotes/${quote.id}/edit`)}`);
  console.log(`Public accept: ${acceptanceUrl}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
