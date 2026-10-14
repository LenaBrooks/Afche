import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../utils/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  try {
    await res.revalidate("/");
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
    for (const path of paths) {
      if (typeof path === "string" && path.startsWith("/")) {
        try {
          await res.revalidate(path);
        } catch {
          /* path may not exist yet */
        }
      }
    }
    return res.status(200).json({ ok: true, revalidated: true });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "بازتولید صفحه ناموفق بود" });
  }
}
