import express from "express";

const router = express.Router();

router.post("/");
router.get("/saved");
router.get("/tagged");
router.get("/tags");
router.get("/:id");
router.get("/");
router.delete("/:id");
router.patch("/:id/save");
router.patch("/:id/unsave");
router.patch("/:id/like");
router.patch("/:id/unlike");

export default router;
