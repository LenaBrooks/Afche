import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../utils/auth";
import {
  applyPhotoAction,
  PHOTO_ACTIONS,
  type PhotoAction,
} from "../../../../utils/photoActions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  const parts = req.query.publicId;
  const publicId = Array.isArray(parts) ? parts.join("/") : parts;
  if (!publicId) {
    return res.status(400).json({ error: "شناسه عکس نامعتبر است" });
  }

  const action = (req.body?.action || "") as PhotoAction;
  if (!PHOTO_ACTIONS.includes(action)) {
    return res.status(400).json({ error: "عملیات نامعتبر است" });
  }

  try {
    await applyPhotoAction(publicId, action);
    return res.status(200).json({ ok: true, action });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "عملیات ناموفق بود" });
  }
}
