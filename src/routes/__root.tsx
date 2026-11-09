import { createLink, createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { AppBar } from '@/components/app-bar';
import { LayoutGrid } from '@/components/app-icons';
import { FirmwareBadge } from '@/components/fcb/FirmwareBadge';
import { HeaderContentFooter } from '@/components/header-content-footer';
import { MidiStatusBadge } from '@/components/midi/MidiStatusBadge';
import { AppBarItem } from '@/components/sidebar';
import { Activity, Settings } from '@/components/ui/icons';
import { ThemePicker } from '@/components/ui/theme-picker';
import { useThemePreference } from '@/components/ui/theme-preference';

const BarLink = createLink(AppBarItem);

const NAV_ITEMS = [
  { to: '/monitor', label: 'Monitor', Icon: Activity },
  { to: '/presets', label: 'Presets', Icon: LayoutGrid },
  { to: '/setup', label: 'Setup', Icon: Settings },
] as const;

function Brand() {
  return (
    <Link to="/monitor" className="font-semibold tracking-tight">
      FCB1010 <span className="text-foreground/60">UNO</span>
    </Link>
  );
}

function RootLayout() {
  // Applies the stored light / dark / system choice to <html>.
  useThemePreference();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <HeaderContentFooter
      className="h-svh"
      headerSlot={
        <AppBar
          brandSlot={<Brand />}
          navLabel="Main"
          navSlot={NAV_ITEMS.map(({ to, label, Icon }) => (
            <BarLink key={to} to={to} label={label} iconSlot={<Icon />} active={pathname.endsWith(to)} />
          ))}
          actionSlot={
            <>
              <FirmwareBadge />
              <MidiStatusBadge />
              <ThemePicker variant="compact" />
            </>
          }
        />
      }
      contentSlot={
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      }
    />
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
