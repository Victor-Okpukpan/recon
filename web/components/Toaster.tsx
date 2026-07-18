"use client";

import { Toast } from "@base-ui/react/toast";
import { toastManager } from "@/lib/toast";

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className="relative rounded-xl border border-white/10 bg-card px-4 py-3 pr-8 shadow-lg data-[type=error]:border-rose-500/40"
        >
          <Toast.Title className="text-sm font-medium">{toast.title}</Toast.Title>
          {toast.description && <Toast.Description className="mt-1 text-xs text-muted-foreground">{toast.description}</Toast.Description>}
          <Toast.Close aria-label="Dismiss" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            ×
          </Toast.Close>
        </Toast.Root>
      ))}
    </>
  );
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
