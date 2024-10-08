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

router.post("/", uploadPosts, createPost);
router.get("/:id", getPost);
router.delete("/:id", deletePost);
router.get("/:id/posts", getUserPosts);
router.get("/saved", getSavedPosts);
router.get("/:id/tagged", getTaggedPosts);
router.get("/:id/tags", getTaggedUsers);
router.patch("/:id/save", savePost);
router.patch("/:id/unsave", unsavePost);
router.patch("/:id/like", likePost);
router.patch("/:id/unlike", unlikePost);

export default router;
