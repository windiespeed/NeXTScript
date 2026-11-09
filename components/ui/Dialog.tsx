"use client";

import { useEffect, useRef } from "react";

interface DialogProps {
  /** Whether the dialog is showing. It can also stay mounted and toggle this. */
  open: boolean;
  /** Called on Escape and on a click outside the panel. */
  onClose: () => void;
  /** id of the dialog's heading, so screen readers announce its name. */
  labelledBy?: string;
  /** Set false while something is running that mustn't be interrupted. */
  dismissible?: boolean;
  /** Extra classes for the <dialog> element, usually its max width. */
  className?: string;
  /** "center" for a modal box, "left" for a slide-in menu panel. */
  placement?: "center" | "left";
  children: React.ReactNode;
}

const PLACEMENT_CENTER = "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)]";
const PLACEMENT_LEFT = "ml-3 mr-auto mt-[76px] mb-3 h-[calc(100dvh-88px)] max-h-none w-56";

/**
 * Modal dialog built on the native <dialog> element. showModal() gives us, for free:
 * focus moves into the dialog, Tab stays inside it, the rest of the page is inert,
 * Escape closes it, and focus returns to the button that opened it (WCAG 2.1.2, 2.4.3).
 */
export default function Dialog({ open, onClose, labelledBy, dismissible = true, className = "max-w-md", placement = "center", children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Closing on unmount puts focus back where it was before the dialog opened.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop targets the <dialog> itself; clicks inside hit its children.
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      className={`${placement === "left" ? PLACEMENT_LEFT : PLACEMENT_CENTER} overflow-visible border-0 bg-transparent p-0 text-inherit backdrop:bg-black/60 backdrop:backdrop-blur-sm ${className}`}
    >
      {children}
    </dialog>
  );
}
