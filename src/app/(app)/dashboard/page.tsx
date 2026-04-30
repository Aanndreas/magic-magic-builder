import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, Layers, TrendingUp } from "lucide-react";
import type { SavedRecommendation } from "@/lib/supabase/types";
import DashboardValueCard from "./dashboard-value-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { count: uniqueCards },
    { data: quantityRows },
    { count: metaDeckCount },
    { data: savedRows },
    { data: latestMetaRows },
  ] = await Promise.all([
    supabase.from("collection_cards").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("collection_cards").select("quantity").eq("user_id", user!.id) as Promise<{ data: Array<{ quantity: number }> | null }>,
    supabase.from("meta_decks").select("*", { count: "exact", head: true }),
    supabase.from("saved_recommendations").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("meta_decks").select("fetched_at").order("fetched_at", { ascending: false }).limit(1),
  ]);

  const totalQuantity = (quantityRows ?? []).reduce((s, r) => s + r.quantity, 0);
  const latestMeta = latestMetaRows?.[0] as { fetched_at: string } | undefined;
  const hasCards = (uniqueCards ?? 0) > 0;
  const saved = (savedRows ?? []) as SavedRecommendation[];

  const formats = ["Commander", "Standard", "Pioneer", "Modern", "Pauper"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Magic Magic Builder</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{uniqueCards ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Unika kort</div>
            <div className="text-sm text-muted-foreground">{totalQuantity} totalt</div>
          </CardContent>
        </Card>

        <DashboardValueCard hasCards={hasCards} />

        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{metaDeckCount ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Meta-lekar</div>
            {latestMeta && (
              <div className="text-xs text-muted-foreground">
                {new Date(latestMeta.fetched_at).toLocaleDateString("sv-SE")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm font-medium mb-1.5">Format</div>
            <div className="flex flex-wrap gap-1">
              {formats.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved recommendations */}
      {saved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Sparade lekar
            </h2>
            <Link href="/saved">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">Se alla →</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {saved.map((s) => {
              const budget = Array.isArray(s.cards_to_buy_budget) ? s.cards_to_buy_budget as Array<{ price_usd?: number; quantity: number }> : [];
              const cost = budget.reduce((sum, c) => sum + (c.price_usd ?? 0) * c.quantity, 0);
              return (
                <Link key={s.id} href="/saved">
                  <Card className="hover:border-primary transition-colors cursor-pointer">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{s.deck_name}</p>
                        <Badge variant="secondary" className="capitalize text-xs shrink-0">{s.format}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Budget: ${cost.toFixed(2)} · {budget.length} kort att köpa
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Snabbstart
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/collection">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Min samling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {hasCards
                    ? `${uniqueCards} unika kort importerade`
                    : "Importera din Manabox-CSV för att komma igång"}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/builder">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Meta-lekar</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Se vilka lekar du kan bygga med din samling — och vad som saknas
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/builder">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Commander-lek</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Sök valfri commander och bygg en lek med din samling som bas
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
