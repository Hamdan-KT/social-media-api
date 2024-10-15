import express from "express";
import passport from "passport"
import {
	login,
	logout,
	refreshToken,
	register,
	currentUser,
} from "../controllers/auth.controller.js";
import {
	loginValidator,
	registerValidator,
} from "../middlewares/params/auth.validator.js";
import { verifyJWT } from "../middlewares/auth/verifyJwt.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

// Register a new user
router.post("/register", registerValidator, register);

// Log in an existing user
router.post("/login", loginValidator, login);

// Log out the currently authenticated user
router.post("/logout", requireAuth, logout);

// Refresh the authentication token
router.post("/refresh-token", refreshToken);

// Get the currently authenticated user's details
router.get("/current-user", requireAuth, currentUser);

export default router;
