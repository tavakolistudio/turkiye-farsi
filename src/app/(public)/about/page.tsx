import type { Metadata } from "next";
import { StaticPageView, staticPageMetadata } from "@/components/public/static-page-view";

const SLUG = "about";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(SLUG);
}

export default function Page() {
  return <StaticPageView slug={SLUG} />;
}
