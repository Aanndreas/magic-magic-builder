"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";

export default function RegisterPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Kolla din e-post för att bekräfta kontot!");
      router.push("/auth/login");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-fade-up relative">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold gradient-text">Magic Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Skapa ett konto och kom igång</p>
        </div>

        <form
          onSubmit={handleRegister}
          className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 space-y-5 shadow-xl"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-foreground/80">E-post</Label>
            <Input
              id="email"
              type="email"
              placeholder="din@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-foreground/80">Lösenord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minst 6 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="bg-background/60"
            />
          </div>

          <Button
            type="submit"
            className="w-full glow-gold font-semibold"
            disabled={loading}
          >
            {loading ? "Skapar konto..." : "Skapa konto"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Har du redan ett konto?{" "}
            <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Logga in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
