import { Storage } from "@plasmohq/storage";

export const local = new Storage({
  area: "local"
});

export const BGIKey = "newtab.backgroundImageId";

export function setBGIId(value: any) {
  return local.set(BGIKey, value);
}
