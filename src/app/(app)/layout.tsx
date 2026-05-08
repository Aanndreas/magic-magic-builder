import Nav from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/4 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-purple-500/3 blur-3xl" />
      </div>
      <Nav />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 animate-fade-up">
        {children}
      </main>
    </div>
  );
}
