import "server-only";

import type { QuoteMode } from "@prisma/client";
import { mockCompanyToGhlLocationId } from "@/lib/ghl-field-mappings";

type GhlCustomField = {
  key?: string;
  name?: string;
  fieldKey?: string;
  field_value?: unknown;
  value?: unknown;
};

type GhlContact = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  customFields?: GhlCustomField[];
};

export type MockGhlOpportunity = {
  id: string;
  companyId: string;
  quoteMode: QuoteMode;
  opportunity: {
    id: string;
    name: string;
    contactId: string;
    pipelineId: string;
    pipelineStageId: string;
    monetaryValue: number;
    createdAt: string;
    updatedAt: string;
    customFields: GhlCustomField[];
    contact: GhlContact;
  };
};

const MOCK_PIPELINE_ID = "mock-pipeline-quote-leads";
const MOCK_STAGE_NEW = "mock-stage-new-lead";
const MOCK_STAGE_QUOTED = "mock-stage-quoted";

function fields(values: Record<string, string | number>): GhlCustomField[] {
  return Object.entries(values).map(([name, field_value]) => ({
    key: name,
    name,
    fieldKey: name,
    field_value,
    value: field_value,
  }));
}

export const mockGhlOpportunities: MockGhlOpportunity[] = [
  {
    id: "mock-ghl-opp-oat-001",
    companyId: "organized-auto-transport",
    quoteMode: "OAT_DIRECT",
    opportunity: {
      id: "mock-ghl-opp-oat-001",
      name: "2020 Ford F-150 — Indianapolis to Tampa",
      contactId: "mock-ghl-contact-oat-001",
      pipelineId: MOCK_PIPELINE_ID,
      pipelineStageId: MOCK_STAGE_NEW,
      monetaryValue: 1295,
      createdAt: "2026-05-10T14:30:00.000Z",
      updatedAt: "2026-05-18T09:15:00.000Z",
      customFields: fields({
        pickup_city: "Indianapolis",
        pickup_state: "IN",
        pickup_zip: "46204",
        delivery_city: "Tampa",
        delivery_state: "FL",
        delivery_zip: "33602",
        trailer_type: "Open carrier",
        vehicle_year: "2020",
        vehicle_make: "Ford",
        vehicle_model: "F-150",
        vehicle_type: "Truck",
        vehicle_condition: "Running",
        vehicle_is_running: "yes",
        customer_total: 1295,
        deposit_due: 300,
        balance_due: 995,
        estimated_carrier_pay: 950,
      }),
      contact: {
        id: "mock-ghl-contact-oat-001",
        name: "Michael Turner",
        firstName: "Michael",
        lastName: "Turner",
        email: "michael.turner@example.com",
        phone: "(317) 555-0122",
        customFields: fields({
          pickup_city: "Indianapolis",
          pickup_state: "IN",
          delivery_city: "Tampa",
          delivery_state: "FL",
        }),
      },
    },
  },
  {
    id: "mock-ghl-opp-keener-001",
    companyId: "keener-logistics",
    quoteMode: "KEENER_LOGISTICS",
    opportunity: {
      id: "mock-ghl-opp-keener-001",
      name: "2019 Toyota Camry — Chicago to Dallas",
      contactId: "mock-ghl-contact-keener-001",
      pipelineId: MOCK_PIPELINE_ID,
      pipelineStageId: MOCK_STAGE_QUOTED,
      monetaryValue: 985,
      createdAt: "2026-05-12T16:45:00.000Z",
      updatedAt: "2026-05-19T11:20:00.000Z",
      customFields: fields({
        pickup_city: "Chicago",
        pickup_state: "IL",
        pickup_zip: "60601",
        delivery_city: "Dallas",
        delivery_state: "TX",
        delivery_zip: "75201",
        trailer_type: "Enclosed",
        vehicle_year: "2019",
        vehicle_make: "Toyota",
        vehicle_model: "Camry",
        vehicle_type: "Sedan",
        vehicle_condition: "Running",
        vehicle_is_running: "yes",
        customer_total: 985,
        deposit_due: 250,
        balance_due: 735,
        estimated_carrier_pay: 720,
      }),
      contact: {
        id: "mock-ghl-contact-keener-001",
        name: "Sarah Mitchell",
        firstName: "Sarah",
        lastName: "Mitchell",
        email: "sarah.mitchell@example.com",
        phone: "(312) 555-0198",
        companyName: "Mitchell Consulting",
        customFields: fields({
          pickup_city: "Chicago",
          pickup_state: "IL",
          delivery_city: "Dallas",
          delivery_state: "TX",
        }),
      },
    },
  },
  {
    id: "mock-ghl-opp-oat-002",
    companyId: "organized-auto-transport",
    quoteMode: "OAT_IF_BROKERED",
    opportunity: {
      id: "mock-ghl-opp-oat-002",
      name: "2021 Jeep Wrangler — Phoenix to Denver",
      contactId: "mock-ghl-contact-oat-002",
      pipelineId: MOCK_PIPELINE_ID,
      pipelineStageId: MOCK_STAGE_NEW,
      monetaryValue: 1145,
      createdAt: "2026-05-15T10:00:00.000Z",
      updatedAt: "2026-05-20T08:30:00.000Z",
      customFields: fields({
        pickup_city: "Phoenix",
        pickup_state: "AZ",
        pickup_zip: "85004",
        delivery_city: "Denver",
        delivery_state: "CO",
        delivery_zip: "80202",
        trailer_type: "Open carrier",
        vehicle_year: "2021",
        vehicle_make: "Jeep",
        vehicle_model: "Wrangler",
        vehicle_type: "SUV",
        vehicle_condition: "Running",
        vehicle_is_running: "yes",
        customer_total: 1145,
        deposit_due: 275,
        balance_due: 870,
        estimated_carrier_pay: 840,
      }),
      contact: {
        id: "mock-ghl-contact-oat-002",
        name: "James Rivera",
        firstName: "James",
        lastName: "Rivera",
        email: "james.rivera@example.com",
        phone: "(602) 555-0164",
        customFields: fields({
          pickup_city: "Phoenix",
          pickup_state: "AZ",
          delivery_city: "Denver",
          delivery_state: "CO",
        }),
      },
    },
  },
];

const mockById = new Map(mockGhlOpportunities.map((entry) => [entry.id, entry]));

export function getMockGhlOpportunity(opportunityId: string) {
  return mockById.get(opportunityId);
}

export function getMockGhlContact(contactId: string) {
  const entry = mockGhlOpportunities.find((item) => item.opportunity.contactId === contactId);
  return entry?.opportunity.contact;
}

export function searchMockGhlOpportunities(
  query: string,
  options?: { stageId?: string; ghlLocationId?: string },
) {
  const needle = query.trim().toLowerCase();
  return mockGhlOpportunities.filter((entry) => {
    if (options?.ghlLocationId && mockCompanyToGhlLocationId(entry.companyId) !== options.ghlLocationId) {
      return false;
    }
    const { opportunity } = entry;
    const contact = opportunity.contact;
    const haystack = [
      entry.id,
      opportunity.name,
      contact.name,
      contact.email,
      contact.phone,
      opportunity.customFields.find((f) => f.name === "pickup_city")?.value,
      opportunity.customFields.find((f) => f.name === "delivery_city")?.value,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !needle || haystack.includes(needle);
    const matchesStage = !options?.stageId || opportunity.pipelineStageId === options.stageId;
    return matchesQuery && matchesStage;
  });
}
