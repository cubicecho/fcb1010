import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { MidiStatusBadge } from '@/components/midi/MidiStatusBadge';

const NAV_ITEMS = [
  { to: '/monitor', label: 'Monitor' },
  { to: '/presets', label: 'Presets' },
  { to: '/setup', label: 'Setup' },
] as const;

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Link to="/monitor" className="font-heading font-semibold tracking-tight">
            FCB1010 <span className="text-muted-foreground">UNO</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: 'bg-accent text-accent-foreground' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <MidiStatusBadge />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
