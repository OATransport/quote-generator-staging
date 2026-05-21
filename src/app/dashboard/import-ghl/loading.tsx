import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingImportGhlPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="mt-3 h-9 w-72 rounded bg-muted" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Loading pipeline opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
