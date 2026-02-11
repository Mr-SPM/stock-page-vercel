import { runETFJob } from "../lib/jobService.js";

export default async function handler(req, res) {

  if (req.headers["x-vercel-cron"] !== "1") {
    return res.status(401).json({ error: "not cron" });
  }

  try {
    const result = await runETFJob();
    res.json(result);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
