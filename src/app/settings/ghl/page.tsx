import { saveMappingAction } from "@/app/actions";
import { getGhlFieldMappingsForActiveLocation } from "@/lib/ghl-field-mappings";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

const commonFields = [
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
] as const;

export default async function GhlSettingsPage() {
  const mappings = await getGhlFieldMappingsForActiveLocation();

  return (
    <div className="max-w-6xl space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Map existing GHL fields</p>
        <h2 className="text-3xl font-bold tracking-normal">GHL field mapping</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add or update a mapping</CardTitle>
          <CardDescription>
            The importer checks the configured custom field ID/name first, then falls back to a JSON path on the GHL opportunity or contact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveMappingAction} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="appFieldKey">App field</Label>
              <Input id="appFieldKey" name="appFieldKey" list="app-fields" required />
              <datalist id="app-fields">
                {commonFields.map((field) => (
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
              <Button type="submit" className="w-full">Save</Button>
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

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">App field</th>
              <th className="p-3">Custom field ID</th>
              <th className="p-3">Name/key</th>
              <th className="p-3">Fallback</th>
              <th className="p-3">Required</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id} className="border-t">
                <td className="p-3 font-medium">{mapping.appFieldKey}</td>
                <td className="p-3">{mapping.ghlCustomFieldId ?? ""}</td>
                <td className="p-3">{mapping.ghlCustomFieldName ?? ""}</td>
                <td className="p-3">{mapping.fallbackPath ?? ""}</td>
                <td className="p-3">{mapping.isRequired ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!mappings.length && (
              <tr>
                <td className="p-6 text-muted-foreground" colSpan={5}>
                  No mappings yet. Run the seed script or add mappings above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
