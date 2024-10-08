import express from "express";
import {
	deleteUser,
	follow,
	getFollowerUsers,
	getFollowingUsers,
	getMuturalUsers,
	getUser,
	getUsers,
	unfollow,
	updateUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/:id", getUser);
router.get("/", getUsers);
router.put("/", updateUser);
router.delete("/:id", deleteUser);
router.get("/:id/following", getFollowingUsers);
router.get("/:id/followers", getFollowerUsers);
router.get("/:id/mutual", getMuturalUsers);
router.patch("/:id/follow", follow);
router.patch("/:id/unfollow", unfollow);

export default router;
