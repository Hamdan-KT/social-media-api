import express from "express"

const router = express.Router()

router.post("/signup");
router.post("/signin");
router.post("/logout");
router.post("/refresh-token");

export default router;