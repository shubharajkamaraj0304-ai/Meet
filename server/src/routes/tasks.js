import { Router } from "express";
import Task from "../models/Task.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const tasks = await Task.find({ createdBy: req.user.id }).populate("assignee", "name email").sort({ updatedAt: -1 });
    res.json({ tasks });
  } catch (e) { next(e); }
});
router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Task title is required." });
    const task = await Task.create({
      title, description: String(req.body.description || ""),
      status: ["todo", "in-progress", "done"].includes(req.body.status) ? req.body.status : "todo",
      priority: ["low", "medium", "high"].includes(req.body.priority) ? req.body.priority : "medium",
      createdBy: req.user.id
    });
    res.status(201).json({ task });
  } catch (e) { next(e); }
});
router.patch("/:id", async (req, res, next) => {
  try {
    const update = {};
    for (const key of ["title", "description", "status", "priority"]) if (req.body[key] !== undefined) update[key] = req.body[key];
    const task = await Task.findOneAndUpdate({ _id: req.params.id, createdBy: req.user.id }, update, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ task });
  } catch (e) { next(e); }
});
router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task deleted." });
  } catch (e) { next(e); }
});
export default router;
