import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import Post from "../Models/post.model.js";
import User from "../Models/user.model.js";
import PostMedia from "../Models/postMedia.model.js";
import Relationship from "../Models/relationship.model.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(relativeTime);


export const createPost = asyncHandler(async (req, res, next) => {
	const {
		aspectRatio,
		caption,
		location,
		isHideLikes,
		isDisableComment,
		postData,
	} = req.body;

	const postFiles = req.files;

	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		// Create the post
		const post = await Post.create(
			{
				aspectRatio,
				caption,
				location,
				isHideLikes,
				isDisableComment,
			},
			{ session }
		);

		const formattedPostFilesData = postData?.map((post) => {
			let fileType;

			// Check file type
			if (postFiles[post?.uID]?.startsWith("image/")) {
				fileType = "image";
			} else if (postFiles[post?.uID]?.startsWith("video/")) {
				fileType = "video";
			}

			// Get file URL
			const fileUrl = `${req.protocol}://${req.get("host")}/assets/userPosts/${
				postFiles[post?.uID]?.filename
			}`;

			return {
				post: post?._id, // Post ID from transaction result
				fileUrl,
				fileType,
				tags: post.tags || [],
				altText: post.altText || "",
			};
		});

		// Insert media into PostMedia collection
		await PostMedia.insertMany(formattedPostFilesData, { session });

		// Commit the transaction
		await session.commitTransaction();
		session.endSession();

		post.createdAt = dayjs(post.createdAt).fromNow();
		return ApiSuccess(res, "Post created successfully.", post);
		
	} catch (error) {
		// Rollback transaction
		await session.abortTransaction();
		session.endSession();

		return next(new ApiError(500, "Error occurred while uploading post."));
	}
});

export const getPost = asyncHandler(async (req, res, next) => {
	const post = Post.findById(req.params.id)
		.populate("user", "_id userName name avatar isPublic")
		.lean();

	if (!post) {
		return next(
			new ApiError("post not found, may be it have been already deleted.")
		);
	}

	const isFollowing = await Relationship.exists({
		follower: req.user._id,
		following: post.user?._id,
	});

	if (!post.user?.isPublic && post.user?._id !== req.user._id && !isFollowing) {
		return next(
			new ApiError(
				400,
				"this account is private! you are not able to see this post info until you follow this account."
			)
		);
	}

	post.createdAt = dayjs(post.createdAt).fromNow();
	post.isFollowing = isFollowing;

	return ApiSuccess(res, "post info fetch successfull.", post);
});

export const deletePost = asyncHandler(async (req, res, next) => {
	const post = Post.findById(req.params.id)
		.populate("user", "_id userName name avatar isPublic")
		.lean();

	if (!post) {
		return next(
			new ApiError("post not found, may be it have been already deleted.")
		);
	}

	if (post.user?._id !== req.user._id) {
		return next(
			new ApiError(401, "you are not authorized to perform this operation.")
		);
	}

	await Post.findByIdAndDelete(post._id);

	return ApiSuccess(res, "post deleted successfull.");
});

export const getUserPosts = asyncHandler(async (req, res, next) => {});

export const getSavedPosts = asyncHandler(async (req, res, next) => {});

export const getTaggedPosts = asyncHandler(async (req, res, next) => {});

export const getTaggedUsers = asyncHandler(async (req, res, next) => {});

export const savePost = asyncHandler(async (req, res, next) => {});

export const unsavePost = asyncHandler(async (req, res, next) => {});

export const likePost = asyncHandler(async (req, res, next) => {});

export const unlikePost = asyncHandler(async (req, res, next) => {});
