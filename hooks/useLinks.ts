import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getBookmarkLinks, getCommonLinks } from "~indexedDB/LinksDB";
import type { BookmarkLink, CommonLink } from "~indexedDB/LinksDB";

function useLiveLinks<T>(query: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (nextItems) => {
        setItems(nextItems);
        setLoading(false);
      },
      error: (error) => {
        console.error(error);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [query]);

  return { items, loading };
}

export function useCommonLinks() {
  return useLiveLinks<CommonLink>(getCommonLinks);
}

export function useBookmarkLinks() {
  return useLiveLinks<BookmarkLink>(getBookmarkLinks);
}
