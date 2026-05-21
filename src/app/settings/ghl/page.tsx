import Link from "next/link";
import { saveMappingAction } from "@/app/actions";
import { GhlAccountCards } from "@/components/ghl-mapping/ghl-account-cards";
import { GhlFieldIndicatorBadges } from "@/components/ghl-mapping/ghl-field-indicator-badges";
import {
  GhlMappingPageIntro,
  GhlMappingSafetyPanel,
  GhlMappingSectionIntro,
} from "@/components/ghl-mapping/ghl-mapping-guidance";
import {
  GhlMappingSummaryTable,
  mappingsByLocationFromRecords,
} from "@/components/ghl-mapping/ghl-mapping-summary-table";
import { leadImportFieldMeta, quoteResultFieldMeta } from "@/lib/ghl-field-mapping-meta";
import {
  getActiveGhlLocationIdOrNull,
  getGhlFieldMappingsForLocation,
  KEENER_GHL_LOCATION_ID,
  OAT_GHL_LOCATION_ID,
} from "@/lib/ghl-field-mappings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isGhlAutoSyncBackEnabled, isGhlSyncBackEnabled } from "@/server/ghl";

export const dynamic = "force-dynamic";

const legacyCommonFields = [
  "pickupAddress",
  "pickupCity",
  "pickupState",
  "pickupZip",
  "deliveryAddress",
  "deliveryCity",
  "deliveryState",
  "deliveryZip",
  "vehicleYear",
  "vehicleMake",
  "vehicleModel",
  "vehicleType",
  "vehicleCondition",
  "vehicleVin",
  "vehicleIsRunning",
  "customerTotal",
  "depositDue",
  "balanceDue",
  "trailerType",
  "quoteAcceptanceUrl",
  "quotePdfUrl",
] as const;

export default async function GhlSettingsPage() {
  const activeLocationId = getActiveGhlLocationIdOrNull();
  const [oatMappings, keenerMappings] = await Promise.all([
    getGhlFieldMappingsForLocation(OAT_GHL_LOCATION_ID),
    getGhlFieldMappingsForLocation(KEENER_GHL_LOCATION_ID),
  ]);
  const mappingsByLocation = mappingsByLocationFromRecords([...oatMappings, ...keenerMappings]);

  return (
    <div className="max-w-6xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <GhlMappingPageIntro />
        <Button asChild variant="outline">
          <Link href="/dashboard/settings/ghl-field-mapping">Open full mapping editor</Link>
        </Button>
      </div>

      <GhlMappingSafetyPanel
        sync={{
          syncBackEnabled: isGhlSyncBackEnabled(),
          autoSyncBackEnabled: isGhlAutoSyncBackEnabled(),
        }}
      />

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">GHL accounts</h3>
        <GhlAccountCards activeLocationId={activeLocationId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapping reference</CardTitle>
          <CardDescription>
            Use the full mapping editor for dropdown-based updates. This page keeps a legacy add/update form and a
            read-only overview for both accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-3">
            <GhlMappingSectionIntro
              title="Intake mappings"
              direction="ghl-to-app"
              helperText="These fields are read from GHL when importing or refreshing a quote."
            />
            <GhlMappingSummaryTable
              title="Intake overview"
              fields={leadImportFieldMeta}
              mappingsByLocation={mappingsByLocation}
            />
          </section>

          <section className="space-y-3">
            <GhlMappingSectionIntro
              title="Quote-result mappings"
              direction="app-to-ghl"
              helperText="These fields are written back to GHL only during manual sync while sync writes are enabled."
            />
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Public Acceptance URL</p>
              <GhlFieldIndicatorBadges
                indicators={["critical", "live-link-primary", "written-to-ghl", "customer-facing"]}
                className="mt-2"
              />
              <p className="mt-2 text-muted-foreground">
                Primary customer link. Always prioritize this over PDF URLs when sending quotes.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Quote PDF URL</p>
              <GhlFieldIndicatorBadges
                indicators={["optional", "pdf-optional", "written-to-ghl"]}
                className="mt-2"
              />
              <p className="mt-2 text-muted-foreground">
                Optional supporting document. Missing PDF URLs are acceptable on staging and in normal workflows.
              </p>
            </div>
            <GhlMappingSummaryTable
              title="Quote-result overview"
              fields={quoteResultFieldMeta}
              mappingsByLocation={mappingsByLocation}
            />
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy add or update mapping</CardTitle>
          <CardDescription>
            Updates the active environment location only. Prefer the full mapping editor unless you need a raw fallback
            path or manual field key entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveMappingAction} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="appFieldKey">App field</Label>
              <Input id="appFieldKey" name="appFieldKey" list="app-fields" required />
              <datalist id="app-fields">
                {legacyCommonFields.map((field) => (
                  <option key={field} value={field} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghlCustomFieldId">GHL custom field ID</Label>
              <Input id="ghlCustomFieldId" name="ghlCustomFieldId" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghlCustomFieldName">GHL custom field name/key</Label>
              <Input id="ghlCustomFieldName" name="ghlCustomFieldName" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Save
              </Button>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="fallbackPath">Fallback path</Label>
              <Input id="fallbackPath" name="fallbackPath" placeholder="contact.email or monetaryValue" />
            </div>
            <label className="flex items-center gap-2 self-end text-sm font-medium">
              <input type="checkbox" name="isRequired" className="h-4 w-4" /> Required
            </label>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
