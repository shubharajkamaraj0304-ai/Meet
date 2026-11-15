import { Router } from "express";
import { randomUUID } from "node:crypto";
import Meeting from "../models/Meeting.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const meetings = await Meeting.find({ $or: [{ host: req.user.id }, { participants: req.user.id }] })
      .populate("host", "name email").sort({ createdAt: -1 }).limit(100);
    res.json({ meetings });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Meeting title is required." });
    const meeting = await Meeting.create({
      title, description: String(req.body.description || ""),
      scheduledAt: req.body.scheduledAt || undefined,
      host: req.user.id, participants: [req.user.id], roomId: randomUUID()
    });
    res.status(201).json({ meeting });
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate("host participants", "name email");
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });
    const member = meeting.host.id === req.user.id || meeting.participants.some(p => p.id === req.user.id);
    if (!member) return res.status(403).json({ message: "You do not have access to this meeting." });
    res.json({ meeting });
  } catch (e) { next(e); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!["live", "completed", "scheduled"].includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, host: req.user.id }, { status: req.body.status }, { new: true }
    );
    if (!meeting) return res.status(404).json({ message: "Meeting not found or not owned by you." });
    res.json({ meeting });
  } catch (e) { next(e); }
});

router.post("/:id/join", async (req, res, next) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id, { $addToSet: { participants: req.user.id }, status: "live" }, { new: true }
    );
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });
    res.json({ meeting });
  } catch (e) { next(e); }
});

router.patch("/:id/notes", async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, $or: [{ host: req.user.id }, { participants: req.user.id }] });
    if (!meeting) return res.status(404).json({ message: "Meeting not found." });
    meeting.transcript = String(req.body.transcript || "").slice(0, 30000);
    await meeting.save();
    res.json({ meeting });
  } catch (e) { next(e); }
});

export default router;
