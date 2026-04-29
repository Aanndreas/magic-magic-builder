import { createClient } from "@/lib/supabase/server";
import CollectionClient from "./collection-client";

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cards } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user!.id)
    .order("card_name");

  return <CollectionClient initialCards={cards ?? []} />;
}
