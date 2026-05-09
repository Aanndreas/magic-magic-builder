import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Library, Wand2, TrendingUp, BookOpen, Layers, Star } from "lucide-react";
import type { SavedRecommendation } from "@/lib/supabase/types";
import DashboardValueCard from "./dashboard-value-card";
import { DashboardSavedCard } from "./dashboard-saved-card";

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
  const latestMeta    = latestMetaRows?.[0] as { fetched_at: string } | undefined;
  const hasCards      = (uniqueCards ?? 0) > 0;
  const saved         = (savedRows ?? []) as SavedRecommendation[];
  const formats       = ["Commander", "Standard", "Pioneer", "Modern", "Pauper"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Hem</h1>
        <p className="text-muted-foreground mt-1 text-sm">Magic Magic Builder — din kortsamling, dina lekar</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Unique cards */}
        <div className="rounded-xl border border-border/60 border-t-4 border-t-primary/70 bg-card p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/6 blur-2xl -translate-y-6 translate-x-6" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Unika kort</span>
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Library className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <div className="text-4xl font-black tabular-nums">{uniqueCards ?? 0}</div>
          <div className="text-xs text-muted-foreground">{totalQuantity} totalt i samlingen</div>
        </div>

        {/* Collection value */}
        <DashboardValueCard hasCards={hasCards} />

        {/* Meta decks */}
        <div className="rounded-xl border border-border/60 border-t-4 border-t-purple-500/70 bg-card p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-purple-500/8 blur-2xl -translate-y-6 translate-x-6" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Meta-lekar</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-purple-400" />
            </div>
          </div>
          <div className="text-4xl font-black tabular-nums">{metaDeckCount ?? 0}</div>
          {latestMeta && (
            <div className="text-xs text-muted-foreground">
              Uppdaterad {new Date(latestMeta.fetched_at).toLocaleDateString("sv-SE")}
            </div>
          )}
        </div>

        {/* Formats */}
        <div className="rounded-xl border border-border/60 border-t-4 border-t-blue-500/70 bg-card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-blue-500/8 blur-2xl -translate-y-6 translate-x-6" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Format</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Star className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {formats.map((f) => (
              <Badge key={f} variant="secondary" className="text-xs px-2 py-0.5">{f}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Saved recommendations */}
      {saved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <BookOpen className="w-3.5 h-3.5" /> Sparade lekar
            </h2>
            <Link href="/saved">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary">Se alla →</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {saved.map((s) => (
              <DashboardSavedCard key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
          <Wand2 className="w-3.5 h-3.5" /> Snabbstart
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/collection">
            <div className="group rounded-xl border border-border/60 hover:border-primary/30 bg-card p-5 cursor-pointer card-hover-glow transition-all duration-200 h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <p className="font-semibold text-sm">Min samling</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasCards
                  ? `${uniqueCards} unika kort importerade`
                  : "Importera din Moxfield-CSV för att komma igång"}
              </p>
            </div>
          </Link>

          <Link href="/builder">
            <div className="group rounded-xl border border-border/60 bg-card p-5 cursor-pointer card-hover-glow transition-all duration-200 h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <p className="font-semibold text-sm">Meta-lekar</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Se vilka lekar du kan bygga med din samling — och vad som saknas
              </p>
            </div>
          </Link>

          <Link href="/builder">
            <div className="group rounded-xl border border-border/60 bg-card p-5 cursor-pointer card-hover-glow transition-all duration-200 h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                </div>
                <p className="font-semibold text-sm">Commander-lek</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Sök valfri commander och bygg en lek med din samling som bas
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
