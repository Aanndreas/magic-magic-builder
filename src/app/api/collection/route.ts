import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCardByName } from "@/lib/scryfall";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("card_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { card_name, quantity = 1, foil = false, set_code, collector_number } = body;

  if (!card_name) return NextResponse.json({ error: "card_name required" }, { status: 400 });

  const scryfallCard = await getCardByName(card_name);
  if (!scryfallCard) return NextResponse.json({ error: "Card not found on Scryfall" }, { status: 404 });

  const { data, error } = await supabase
    .from("collection_cards")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({
      user_id: user.id,
      scryfall_id: scryfallCard.id,
      card_name: scryfallCard.name,
      quantity,
      foil,
      set_code: set_code ?? scryfallCard.set,
      collector_number: collector_number ?? scryfallCard.collector_number,
    } as any, { onConflict: "user_id,scryfall_id,foil" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { error } = await supabase
      .from("collection_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("collection_cards")
      .delete()
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
