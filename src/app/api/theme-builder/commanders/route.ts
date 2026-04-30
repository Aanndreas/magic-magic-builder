import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { findThemeCommanders } from "@/lib/theme-builder";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme");
  if (!theme) return NextResponse.json({ error: "theme krävs" }, { status: 400 });

  const { data: collection } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id);

  const commanders = await findThemeCommanders(theme, collection ?? []);
  return NextResponse.json(commanders);
}
