import { teamRoute } from "@/lib/pieces";
import { importListing } from "@/lib/scrape";

export const dynamic = "force-dynamic";

export const POST = teamRoute(async (request) => {
  const { url } = await request.json();
  return importListing(String(url ?? ""));
});
