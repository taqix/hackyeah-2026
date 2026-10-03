import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  /** The id of the heading that names the dialog. */
  labelledBy: string;
  children?: ReactNode;
  /** The id of the element to focus on close instead of the opener, set by the caller
      just before closing. Read once, then cleared. */
  focusAfter?: MutableRefObject<string | null>;
  /** Where focus goes when the opener is gone from the page, which a plan change can do. */
  fallbackFocus?: string | null;
}

/** A modal dialog built on <dialog>, which brings focus trapping and Escape with it.
    Focus is returned deliberately, because a change can remove the element that opened it. */
export function Dialog({ open, onClose, className, labelledBy, children, focusAfter, fallbackFocus }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  /* Read through refs: the close listener is attached once, but both can change. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  if (fallbackFocus) fallbackRef.current = fallbackFocus;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      onCloseRef.current();
      const target = focusAfter?.current ?? opener.current;
      if (focusAfter) focusAfter.current = null;
      /* After the dialog closes the page re-renders, so look the target up next tick. */
      setTimeout(() => {
        let element = typeof target === "string" ? document.getElementById(target) : (target as HTMLElement | null);
        if ((!element || !element.isConnected) && fallbackRef.current) {
          element = document.getElementById(fallbackRef.current);
        }
        element?.focus();
      }, 0);
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [focusAfter]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`s-dialog ${className ?? ""}`}
      aria-labelledby={labelledBy}
      onClick={event => {
        /* A click on the backdrop lands on the dialog element itself. */
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
