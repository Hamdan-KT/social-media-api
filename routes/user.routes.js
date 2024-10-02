import express from "express";

const router = express.Router();

router.get("/:id");
router.get("/");
router.delete("/:id");
router.get("/:id/following");
router.get("/:id/mutual");
router.put("/:id");
router.patch("/:id/follow");
router.patch("/:id/unfollow");

export default router;
