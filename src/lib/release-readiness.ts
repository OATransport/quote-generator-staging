export type ReadinessStatus = "ready" | "needs_review" | "disabled";

export type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  note: string;
};

export function getReleaseReadinessItems(): ReadinessItem[] {
  const syncBackEnabled = process.env.GHL_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
  const autoSyncEnabled = process.env.GHL_AUTO_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";

  return [
    {
      id: "quote-model",
      label: "Quote model selector",
      status: "ready",
      note: "OAT Direct, OAT Brokered, and Keener Logistics models guide labels and internal math.",
    },
    {
      id: "pricing-model",
      label: "Pricing model",
      status: "ready",
      note: "Transportation service price, deposit, balance on delivery, and internal carrier/broker math.",
    },
    {
      id: "itemized-breakdown",
      label: "Itemized breakdown",
      status: "ready",
      note: "Simple total vs itemized customer breakdown with mismatch fix actions.",
    },
    {
      id: "vehicle-editing",
      label: "Vehicle editing",
      status: "ready",
      note: "Editable vehicle and shipment fields save locally on the quote.",
    },
    {
      id: "zip-autofill",
      label: "ZIP autofill",
      status: "ready",
      note: "Pickup and delivery ZIP lookup via /api/zip-lookup.",
    },
    {
      id: "public-quote",
      label: "Public quote page",
      status: "ready",
      note: "Customer-ready live quote with deposit and balance on delivery wording.",
    },
    {
      id: "route-map",
      label: "Route map visual",
      status: "needs_review",
      note: "USA route map when ZIP coordinates are available; premium card fallback otherwise.",
    },
    {
      id: "ghl-import",
      label: "GHL import",
      status: "ready",
      note: "Import opportunities into local quotes without automatic write-back.",
    },
    {
      id: "ghl-sync-back",
      label: "GHL sync-back",
      status: syncBackEnabled || autoSyncEnabled ? "needs_review" : "disabled",
      note:
        syncBackEnabled || autoSyncEnabled
          ? "Sync-back flags are enabled — review carefully before production writes."
          : "Disabled by design on staging. Manual sync logs SKIPPED.",
    },
    {
      id: "manual-quote",
      label: "Manual quote creation",
      status: "needs_review",
      note: "Basic new quote flow exists; full manual builder polish is coming soon.",
    },
  ];
}
