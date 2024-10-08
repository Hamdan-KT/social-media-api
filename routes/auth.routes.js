import express from "express";
import {
	login,
	logout,
	refreshToken,
	register,
	currentUser,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/current-user", currentUser);
;

export default router;