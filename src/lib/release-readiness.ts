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
      id: "pricing-mode",
      label: "Pricing mode",
      status: "ready",
      note: "Simple Transportation Price vs Build Price From Itemized Breakdown — no hybrid mismatch behavior.",
    },
    {
      id: "itemized-build-mode",
      label: "Itemized build mode",
      status: "ready",
      note: "Customer line items auto-calculate service price; internal-only rows never affect customer total.",
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
      id: "route-map",
      label: "Public route map",
      status: "needs_review",
      note: "Recognizable U.S. silhouette with route line when coordinates exist; premium card fallback otherwise.",
    },
    {
      id: "public-quote",
      label: "Public quote page",
      status: "needs_review",
      note: "Hero, pricing card, disclaimers, and accept flow — pending visual approval.",
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
          : "Disabled by design. No real GHL writes until feature lock is complete.",
    },
    {
      id: "manual-quote",
      label: "Manual quote creation",
      status: "needs_review",
      note: "Basic new quote flow exists; full manual builder polish is coming soon.",
    },
  ];
}
