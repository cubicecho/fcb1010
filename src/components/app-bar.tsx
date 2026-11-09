import type { ReactNode } from 'react';
import { cn, hasSlot, type SlotNode } from '@/lib/utils';

/**
 * The places' row. Its gap is the bar's own and the actions', `PageHeader`'s `gap-2`, so a place
 * and an action sit as far apart as two actions do. On device an `AppBarItem` is a 44pt box round
 * its 36pt look (#470), which already puts 8pt between two looks, so the row adds none there.
 */
const NAV_ROW = cn('flex-row items-center', 'gap-2');

/**
 * The status line's floor, below which the places scroll rather than the status narrowing further.
 * The web's is its longest word, so it wraps between words and never into a column of letters;
 * a device has no `min-content`, so it keeps a word's worth of width instead.
 */
const STATUS_FLOOR = 'min-w-min';

/**
 * The status's lines sit against the end, by the actions. React Native has no `text-align: end`
 * and drops it; its `right` is already the end, since a device swaps left and right in a
 * right-to-left layout.
 */
const STATUS_ALIGN = 'text-end';

/**
 * Room around the places inside their scroller, taken back by as much margin outside it. A
 * scroller clips on both axes, and an `AppBarItem`'s count sits over its icon's corner, past the
 * item's box: the padding keeps the badge inside what is drawn, and the margin keeps the bar's
 * height and the nav's width what the places alone would make them.
 */
const NAV_ROOM = '-mx-1.5 -my-1.5';
const NAV_ROOM_INSIDE = 'px-1.5 py-1.5';

type NavProps = {
  navSlot: SlotNode;
  label: string;
  className: string | undefined;
};

/**
 * The places, and the bar's answer to a window narrower than all of them: they scroll sideways,
 * once `status` has given all its width away. The brand and the actions never shrink, so the
 * places are what gives after the status, and they give by moving rather than by wrapping the bar
 * to a second line or pushing an action off the screen.
 *
 * Written as statements, like `HeaderContentFooter`'s body, because the two arms are different
 * elements: `overflow` scrolls nothing on device.
 */
function Nav({ navSlot, label, className }: NavProps) {
  return (
    <nav aria-label={label} data-slot="app-bar-nav" className={cn('cube-rn-view', 'min-w-0 shrink', className)}>
      <div
        data-slot="app-bar-places"
        className={cn('cube-rn-view', NAV_ROW, NAV_ROOM, NAV_ROOM_INSIDE, 'overflow-x-auto')}
      >
        {navSlot}
      </div>
    </nav>
  );
}

/** The bar's navigation is a landmark, and a landmark with no name is one of several `nav`s. */
export type AppBarNav =
  | {
      /**
       * The app's places, usually `AppBarItem`s. Drawn inside a `<nav>` — `role="navigation"` on
       * device — named by `navLabel`, which is the landmark every hand-written bar either forgot
       * or spelled differently. Do not wrap them in one yourself.
       */
      navSlot: SlotNode;
      /** What the bar's navigation landmark is called — "Main". Required with `navSlot`. */
      navLabel: string;
    }
  | { navSlot?: undefined; navLabel?: never };

export type AppBarProps = {
  /** The bar's start: the app's mark and name, usually a link home. It keeps its width. */
  brandSlot?: SlotNode | undefined;
  /**
   * One line saying what state the app is in — "3/5 servers running" — between the `navSlot` and
   * the `actionSlot`. It gets the width the rest of the bar leaves, so on a narrow bar it is the
   * first thing to give way: a string wraps onto a second line, and more, down to its longest
   * word, and is never cut short. Past that the places scroll. A node is clipped to the width left
   * over, down to nothing, and truncates itself.
   */
  status?: ReactNode | undefined;
  /** The bar's far end: the theme switch, account, sign out. It keeps its width. */
  actionSlot?: SlotNode | undefined;
  /** On the bar itself: its fill, its border, its height. */
  className?: string | undefined;
  /** On the navigation landmark: `hidden md:flex`, with a menu of the places in `actionSlot`. */
  navClassName?: string | undefined;
} & AppBarNav;

/**
 * A bar across the top of an app: brand, places, status, actions, in that order.
 *
 * **Two parts give way, in order.** The `status` line takes only the width left over, so it
 * narrows first, wrapping rather than cutting a word off; once it is down to its longest word the
 * places scroll sideways. The brand and the actions keep their width, so an action is never pushed
 * off the edge of a phone.
 *
 * **One size, one gap, one ink.** An `AppBarItem` is 36px, the height of an `icon-sm` or `sm`
 * button, so pass the actions at one of those; everything in the bar sits `gap-2` apart, and a
 * place that is not the current one is in full ink, as a sidebar row is.
 *
 * **It is the banner.** `role="banner"` (`<header>` on the web), with the places a navigation
 * landmark inside it. The page under it is the app's to mark as the `main` landmark.
 *
 * **The safe area is the app's.** On device the bar is the top of the screen, and the status bar
 * sits over it unless something insets it: wrap the app in `react-native-safe-area-context`'s
 * `SafeAreaView edges={["top"]}` (Expo ships it). The bar adds no inset of its own; only
 * `SidebarLayout`'s bar along the bottom takes one, the bottom inset.
 */
export function AppBar({ brandSlot, navSlot, navLabel, status, actionSlot, className, navClassName }: AppBarProps) {
  return (
    <header
      data-slot="app-bar"
      className={cn(
        'cube-rn-view',
        'min-h-14 shrink-0 flex-row items-center gap-2 border-foreground/10 border-b bg-background px-4 py-2',
        className,
      )}
    >
      {hasSlot(brandSlot) ? (
        <div data-slot="app-bar-brand" className="cube-rn-view min-w-0 shrink-0 flex-row items-center gap-2">
          {brandSlot}
        </div>
      ) : null}
      {hasSlot(navSlot) && navLabel !== undefined ? (
        <Nav navSlot={navSlot} label={navLabel} className={navClassName} />
      ) : null}
      {hasSlot(status) ? (
        // `flex-1` is a zero basis: the status asks for no width of its own and is handed what
        // the others leave, which is what makes it the one that gives way first. A string wraps
        // rather than truncating, because an ellipsis on a phone's bar left "3 of 5 s…" and no way
        // to read the rest: a tooltip opens on neither a touch screen's browser nor a keyboard,
        // and a narrow bar is a phone's.
        typeof status === 'string' || typeof status === 'number' ? (
          <div data-slot="app-bar-status" className={cn('cube-rn-view', 'flex-1', STATUS_FLOOR)}>
            <span className={cn('cube-rn-text', STATUS_ALIGN, 'text-foreground/60 text-sm')}>{status}</span>
          </div>
        ) : (
          <div data-slot="app-bar-status" className="cube-rn-view min-w-0 flex-1 overflow-hidden">
            {status}
          </div>
        )
      ) : null}
      {hasSlot(actionSlot) ? (
        // `ms-auto` rather than a spacer, so the actions keep the far end with no status before
        // them.
        <div data-slot="app-bar-action" className="cube-rn-view ms-auto shrink-0 flex-row items-center gap-2">
          {actionSlot}
        </div>
      ) : null}
    </header>
  );
}
