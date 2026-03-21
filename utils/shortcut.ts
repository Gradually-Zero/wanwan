type NoticeTone = "success" | "error" | "warning" | "info";

export function createShortcutId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getNoticeTextClass(type: NoticeTone) {
  if (type === "success") {
    return "text-emerald-700";
  }
  if (type === "warning") {
    return "text-amber-700";
  }
  if (type === "error") {
    return "text-rose-700";
  }
  return "text-sky-700";
}
