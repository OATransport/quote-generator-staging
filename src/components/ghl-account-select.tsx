import { Label } from "@/components/ui/label";
import { GHL_IMPORT_ACCOUNTS, type GhlImportAccountKey } from "@/lib/ghl-accounts";

export function GhlAccountSelect({
  name = "account",
  defaultValue,
}: {
  name?: string;
  defaultValue: GhlImportAccountKey;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>GHL account</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {GHL_IMPORT_ACCOUNTS.map((account) => (
          <option key={account.key} value={account.key}>
            {account.label}
          </option>
        ))}
      </select>
    </div>
  );
}
