import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SavedClient from "./saved-client";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: saved } = await supabase
    .from("saved_recommendations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <SavedClient initialSaved={saved ?? []} />;
}
