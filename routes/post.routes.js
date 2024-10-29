import express from "express";
import passport from "passport";
import {
	createPost,
	deletePost,
	getPost,
	getSavedPosts,
	getTaggedPosts,
	getTaggedUsers,
	getUserPosts,
	likePost,
	savePost,
	unlikePost,
	unsavePost,
	updatePost,
} from "../controllers/post.controller.js";
import uploadPosts from "../middlewares/post/uploadPost.js";
import { postCreateValidator } from "../middlewares/params/post.validator.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Create a new post (uploading content like images or videos, then saving the post)
router.post("/", requireAuth, postCreateValidator, uploadPosts, createPost);

// update existing post
router.put("/", requireAuth, updatePost);

// Get the details of a specific post by its ID
router.get("/:id/post", requireAuth, getPost);

// Delete a specific post by its ID
router.delete("/:id/post", requireAuth, deletePost);

// Get all posts from a specific user by their ID
router.get("/:id/posts", requireAuth, getUserPosts);

// Save a specific post for the authenticated user
router.patch("/:id/save", requireAuth, savePost);

// Unsave a specific post for the authenticated user
router.patch("/:id/unsave", requireAuth, unsavePost);

// Get all saved posts for the authenticated user
router.get("/saved", requireAuth, getSavedPosts);

// Get all posts where a specific user is tagged
router.get("/:id/tagged", requireAuth, getTaggedPosts);

// Get all users tagged in a specific post by post media ID
router.get("/:id/tags", requireAuth, getTaggedUsers);

// Like a specific post by its ID (authenticated user likes the post)
router.patch("/:id/like", requireAuth, likePost);

// Unlike a specific post by its ID (authenticated user unlikes the post)
router.patch("/:id/unlike", requireAuth, unlikePost);

export default router;
