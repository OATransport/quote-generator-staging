import "server-only";

import { isGhlAutoSyncBackEnabled, isGhlSyncBackEnabled } from "@/server/ghl";

export const AUTOMATIC_SYNC_BACK_TRIGGERS = [
  "PDF_GENERATED",
  "CUSTOMER_ACCEPTED",
  "CUSTOMER_DECLINED",
  "CUSTOMER_QUESTION",
] as const;

export type AutomaticSyncBackTrigger = (typeof AUTOMATIC_SYNC_BACK_TRIGGERS)[number];
export type SyncBackTriggerKind = "manual" | "automatic" | "other";

export type SyncBackWritePermission = {
  trigger: string;
  triggerKind: SyncBackTriggerKind;
  syncBackEnabled: boolean;
  autoSyncBackEnabled: boolean;
  realWriteAllowed: boolean;
  skipReason?: string;
};

export function classifySyncBackTrigger(trigger: string): SyncBackTriggerKind {
  if (trigger === "MANUAL") return "manual";
  if ((AUTOMATIC_SYNC_BACK_TRIGGERS as readonly string[]).includes(trigger)) return "automatic";
  return "other";
}

export function evaluateSyncBackWritePermission(trigger: string): SyncBackWritePermission {
  const syncBackEnabled = isGhlSyncBackEnabled();
  const autoSyncBackEnabled = isGhlAutoSyncBackEnabled();
  const triggerKind = classifySyncBackTrigger(trigger);

  if (!syncBackEnabled) {
    return {
      trigger,
      triggerKind,
      syncBackEnabled,
      autoSyncBackEnabled,
      realWriteAllowed: false,
      skipReason: "GHL_SYNC_BACK_ENABLED is not true.",
    };
  }

  if (triggerKind === "manual") {
    return {
      trigger,
      triggerKind,
      syncBackEnabled,
      autoSyncBackEnabled,
      realWriteAllowed: true,
    };
  }

  if (triggerKind === "automatic" && !autoSyncBackEnabled) {
    return {
      trigger,
      triggerKind,
      syncBackEnabled,
      autoSyncBackEnabled,
      realWriteAllowed: false,
      skipReason: "Automatic real sync is disabled; use manual sync.",
    };
  }

  if (triggerKind === "automatic" && autoSyncBackEnabled) {
    return {
      trigger,
      triggerKind,
      syncBackEnabled,
      autoSyncBackEnabled,
      realWriteAllowed: true,
    };
  }

  return {
    trigger,
    triggerKind,
    syncBackEnabled,
    autoSyncBackEnabled,
    realWriteAllowed: false,
    skipReason: "Only MANUAL sync is allowed unless GHL_AUTO_SYNC_BACK_ENABLED is true.",
  };
}
