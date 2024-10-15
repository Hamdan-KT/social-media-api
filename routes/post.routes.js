import express from "express";
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
} from "../controllers/post.controller.js";
import uploadPosts from "../middlewares/post/uploadPost.js";

const router = express.Router();

// Create a new post (uploading content like images or videos, then saving the post)
router.post("/", uploadPosts, createPost);

// Get the details of a specific post by its ID
router.get("/:id", getPost);

// Delete a specific post by its ID
router.delete("/:id", deletePost);

// Get all posts from a specific user by their ID
router.get("/:id/posts", getUserPosts);

// Get all saved posts for the authenticated user
router.get("/saved", getSavedPosts);

// Get all posts where a specific user is tagged
router.get("/:id/tagged", getTaggedPosts);

// Get all users tagged in a specific post by post ID
router.get("/:id/tags", getTaggedUsers);

// Save a specific post for the authenticated user
router.patch("/:id/save", savePost);

// Unsave a specific post for the authenticated user
router.patch("/:id/unsave", unsavePost);

// Like a specific post by its ID (authenticated user likes the post)
router.patch("/:id/like", likePost);

// Unlike a specific post by its ID (authenticated user unlikes the post)
router.patch("/:id/unlike", unlikePost);


export default router;
