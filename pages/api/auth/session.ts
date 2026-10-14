import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthenticated } from "../../../utils/auth";

/** Lightweight session probe for client-side admin navigation. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  res.setHeader(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );

  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
}
