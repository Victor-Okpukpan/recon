import { Toast } from "@base-ui/react/toast";

export const toastManager = Toast.createToastManager();

/** viem's BaseError (and anything it wraps, e.g. a rejected wallet request) carries a
 * short, human-readable `shortMessage` — the raw `.message` is a multi-paragraph dump
 * of args/ABI/docs links meant for a terminal, not a toast. */
function getShortErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const shortMessage = (err as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string" && shortMessage.trim()) return shortMessage.trim();

    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      const firstLine = message.split("\n")[0].trim();
      return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine;
    }
  }
  return "Something went wrong.";
}

export function showErrorToast(err: unknown): void {
  toastManager.add({ title: getShortErrorMessage(err), type: "error", timeout: 6000 });
}
