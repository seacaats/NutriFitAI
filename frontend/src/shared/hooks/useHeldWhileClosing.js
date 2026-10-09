import { useRef } from "react";

/**
 * What a dialog shows, kept as it was while the dialog fades or slides out.
 *
 * Callers clear a dialog's data (the selected exercise, the routine being
 * edited) in the same moment they close it, so without this the content
 * empties out for the half-second before the dialog is gone. Used by every
 * dialog that shows a caller's data: ConfirmModal, PlanModal, the routine
 * details and the exercise details.
 *
 *   const shown = useHeldWhileClosing(visible, { exercise, lastSession });
 *   // render from shown.exercise, shown.lastSession
 */
export function useHeldWhileClosing(visible, value) {
  const held = useRef(value);
  if (visible) held.current = value;
  return visible ? value : held.current;
}