import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie } from "../../../utils/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
