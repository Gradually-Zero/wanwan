import { Switch } from "antd";
import { useStorage } from "@plasmohq/storage/hook";
import { local, shortcutsSwitchKey } from "~storage/local";

export function ViewSetting() {
  const [shortcutsSwitch, setShortcutsSwitch] = useStorage({ instance: local, key: shortcutsSwitchKey }, false);
  return (
    <>
      <Switch checked={shortcutsSwitch} onChange={setShortcutsSwitch} checkedChildren="开启快捷访问" unCheckedChildren="关闭快捷访问" />
    </>
  );
}
