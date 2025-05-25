import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['*://*.google.com/*'],
  main() {
    // 匹配所有 google.com 域下及其子域下的所有页面。
    // 匹配后根据 runAt 属性来执行。
    // runAt 默认值为 document_idle
    // document_idle: 内容脚本会在浏览器空闲时执行。这是最晚的执行时机，可以确保页面上的所有内容都已加载完成。
    console.log('Hello content.');
  },
});
