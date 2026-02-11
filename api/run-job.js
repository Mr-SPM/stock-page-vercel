import { runETFJob } from "../lib/jobService.js";

export default async function handler(req, res) {

  const force = req.query.force === "true";

  try {
    const result = await runETFJob({ force });
    res.json(result);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
