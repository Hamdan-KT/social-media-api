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
import { RELATION_STATUS_TYPES } from "../utils/constants.js";
dayjs.extend(relativeTime);

export const createPost = asyncHandler(async (req, res, next) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const {
			aspectRatio,
			caption,
			location,
			isHideLikes,
			isDisableComment,
			postData,
		} = req.body;

		// get post files
		const postFiles = req.files;

		// Create the post
		const post = await Post.create(
			[
				{
					aspectRatio,
					caption,
					location,
					isHideLikes,
					isDisableComment,
					user: req?.user?._id,
				},
			],
			{ session }
		);

		//parse json data
		const postDataParsed = JSON.parse(postData);

		//format to db structrue
		const formattedPostFilesData = postFiles?.map((file) => {
			let fileType;

			// Check file type
			if (file?.mimetype.startsWith("image/")) {
				fileType = "image";
			} else if (file?.mimetype.startsWith("video/")) {
				fileType = "video";
			}

			// Get file URL
			const fileUrl = `${req.protocol}://${req.get("host")}/assets/userPosts/${
				file?.filename
			}`;

			return {
				post: post[0]?._id,
				fileUrl,
				fileType,
				tags: postDataParsed[file?.fieldname]?.tags || [],
				altText: postDataParsed[file?.fieldname]?.altText || "",
			};
		});

		// Insert media into PostMedia collection
		await PostMedia.insertMany(formattedPostFilesData, { session });

		// Commit the transaction
		await session.commitTransaction();
		session.endSession();

		post[0].createdAt = dayjs(post[0].createdAt).fromNow();
		return ApiSuccess(res, "Post created successfully.", post[0]);
	} catch (error) {
		console.log(error);
		// Rollback transaction
		await session.abortTransaction();
		session.endSession();

		return next(new ApiError(500, "Error occurred while uploading post."));
	}
});

export const updatePost = asyncHandler(async (req, res, next) => {});

export const getPost = asyncHandler(async (req, res, next) => {
	const post = await Post.findById(req.params.id)
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
		status: RELATION_STATUS_TYPES.FOLLOWING,
	});

	if (
		!post.user?.isPublic &&
		post.user?._id.toString() !== req.user._id.toString() &&
		!isFollowing
	) {
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
	const post = await Post.findById(req.params.id)
		.populate("user", "_id userName name avatar isPublic")
		.lean();

	if (!post) {
		return next(
			new ApiError(404, "post not found, may be it have been already deleted.")
		);
	}

	if (post.user?._id?.toString() !== req.user._id?.toString()) {
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
