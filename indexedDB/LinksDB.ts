import Dexie from "dexie";
import type { EntityTable } from "dexie";

export interface CommonLink {
  id: string;
  title: string;
  url: string;
}

export interface BookmarkLink {
  id: string;
  title: string;
  url: string;
}

interface StoredCommonLink extends CommonLink {
  order: number;
}

interface StoredBookmarkLink extends BookmarkLink {
  order: number;
}

class LinksDB extends Dexie {
  commonLinks: EntityTable<StoredCommonLink, "id">;
  bookmarkLinks: EntityTable<StoredBookmarkLink, "id">;

  constructor() {
    super("LinksDB");

    this.version(1).stores({
      commonLinks: "id, order",
      bookmarkLinks: "id, order"
    });

    this.commonLinks = this.table("commonLinks");
    this.bookmarkLinks = this.table("bookmarkLinks");
  }
}

const linksDb = new LinksDB();

function toCommonLink(item: StoredCommonLink): CommonLink {
  return {
    id: item.id,
    title: item.title,
    url: item.url
  };
}

function toBookmarkLink(item: StoredBookmarkLink): BookmarkLink {
  return {
    id: item.id,
    title: item.title,
    url: item.url
  };
}

function withCommonOrder(links: CommonLink[]): StoredCommonLink[] {
  return links.map((item, index) => ({
    ...item,
    order: index
  }));
}

function withBookmarkOrder(links: BookmarkLink[]): StoredBookmarkLink[] {
  return links.map((item, index) => ({
    ...item,
    order: index
  }));
}

export async function getCommonLinks() {
  const items = await linksDb.commonLinks.orderBy("order").toArray();
  return items.map(toCommonLink);
}

export async function getBookmarkLinks() {
  const items = await linksDb.bookmarkLinks.orderBy("order").toArray();
  return items.map(toBookmarkLink);
}

export async function addCommonLink(link: CommonLink) {
  const lastItem = await linksDb.commonLinks.orderBy("order").last();
  const order = typeof lastItem?.order === "number" ? lastItem.order + 1 : 0;

  await linksDb.commonLinks.add({
    ...link,
    order
  });
}

export async function addBookmarkLink(link: BookmarkLink) {
  const lastItem = await linksDb.bookmarkLinks.orderBy("order").last();
  const order = typeof lastItem?.order === "number" ? lastItem.order + 1 : 0;

  await linksDb.bookmarkLinks.add({
    ...link,
    order
  });
}

export function updateCommonLink(id: string, patch: Pick<CommonLink, "title" | "url">) {
  return linksDb.commonLinks.update(id, patch);
}

export function updateBookmarkLink(id: string, patch: Pick<BookmarkLink, "title" | "url">) {
  return linksDb.bookmarkLinks.update(id, patch);
}

export function removeCommonLink(id: string) {
  return linksDb.commonLinks.delete(id);
}

export function removeBookmarkLink(id: string) {
  return linksDb.bookmarkLinks.delete(id);
}

export async function replaceCommonLinks(links: CommonLink[]) {
  const normalized = withCommonOrder(links);

  await linksDb.transaction("rw", linksDb.commonLinks, async () => {
    await linksDb.commonLinks.clear();
    if (normalized.length > 0) {
      await linksDb.commonLinks.bulkPut(normalized);
    }
  });
}

export async function replaceBookmarkLinks(links: BookmarkLink[]) {
  const normalized = withBookmarkOrder(links);

  await linksDb.transaction("rw", linksDb.bookmarkLinks, async () => {
    await linksDb.bookmarkLinks.clear();
    if (normalized.length > 0) {
      await linksDb.bookmarkLinks.bulkPut(normalized);
    }
  });
}
