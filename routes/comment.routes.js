import express from "express";

const router = express.Router();

router.post("/:id/comment");
router.get("/:id/comments");
router.put("/:id/comment");
router.delete("/:id/comment");

export default router;
