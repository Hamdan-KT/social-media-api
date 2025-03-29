import express from "express";
import passport from "passport";
import { sendNotification, subscribeNotification } from "../controllers/notification.controller.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Create a new post (uploading content like images or videos, then saving the post)
router.post("/subscribe", requireAuth, subscribeNotification);
// Get the details of a specific post by its ID
router.post("/send-notification", requireAuth, sendNotification);

export default router;