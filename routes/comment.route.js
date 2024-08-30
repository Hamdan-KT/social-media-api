import express from "express";

const router = express.Router();

router.post("/:id/comment");
router.get("/:id/comment");
router.delete("/:id/comment");

export default router;
