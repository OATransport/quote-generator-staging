import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Seeded business profiles</p>
        <h2 className="text-3xl font-bold tracking-normal">Company settings</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader>
              <CardTitle>{company.legalName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Email:</span> {company.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {company.phone}
              </p>
              <p>
                <span className="font-medium">Address:</span> {company.address}
              </p>
              <p className="leading-6 text-muted-foreground">{company.defaultTerms}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
