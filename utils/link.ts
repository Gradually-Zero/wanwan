import type { BookmarkLink, CommonLink } from "~indexedDB/LinksDB";

type LinkRecord = CommonLink | BookmarkLink;

export function createCommonId() {
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

function getValidatedLink(item: unknown) {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const { id, title, url } = item as Partial<LinkRecord>;
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
  } satisfies LinkRecord;
}

function serializeLinks(links: LinkRecord[]) {
  return JSON.stringify(links, null, 2);
}

function parseLinksJson(text: string, invalidMessage: string) {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("导入失败，JSON 顶层必须是数组");
  }

  const result = parsed.map(getValidatedLink);
  if (result.some((item) => !item)) {
    throw new Error(invalidMessage);
  }

  return result as LinkRecord[];
}

export function serializeCommonLinks(links: CommonLink[]) {
  return serializeLinks(links);
}

export function serializeBookmarkLinks(links: BookmarkLink[]) {
  return serializeLinks(links);
}

export function parseCommonLinksJson(text: string) {
  return parseLinksJson(text, "导入失败，JSON 中包含无效的常用项") as CommonLink[];
}

export function parseBookmarkLinksJson(text: string) {
  return parseLinksJson(text, "导入失败，JSON 中包含无效的书签项") as BookmarkLink[];
}

function regenerateLinkIds<T extends LinkRecord>(links: T[]) {
  return links.map((item) => ({
    ...item,
    id: createCommonId()
  })) as T[];
}

export function regenerateCommonIds(links: CommonLink[]) {
  return regenerateLinkIds(links);
}

export function regenerateBookmarkIds(links: BookmarkLink[]) {
  return regenerateLinkIds(links);
}

export function getCommonExportFileName(date = new Date()) {
  return getLinkExportFileName("common", date);
}

export function getBookmarkExportFileName(date = new Date()) {
  return getLinkExportFileName("bookmarks", date);
}

function getLinkExportFileName(prefix: string, date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `wanwan-${prefix}-${year}${month}${day}-${hours}${minutes}${seconds}.json`;
}
