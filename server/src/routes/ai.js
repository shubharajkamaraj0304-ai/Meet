import { Router } from "express";
import OpenAI from "openai";
import Meeting from "../models/Meeting.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();
router.use(requireAuth);

router.post("/summarize", async (req, res, next) => {
  try {
    const { meetingId, transcript } = req.body;
    let source = String(transcript || "").trim();
    let meeting = null;
    if (meetingId) {
      meeting = await Meeting.findOne({ _id: meetingId, $or: [{ host: req.user.id }, { participants: req.user.id }] });
      if (!meeting) return res.status(404).json({ message: "Meeting not found." });
      source = source || meeting.transcript;
    }
    if (!source) return res.status(400).json({ message: "Provide meeting transcript text first." });

    let summary, actionItems, provider;
    if (config.openAiKey) {
      const client = new OpenAI({ apiKey: config.openAiKey });
      const completion = await client.chat.completions.create({
        model: config.openAiModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Summarize the meeting transcript. Return JSON with keys summary (string) and actionItems (array of objects with text and owner; use null if no owner). Do not invent facts." },
          { role: "user", content: source.slice(0, 24000) }
        ]
      });
      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      summary = String(parsed.summary || "");
      actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
      provider = "openai";
    } else {
      const sentences = source.split(/(?<=[.!?])\s+/).filter(Boolean);
      summary = `Demo summary (not AI-generated): ${sentences.slice(0, 3).join(" ") || source.slice(0, 500)}`;
      actionItems = [];
      provider = "demo-fallback";
    }
    if (meeting) {
      meeting.summary = summary;
      meeting.actionItems = actionItems.map(item => ({ text: String(item.text || "Review action item"), done: false }));
      await meeting.save();
    }
    res.json({ summary, actionItems, provider, notice: provider === "demo-fallback" ? "Configure OPENAI_API_KEY to enable model-generated summaries." : undefined });
  } catch (e) { next(e); }
});
export default router;
