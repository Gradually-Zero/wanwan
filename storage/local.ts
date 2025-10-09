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

export const shortcutsSwitchKey = "newtab.switch.shortcuts";
