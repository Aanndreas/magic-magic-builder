import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildThemeDeck } from "@/lib/theme-builder";
import type { MTGFormat } from "@/lib/supabase/types";
import type { Strategy } from "@/lib/theme-builder";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { theme, format, strategy, commanderScryfallId } = body;

  if (!format) {
    return NextResponse.json({ error: "format krävs" }, { status: 400 });
  }
  if (!theme && !commanderScryfallId) {
    return NextResponse.json({ error: "theme eller commanderScryfallId krävs" }, { status: 400 });
  }

  const { data: collection } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id);

  try {
    const result = await buildThemeDeck({
      theme,
      format: format as MTGFormat,
      strategy: strategy as Strategy | undefined,
      commanderScryfallId,
      collection: collection ?? [],
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunde inte bygga leken" },
      { status: 500 }
    );
  }
}
