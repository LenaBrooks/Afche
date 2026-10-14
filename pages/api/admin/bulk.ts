import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../utils/auth";
import {
  applyPhotoAction,
  PHOTO_ACTIONS,
  type PhotoAction,
} from "../../../utils/photoActions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  const action = (req.body?.action || "") as PhotoAction;
  const publicIds = req.body?.publicIds;

  if (!PHOTO_ACTIONS.includes(action)) {
    return res.status(400).json({ error: "عملیات نامعتبر است" });
  }

  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return res.status(400).json({ error: "هیچ عکسی انتخاب نشده است" });
  }

  if (publicIds.length > 100) {
    return res
      .status(400)
      .json({ error: "حداکثر ۱۰۰ عکس در هر درخواست مجاز است" });
  }

  const ids = publicIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );

  try {
    const results = await Promise.allSettled(
      ids.map((id) => applyPhotoAction(id, action)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    try {
      await res.revalidate("/");
    } catch {
      /* ISR may be unavailable in some runtimes */
    }

    return res.status(200).json({
      ok: true,
      action,
      processed: ok,
      failed,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "عملیات گروهی ناموفق بود" });
  }
}
