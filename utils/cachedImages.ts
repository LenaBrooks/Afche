import { publicGalleryExpression, searchPhotos } from "./photos";

let cachedResults: {
  resources: Array<{
    height: number;
    width: number;
    public_id: string;
    format: string;
  }>;
} | null = null;

export function clearImageCache() {
  cachedResults = null;
}

export default async function getResults() {
  // Do not cache across requests so admin approvals show up immediately.
  const resources = await searchPhotos(publicGalleryExpression(), "created_at");
  cachedResults = { resources };
  return cachedResults;
}
