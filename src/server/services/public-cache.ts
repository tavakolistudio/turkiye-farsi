import "server-only";
import { unstable_cache } from "next/cache";
import { publicContentService } from "@/server/services/public-content.service";

export const getSiteChromeCached = unstable_cache(
  () => publicContentService.getSiteChrome(),
  ["public-site-chrome"],
  { revalidate: 300, tags: ["public-settings", "public-categories", "public-breaking"] },
);

export const getHomepageCached = unstable_cache(
  () => publicContentService.homepage(),
  ["public-homepage"],
  { revalidate: 60, tags: ["public-articles", "public-homepage"] },
);
