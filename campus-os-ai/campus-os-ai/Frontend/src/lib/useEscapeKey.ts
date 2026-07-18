import { useEffect } from "react";

// Calls `onEscape` when the Escape key is pressed while active. Used by
// modals/dialogs so keyboard users can dismiss them without reaching for
// a mouse — previously none of this app's modals supported this.
export function useEscapeKey(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape, active]);
}
