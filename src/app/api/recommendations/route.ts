import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildRecommendation } from "@/lib/deck-engine";
import type { MTGFormat } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") as MTGFormat | null;
  const search = searchParams.get("search") ?? "";

  let query = supabase
    .from("meta_decks")
    .select("*")
    .order("popularity", { ascending: false })
    .limit(20);

  if (format) query = query.eq("format", format);
  if (search) query = query.ilike("deck_name", `%${search}%`);

  const { data: metaDecks, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!metaDecks || metaDecks.length === 0) return NextResponse.json([]);

  const { data: collection } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id);

  if (!collection) return NextResponse.json([]);

  const recommendations = await Promise.all(
    metaDecks.map((deck) => buildRecommendation(deck, collection))
  );

  recommendations.sort((a, b) => b.coveragePercent - a.coveragePercent);

  return NextResponse.json(recommendations);
}
