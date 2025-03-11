import express from "express";
import passport from "passport";
import uploadStory from "../middlewares/story/uploadStory.js";
import { storyCreateValidator } from "../middlewares/params/story.validator.js";
import {
	createStory,
	deleteStory,
	getAllStory,
	getUserStory,
	likeStory,
	unlikeStory,
	updateStory,
} from "../controllers/story.controller.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Create a new story (uploading content like images or videos, then saving the story)
router.post("/", requireAuth, storyCreateValidator, uploadStory, createStory);
// update existing story
router.put("/:id", requireAuth, updateStory);
// Get the details of all story based latest story with date or time sorting
router.get("/", requireAuth, getAllStory);
// Delete a specific story by its ID
router.delete("/:id/story", requireAuth, deleteStory);
// Get all stories from a specific user by their ID
router.get("/:id/stories", requireAuth, getUserStory);
// Like a specific story by its ID (authenticated user likes the post)
router.patch("/:id/like", requireAuth, likeStory);
// Unlike a specific story by its ID (authenticated user unlikes the post)
router.patch("/:id/unlike", requireAuth, unlikeStory);

export default router;
