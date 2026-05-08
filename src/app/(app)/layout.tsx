import Nav from "@/components/nav";
import { PageTransition } from "@/components/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-purple-500/6 blur-3xl" />
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[900px] h-[250px] rounded-full bg-primary/3 blur-3xl" />
      </div>
      <Nav />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 pb-24 sm:pb-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
