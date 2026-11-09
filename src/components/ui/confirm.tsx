import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** What a `confirm()` call asks: its wording, and whether a name must be typed. */
export type ConfirmOptions = {
  title: string;
  description: string;
  /** Verb on the destructive button. Defaults to "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * The text to type before the destructive button unlocks — the name of what is deleted.
   * `ConfirmDialog`'s, passed through.
   */
  requireText?: string | undefined;
  /** The input's label. Defaults to "Type **{requireText}** to confirm". */
  requireTextLabel?: ReactNode;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Mounts the one dialog `useConfirm` raises. Put it once, near the root. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  // Held in a ref rather than state: settling it is not a render, and a second
  // `confirm()` while one is open must not lose the first one's resolver.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<Confirm>((options) => {
    // A prompt raised over an open one supersedes it; the older caller is told
    // no rather than left waiting on a promise nothing will settle.
    resolveRef.current?.(false);
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open === false) {
            settle(false);
          }
        }}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.confirmLabel ?? "Delete"}
        {...(pending?.cancelLabel ? { cancelLabel: pending.cancelLabel } : {})}
        requireText={pending?.requireText}
        requireTextLabel={pending?.requireTextLabel}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Throws when no provider is mounted rather than resolving `false`: a delete
 * that silently never happens is worse than a crash in development.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return confirm;
}
