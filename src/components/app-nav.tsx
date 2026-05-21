import Link from "next/link";
import { FileText, Home, Plug, Settings, SlidersHorizontal } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/dashboard/import-ghl", label: "Import", icon: Plug },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/settings/companies", label: "Companies", icon: Settings },
  { href: "/dashboard/settings/ghl-field-mapping", label: "GHL Mapping", icon: SlidersHorizontal },
];

export function AppNav() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/40 p-4 md:block">
      <div className="mb-8">
        <p className="text-sm font-semibold text-muted-foreground">Quote add-on</p>
        <h1 className="text-xl font-bold tracking-normal">OAT + Keener</h1>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-background"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
