import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count: collectionCount } = await supabase
    .from("collection_cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { count: metaDeckCount } = await supabase
    .from("meta_decks")
    .select("*", { count: "exact", head: true });

  const { data: latestMetaRows } = await supabase
    .from("meta_decks")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1);
  const latestMeta = latestMetaRows?.[0] as { fetched_at: string } | undefined;

  const formats = ["commander", "standard", "pauper"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Välkommen till Magic Magic Builder</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kort i samlingen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{collectionCount ?? 0}</div>
            <Link href="/collection">
              <Button variant="link" className="p-0 h-auto text-xs mt-1">Hantera samling →</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta-lekar i databasen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metaDeckCount ?? 0}</div>
            {latestMeta && (
              <p className="text-xs text-muted-foreground mt-1">
                Uppdaterad {new Date(latestMeta.fetched_at).toLocaleDateString("sv-SE")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Format som stöds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mt-1">
              {formats.map((f) => (
                <Badge key={f} variant="secondary" className="capitalize">{f}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kom igång</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
            <div>
              <p className="font-medium">Importera din kortsamling</p>
              <p className="text-sm text-muted-foreground">Ladda upp en CSV från Moxfield, eller lägg till kort manuellt.</p>
              <Link href="/collection"><Button size="sm" className="mt-2">Gå till samlingen</Button></Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
            <div>
              <p className="font-medium">Bygg din lek</p>
              <p className="text-sm text-muted-foreground">Välj format och se vilka meta-lekar du redan kan bygga — eller nästan kan bygga.</p>
              <Link href="/builder"><Button size="sm" className="mt-2">Öppna lek-byggaren</Button></Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
            <div>
              <p className="font-medium">Köp de saknade korten</p>
              <p className="text-sm text-muted-foreground">Få en lista på exakt vilka kort du behöver köpa — och till vilket pris.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
