import express from "express";

const router = express.Router();

// Add a new comment to a specific post by its ID
router.post("/:id/comment");

// Get all comments for a specific post by its ID
router.get("/:id/comments");

// Edit an existing comment on a specific post by its ID
router.put("/:id/comment");

// Delete a comment from a specific post by its ID
router.delete("/:id/comment");


export default router;
