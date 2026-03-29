import { Storage } from "@plasmohq/storage";

export const local = new Storage({
  area: "local"
});

const BISKey = "newtab.switch.backgroundImage";

/**
 * set 使用 undefined 是不生效的，可以使用 null
 */
export function setBIS(value: boolean) {
  return local.set(BISKey, value);
}

export function getBIS() {
  return local.get<boolean>(BISKey);
}

export const commonSwitchKey = "newtab.switch.common";
export const commonLinksKey = "newtab.common.links";
export const bookmarksLinksKey = "extension.bookmarks.links";

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
