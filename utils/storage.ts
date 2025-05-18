import { storage } from '#imports';

export const newtabBackgroundImageId = storage.defineItem<number>('local:newtab.backgroundImageId', {
  fallback: 1,
  version: 1,
});
