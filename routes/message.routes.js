import express from "express";
import passport from "passport";
import {
	addPeoplesToChat,
	fetchChatMembers,
	fetchChatMessages,
	fetchUserChats,
	getChatSearchUsers,
	getCurrentChat,
	initializeChat,
	uploadMessageMedias,
} from "../controllers/message.controller.js";
import uploadMessageMedia from "../middlewares/message/uploadMessageMedia.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// get searched message users
router.get("/search-users", requireAuth, getChatSearchUsers);
// start a new conversation if chat is not already exist
router.post("/initialize-chat", requireAuth, initializeChat);
// fetch all user chats
router.get("/fetch-chats", requireAuth, fetchUserChats);
// fetch current chat based on chatId
router.get("/current-chat/:chatId", requireAuth, getCurrentChat);
// fetch all users messages based on chat ID
router.get("/fetch-messages/:chatId", requireAuth, fetchChatMessages);
// upload message medias
router.post(
	"/upload-media",
	requireAuth,
	uploadMessageMedia,
	uploadMessageMedias
);
// fetch all users those included in specific chat
router.get("/members/:chatId", requireAuth, fetchChatMembers);
// add peoples to chat in case of group chat
router.post("/add-members", requireAuth, addPeoplesToChat);

export default router;
