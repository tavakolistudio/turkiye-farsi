import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo/jsonld";

/**
 * Renders a JSON-LD structured-data block. The payload is data, not executable
 * JS, but we still attach the request nonce so it satisfies the strict CSP, and
 * we escape `<`/`>`/`&` so article text can never break out of the <script>.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
