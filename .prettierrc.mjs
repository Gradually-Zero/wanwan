/**
 * @type {import('prettier').Options}
 */
export default {
  printWidth: 200,
  tabWidth: 2,
  useTabs: false,
  singleQuote: false,
  trailingComma: "none",
  bracketSpacing: true,
  // 官方含义（Bracket Line）：
  // 控制多行 HTML/JSX/Vue/Angular 标签的 `>` 是“跟在最后一行末尾”还是“单独换到下一行”。
  // false: `>` 单独在下一行；true: `>` 放在最后一个属性所在行末尾（自闭合标签不受影响）。
  bracketSameLine: false
};
