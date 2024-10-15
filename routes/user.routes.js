import express from "express";
import passport from "passport"
import {
	acceptFollowRequest,
	deleteUser,
	follow,
	getFollowerUsers,
	getFollowingUsers,
	getMuturalUsers,
	getUser,
	getUsers,
	rejectFollowRequest,
	unfollow,
	updateUser,
	updateUserAvatar,
} from "../controllers/user.controller.js";
import { updateUserValidator } from "../middlewares/params/user.validator.js";
import uploadAvatar from "../middlewares/users/uploadAvatar.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Get details of a specific user by their ID
router.get("/:id", requireAuth, getUser);

// Get a list of all users (can include filtering, pagination, etc.)
router.get("/", requireAuth, getUsers);

// Update the currently authenticated user (e.g., update profile information)
router.put("/", requireAuth, updateUserValidator, updateUser);

// Update the currently authenticated user's avatar
router.put("/avatar", requireAuth, uploadAvatar, updateUserAvatar);

// Delete a specific user by their ID (usually requires admin or user's own permission)
router.delete("/:id", requireAuth, deleteUser);

// Get the list of users the specified user is following
router.get("/:id/following", requireAuth, getFollowingUsers);

// Get the list of users following the specified user (i.e., their followers)
router.get("/:id/followers", requireAuth, getFollowerUsers);

// Get the list of mutual users (both following and followers) for the specified user
router.get("/:id/mutual", requireAuth, getMuturalUsers);

// Follow a specific user by their ID (usually the authenticated user follows the target user)
router.patch("/:id/follow", requireAuth, follow);

// Unfollow a specific user by their ID (authenticated user stops following the target user)
router.patch("/:id/unfollow", requireAuth, unfollow);

// Accept follow request from users by their ID (usually the authenticated user accept follow request from the target user)
router.patch("/:id/follow-accept", requireAuth, acceptFollowRequest);

// Reject follow request from users by their ID (usually the authenticated user accept follow reject from the target user)
router.patch("/:id/follow-reject", requireAuth, rejectFollowRequest);


export default router;
