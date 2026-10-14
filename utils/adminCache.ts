import type { PhotoStatus } from "./photos";

export type AdminPhoto = {
  public_id: string;
  format: string;
  width: number;
  height: number;
  tags: string[];
  status: string;
  created_at: string | null;
  approved_at: string | null;
  bytes: number;
  filename: string;
  url: string;
};

type Tab = Extract<PhotoStatus, "pending" | "approved" | "hidden">;

const cache = new Map<Tab, AdminPhoto[]>();

export function getAdminCache(tab: Tab) {
  return cache.get(tab);
}

export function setAdminCache(tab: Tab, photos: AdminPhoto[]) {
  cache.set(tab, photos);
}

export function invalidateAdminCache(tab?: Tab) {
  if (tab) cache.delete(tab);
  else cache.clear();
}
