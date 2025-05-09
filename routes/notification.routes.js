import express from "express";
import passport from "passport";
import { sendFCMToken, sendNotification, subscribeNotification } from "../controllers/notification.controller.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// subscibe for notification
router.post("/subscribe", requireAuth, subscribeNotification);
// send notification to clients
router.post("/send-notification", requireAuth, sendNotification);
// send FCM (firebase cloud messaging) to backend
router.post("/send-fcm-token", requireAuth, sendFCMToken);

export default router;