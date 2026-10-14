import type { NextApiRequest, NextApiResponse } from "next";
import {
  createSessionToken,
  setSessionCookie,
  validateCredentials,
} from "../../../utils/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  const { username, password } = req.body || {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !validateCredentials(username, password)
  ) {
    return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
  }

  const token = createSessionToken(username);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
}
