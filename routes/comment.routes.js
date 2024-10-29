import express from "express";
import passport from "passport";
import {
	createComment,
	deleteComment,
	getComments,
	getReplyComments,
	likeComment,
	unlikeComment,
	updateComment,
} from "../controllers/comment.controller.js";
import {
	commentCreateValidator,
	commentUpdateValidator,
} from "../middlewares/params/comment.validator.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Add a new comment to a specific post by its ID
router.post("/:id/comment", requireAuth, commentCreateValidator, createComment);

// Edit an existing comment on a specific post by its ID
router.put("/:id/comment", requireAuth, commentUpdateValidator, updateComment);

// Get all comments for a specific post by its ID
router.get("/:id/comments", requireAuth, getComments);

// Get all reply comments for a specific comment by its ID
router.get("/:id/reply-comments", requireAuth, getReplyComments);

// Delete a comment from a specific post by its ID
router.delete("/:id/comment", requireAuth, deleteComment);

// Like a specific comment by its ID (authenticated user likes the post)
router.patch("/:id/like", requireAuth, likeComment);

// Unlike a specific comment by its ID (authenticated user unlikes the post)
router.patch("/:id/unlike", requireAuth, unlikeComment);

export default router;
