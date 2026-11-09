"use client";

import * as React from "react";
import { CardBodyContext, cn, FOCUS_EDGE } from "@/lib/utils";
import { useOverflows } from "@/components/ui/overflows";

/**
 * Whether a `TableHead` sits in the header row group, so it can default its `scope` to the
 * direction it actually labels. Upstream sets no `scope` and leaves the browser to infer one,
 * which the header row gets right and a row header in the body — the first cell of each row,
 * as a `th` — is left to each screen reader's heuristics. Saying it costs one attribute.
 */
const InTableHeader = React.createContext(false);

/** The heights a table may be capped at: twenty and thirty-two rem, and most of the screen. */
const MAX_HEIGHTS = {
  sm: "max-h-80",
  md: "max-h-128",
  lg: "max-h-[70dvh]",
} as const;

/**
 * Whether the table scrolls inside its own capped container, so the header row pins itself to the
 * top of it. Without a cap the container never scrolls down, and a pinned header would only be
 * an opaque fill that a table on a card has to override.
 */
const TableIsCapped = React.createContext(false);

export type TableProps = React.ComponentProps<"table"> & {
  /**
   * The tallest the table may get before it scrolls inside itself, with its header row pinned at
   * the top. Left out, it is as tall as its rows and the page scrolls it. For a long table — a log,
   * an audit trail — that would carry its column names off the screen. `sm` and `md` are twenty
   * and thirty-two rem, `lg` is 70% of the screen's height.
   */
  maxHeight?: keyof typeof MAX_HEIGHTS | undefined;
};

/**
 * What a `TableCaption` lifted out of the scroll box needs: the id the table is named by, and
 * whether it is the table's name — not when the caller named the table itself. `null` for a caption
 * drawn where it was written, inside the table, as upstream's is.
 */
const LiftedCaption = React.createContext<{ id: string; names: boolean } | null>(null);

/**
 * Splits the first `TableCaption` written straight inside `Table` from the rest of its children.
 * One reached through a fragment or a component of the caller's stays where it is, a real
 * `<caption>`, and only scrolls with the rows as upstream's did.
 */
function liftCaption(children: React.ReactNode) {
  let caption: React.ReactElement<React.ComponentProps<"caption">> | undefined;
  const rest = React.Children.toArray(children).filter((child) => {
    if (caption === undefined && React.isValidElement(child) && child.type === TableCaption) {
      caption = child as React.ReactElement<React.ComponentProps<"caption">>;
      return false;
    }
    return true;
  });
  return caption === undefined ? { caption, rest: children } : { caption, rest };
}

/**
 * The fade at an end of the container with more columns past it, while there are. It is a mask,
 * so it fades the rows into whatever is behind the table — a page, a card, a dialog — with no fill
 * to keep in step. Its other two layers keep the container's 1px edge unfaded, the line
 * that turns `active` when the container is focused: the gradient covers the inside of the edge,
 * and the ring between the edge's outside and inside is added back whole. Nothing moves: the fade
 * is there or it is not.
 */
const EDGE_FADE =
  "[--table-fade-start:0px] [--table-fade-end:0px] data-more-start:[--table-fade-start:2rem] data-more-end:[--table-fade-end:2rem] [--table-fade-to:to_right] rtl:[--table-fade-to:to_left] [mask-image:linear-gradient(var(--table-fade-to),transparent,#000_var(--table-fade-start),#000_calc(100%_-_var(--table-fade-end)),transparent),linear-gradient(#000_0_0),linear-gradient(#000_0_0)] [mask-clip:padding-box,padding-box,border-box] [mask-composite:add,exclude]";

/**
 * In a card's body the table reaches out by its cells' own `px-2`, so the first column's text
 * starts where the card's title does and the last column ends where the card's action does, as a
 * `List` there reaches out by a row's inset. Its rules run nearly edge to edge. The width is
 * spelled out rather than left to the margins, so it holds in a parent that does not stretch it.
 */
const IN_CARD = "-mx-2 w-[calc(100%+1rem)]";

/**
 * `IN_CARD` one pixel further, for the pixel of `FOCUS_EDGE`'s border an overflowing container
 * takes, so the first column stays level with the card's title while the table scrolls sideways.
 * The line stays a border rather than `INSET_FOCUS_EDGE`'s shadow: `EDGE_FADE` masks the inside of
 * the box at the edge that has more past it, and an inset line there would fade out with the rows.
 */
const IN_CARD_EDGED = "-mx-[calc(0.5rem+1px)] w-[calc(100%+1rem+2px)]";

/** The same pixel with a caption, where the frame round the container does the reaching. */
const EDGED = "-mx-px w-[calc(100%+2px)]";

/**
 * A table inside a container that scrolls sideways when it is too wide, and up and down as well
 * when it is given a `maxHeight`. The edge with more columns past it fades while it does. A
 * `TableCaption` written straight inside it is drawn under the container rather than in it, so it
 * stays in view however the rows are scrolled, and still names the table. In a card's body it
 * lines its cells up with the card's title.
 */
function Table({ className, maxHeight, children, ...props }: TableProps) {
  const inCard = React.useContext(CardBodyContext);
  const [ref, overflows, edges] = useOverflows();
  const captionId = React.useId();
  const isCapped = maxHeight !== undefined;
  const { caption, rest } = liftCaption(children);
  const scrollsSideways = edges.start || edges.end;
  // A name the caller gave the table outranks the caption, as `aria-label` outranks a `<caption>`.
  const namedByCaption =
    caption !== undefined &&
    props["aria-label"] === undefined &&
    props["aria-labelledby"] === undefined;
  const container = (
    <div
      ref={ref}
      data-slot="table-container"
      data-more-start={edges.start ? "" : undefined}
      data-more-end={edges.end ? "" : undefined}
      // Upstream's container is `overflow-x-auto` alone: a table wider than its column was a
      // region only a mouse wheel could move. It is a tab stop while it overflows, either way.
      tabIndex={overflows ? 0 : undefined}
      className={cn(
        "relative w-full overflow-x-auto",
        caption === undefined && inCard && (overflows ? IN_CARD_EDGED : IN_CARD),
        caption !== undefined && inCard && overflows && EDGED,
        // Not tinted as hovered: a tinted container would hide the row under the pointer.
        overflows && FOCUS_EDGE,
        isCapped && "overflow-y-auto",
        isCapped && MAX_HEIGHTS[maxHeight],
        scrollsSideways && EDGE_FADE,
      )}
    >
      <table
        data-slot="table"
        aria-labelledby={namedByCaption ? (caption.props.id ?? captionId) : undefined}
        // `border-collapse` here rather than trusting Tailwind's preflight to set it: without it
        // a row's border does not paint, and an app that skips preflight drew no row rules.
        // `tabular-nums` so a column of figures lines up by digit.
        className={cn("w-full caption-bottom border-collapse text-sm tabular-nums", className)}
        {...props}
      >
        {rest}
      </table>
    </div>
  );
  return (
    <TableIsCapped.Provider value={isCapped}>
      {caption === undefined ? (
        container
      ) : (
        <div data-slot="table-frame" className={cn("w-full", inCard && IN_CARD)}>
          {container}
          <LiftedCaption.Provider
            value={{ id: caption.props.id ?? captionId, names: namedByCaption }}
          >
            {caption}
          </LiftedCaption.Provider>
        </div>
      )}
    </TableIsCapped.Provider>
  );
}

/**
 * The header of a capped table, pinned to the top of its container. A collapsed border belongs to
 * the table rather than the row, so the row's rule would stay behind as the header moved: it is
 * drawn as a one-pixel inset shadow on the cells instead, which travels with them. That shadow is
 * a rule, not elevation. The fill is the page's, so rows do not show through; on a card, the
 * caller gives the header the card's.
 */
const PINNED_HEADER =
  "sticky top-0 z-10 bg-background [&_tr]:border-b-0 [&_tr>*]:shadow-[inset_0_-1px_0] [&_tr>*]:shadow-foreground/10";

// Every border below names `border-foreground/10` beside its width. Upstream leans on the app's base
// layer to colour a bare `border-b`, and the cubeui stylesheet sets no such rule, so without it
// the rules between rows are `currentColor` — black lines in a light theme.
/** The table's header row group. */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const isCapped = React.useContext(TableIsCapped);
  return (
    <InTableHeader.Provider value={true}>
      <thead
        data-slot="table-header"
        className={cn(
          "[&_tr]:border-foreground/10 [&_tr]:border-b",
          isCapped && PINNED_HEADER,
          className,
        )}
        {...props}
      />
    </InTableHeader.Provider>
  );
}

/** The table's body row group. */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/** The table's footer row group, for totals. */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-foreground/10 border-t bg-foreground/10 font-semibold [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * What makes a row one that can be acted on, so it tints under the pointer: something pressable in
 * it — a checkbox to choose it, a link, a button. A row of words alone stays still, as text does.
 * A row with its own `onClick` tints as well; a selected row has its own step. The header's row
 * never tints, though it may hold a checkbox that chooses every row.
 */
const PRESSABLE_ROW = "has-[a[href],button,input,select,textarea]:hover:bg-hover";

/**
 * One row. It tints under the pointer only when it can be acted on: given an `onClick`, or holding
 * a link, a button or a field. A row given `data-state="selected"` is tinted `active`, a step
 * further under the pointer.
 */
function TableRow({ className, onClick, ...props }: React.ComponentProps<"tr">) {
  const inHeader = React.useContext(InTableHeader);
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-foreground/10 border-b transition-colors has-aria-expanded:bg-foreground/10 data-[state=selected]:bg-active/40 data-[state=selected]:hover:bg-active/60",
        inHeader === false && PRESSABLE_ROW,
        inHeader === false && onClick !== undefined && "hover:bg-hover",
        className,
      )}
      onClick={onClick}
      {...props}
    />
  );
}

/**
 * A header cell, scoped to its column in the header and to its row in the body. A column's name
 * stays on one line and is drawn quieter than the data under it; a row's own header, in the body,
 * wraps and is drawn in the data's ink, since it is the thing the row is about.
 */
function TableHead({ className, scope, ...props }: React.ComponentProps<"th">) {
  const inHeader = React.useContext(InTableHeader);
  return (
    <th
      data-slot="table-head"
      scope={scope ?? (inHeader ? "col" : "row")}
      className={cn(
        "h-10 px-2 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        // A column's name: weight says it is a header, the grey that it is not the content. It was
        // the loudest text in the table. On one line, it is also the narrowest its column gets,
        // so wrapped text beside it cannot squeeze the column down to a word.
        inHeader && "whitespace-nowrap text-foreground/60",
        // A row's header is its subject, so it is not the quietest text in it — and on a selected
        // row's tint, `/60` was under 4.5:1.
        inHeader === false && "wrap-break-word text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A data cell. Its text wraps at the column's width; give a value that reads wrongly broken — a
 * date, an id, a figure with its unit — `className="whitespace-nowrap"`.
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        // Upstream's cells were `whitespace-nowrap`, so a message never wrapped and a table on a
        // card scrolled sideways at any width.
        "wrap-break-word p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The table's caption, which is also its accessible name. Written straight inside `Table`, it is
 * drawn under the scroll box rather than in it, so it stays in view however the rows are
 * scrolled: there it is a `div` the table is `aria-labelledby`, hidden from a screen reader so the
 * name is not read a second time after the rows. Keep it to words.
 */
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  const lifted = React.useContext(LiftedCaption);
  const classes = cn("mt-4 text-center text-foreground/60 text-sm", className);
  if (lifted !== null) {
    const { ref, ...rest } = props;
    return (
      <div
        {...rest}
        ref={ref as unknown as React.Ref<HTMLDivElement>}
        id={lifted.id}
        aria-hidden={lifted.names ? true : undefined}
        data-slot="table-caption"
        className={classes}
      />
    );
  }
  return <caption data-slot="table-caption" className={classes} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
