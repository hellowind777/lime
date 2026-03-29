import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      theme="system"
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group rounded-xl border border-slate-200/90 bg-white/98 text-slate-900 shadow-[0_16px_32px_rgba(15,23,42,0.14)]",
          title: "text-sm font-semibold text-slate-800",
          description: "text-sm text-slate-500",
          closeButton:
            "border-slate-200/90 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700",
        },
      }}
    />
  );
}
