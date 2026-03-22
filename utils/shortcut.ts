import type { ShortcutLink } from "~storage/local";

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

function getValidatedShortcutLink(item: unknown) {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const { id, title, url } = item as Partial<ShortcutLink>;
  if (typeof id !== "string" || typeof title !== "string" || typeof url !== "string") {
    return undefined;
  }

  const nextTitle = title.trim();
  const nextUrl = normalizeUrl(url);
  if (!nextTitle || !nextUrl) {
    return undefined;
  }

  try {
    new URL(nextUrl);
  } catch {
    return undefined;
  }

  return {
    id,
    title: nextTitle,
    url: nextUrl
  } satisfies ShortcutLink;
}

export function serializeShortcutLinks(links: ShortcutLink[]) {
  return JSON.stringify(links, null, 2);
}

export function parseShortcutLinksJson(text: string) {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("导入失败，JSON 顶层必须是数组");
  }

  const result = parsed.map(getValidatedShortcutLink);
  if (result.some((item) => !item)) {
    throw new Error("导入失败，JSON 中包含无效的快捷访问项");
  }

  return result as ShortcutLink[];
}

export function regenerateShortcutIds(links: ShortcutLink[]) {
  return links.map((item) => ({
    ...item,
    id: createShortcutId()
  }));
}

export function getShortcutExportFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `wanwan-shortcuts-${year}${month}${day}-${hours}${minutes}${seconds}.json`;
}
