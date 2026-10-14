import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../utils/auth";
import {
  adminStatusExpression,
  resourceToAdminPhoto,
  searchPhotos,
  type PhotoStatus,
} from "../../../utils/photos";

const STATUSES: PhotoStatus[] = [
  "pending",
  "approved",
  "hidden",
  "rejected",
  "all",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  const statusParam = (req.query.status as string) || "pending";
  const status = (
    STATUSES.includes(statusParam as PhotoStatus) ? statusParam : "pending"
  ) as PhotoStatus;

  try {
    const resources = await searchPhotos(
      adminStatusExpression(status),
      "created_at",
    );
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json({
      photos: resources.map(resourceToAdminPhoto),
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "بارگذاری لیست عکس‌ها ناموفق بود" });
  }
}
