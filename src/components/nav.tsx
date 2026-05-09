"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Library, Wand2, Bookmark, LogOut, Sun, Moon, Monitor } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useCurrency } from "@/contexts/currency-context";

const navItems = [
  { href: "/dashboard",  label: "Hem",             icon: LayoutDashboard },
  { href: "/collection", label: "Min samling",     icon: Library },
  { href: "/builder",    label: "Lek-byggaren",    icon: Wand2 },
  { href: "/saved",      label: "Sparade lekar",   icon: Bookmark },
];

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center shrink-0" title="Till Dashboard">
              <Image
                src="/images/MagicBuilderIcon.png"
                alt="Magic Builder"
                width={120}
                height={80}
                className="h-9 w-auto rounded-md object-contain transition-opacity hover:opacity-80"
                priority
              />
            </Link>

            <nav className="hidden sm:flex items-center gap-0.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                      active
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrency(currency === "SEK" ? "USD" : "SEK")}
              className="text-muted-foreground hover:text-foreground text-xs font-medium w-14"
            >
              {currency === "SEK" ? "kr SEK" : "$ USD"}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (theme === "system") setTheme("light");
                else if (theme === "light") setTheme("dark");
                else setTheme("system");
              }}
            >
              {theme === "light" ? <Sun className="w-4 h-4" /> : theme === "dark" ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logga ut</span>
          </Button>
        </div>
      </header>

      <nav
        className="fixed bottom-0 inset-x-0 z-50 sm:hidden border-t border-border/60 bg-background/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium uppercase tracking-wider leading-none">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
