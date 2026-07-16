export type ToastKind = "success" | "error" | "info";

const STYLES: Record<ToastKind, { border: string; text: string }> = {
  success: { border: "border-green-500/20 bg-green-500/10", text: "text-green-200" },
  error: { border: "border-red-500/20 bg-red-500/10", text: "text-red-200" },
  info: { border: "border-[#6C63FF]/20 bg-[#6C63FF]/10", text: "text-[#A5A0FF]" },
};

// Simple fixed-position toast. Same visual treatment NoteEditorPage already
// had locally — pulled out here so any page can show one instead of
// re-declaring the same little component.
export function Toast({ kind, text }: { kind: ToastKind; text: string }) {
  const style = STYLES[kind];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-2xl border ${style.border} px-4 py-3 shadow-xl`}
    >
      <p className={`text-xs font-semibold ${style.text}`}>{text}</p>
    </div>
  );
}
