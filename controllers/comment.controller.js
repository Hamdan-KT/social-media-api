import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import Post from "../Models/post.model.js";
import Comment from "../Models/comment.model.js";
import mongoose from "mongoose";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { COMMENT_TYPES } from "../utils/constants.js";
dayjs.extend(relativeTime);

export const createComment = asyncHandler(async (req, res, next) => {
	const session = await mongoose.startSession();
	session.startTransaction();
	try {
		const post = await Post.findById(req.params.id);

		if (!post) {
			return next(
				new ApiError(
					404,
					"post not found, may be it have been already deleted by owner."
				)
			);
		}

		// create comment
		const comment = await Comment.create(
			[
				{
					parent_comment: req.body?.parent_comment ?? null,
					post: req.params?.id,
					content: req.body?.content,
					user: req.user?._id,
					type: req.body?.type,
					mentions: req.body?.mentions,
				},
			],
			{ session }
		);

		if (req.body?.type === COMMENT_TYPES.GENERAL) {
			await Post.findByIdAndUpdate(
				req.params?.id,
				{
					$addToSet: {
						comments: comment[0]?._id,
					},
				},
				{ new: true, session }
			);
		}

		// Commit the transaction
		await session.commitTransaction();
		session.endSession();

		return ApiSuccess(res, "comment created successfull.", comment[0]);
	} catch (error) {
		// Rollback transaction
		await session.abortTransaction();
		session.endSession();
		return next(new ApiError(500, "error occurred while creating comment."));
	}
});

export const updateComment = asyncHandler(async (req, res, next) => {
	try {
		const comment = await Comment.findById(req.params.id).populate(
			"user",
			"_id userName"
		);

		if (!comment) {
			return next(
				new ApiError(
					404,
					"comment not found, may be it have been already deleted"
				)
			);
		}

		if (comment.user?._id?.toString() !== req.user._id?.toString()) {
			return next(
				new ApiError(401, "you are not authorized to perform this operation.")
			);
		}

		const isReplyComments = await Comment.findOne({
			parent_comment: comment._id,
			type: COMMENT_TYPES.REPLY,
		}).lean();

		if (isReplyComments) {
			return next(
				new ApiError(
					400,
					"you are not able to update this comment right now, users have been replied to this comment. you can delete this if you want to."
				)
			);
		}

		// update comment
		const updatedComment = await Comment.findByIdAndUpdate(
			comment._id,
			{
				$set: {
					content: req.body?.content,
					mentions: req.body?.mentions,
				},
			},
			{ new: true }
		)
			.select("-likes")
			.lean();

		return ApiSuccess(res, "comment updated successfull.", updatedComment);
	} catch (error) {
		return next(new ApiError(500, "error occurred while updating comment."));
	}
});

export const getComments = asyncHandler(async (req, res, next) => {
	const post = await Post.findById(req.params.id);

	if (!post) {
		return next(
			new ApiError(
				404,
				"post not found, may be it have been already deleted by owner."
			)
		);
	}

	//fetching comments
	const comments = await Comment.find({
		post: req.params.id,
		type: COMMENT_TYPES.GENERAL,
	})
		.populate("user", "_id userName avatar")
		.populate("mentions", "_id userName")
		.lean();

	// format comment with like count and created time
	const formattedComments = comments.map((com) => ({
		...com,
		likes: com.likes.length,
		createdAt: dayjs(com.createdAt).fromNow(),
	}));

	return ApiSuccess(res, "comments fetch successfull.", formattedComments);
});

export const getReplyComments = asyncHandler(async (req, res, next) => {
	const parentComment = await Comment.findById(req.params.id);

	if (!parentComment) {
		return next(
			new ApiError(
				404,
				"comment not found, may be it have been already deleted by owner."
			)
		);
	}

	//fetching comments
	const replyComments = await Comment.find({
		parent_comment: req.params.id,
		post: parentComment.post,
		type: COMMENT_TYPES.REPLY,
	})
		.populate("user", "_id userName avatar")
		.populate("mentions", "_id userName")
		.lean();

	// format comment with like count and created time
	const formattedReplyComments = replyComments.map((com) => ({
		...com,
		likes: com.likes.length,
		createdAt: dayjs(com.createdAt).fromNow(),
	}));

	return ApiSuccess(res, "comments fetch successfull.", formattedReplyComments);
});

export const deleteComment = asyncHandler(async (req, res, next) => {
	const session = await mongoose.startSession();
	session.startTransaction();
	try {
		const comment = await Comment.findById(req.params.id)
			.populate("user", "_id")
			.lean();

		if (!comment) {
			return next(
				new ApiError(
					404,
					"comment not found, may be it have been already deleted"
				)
			);
		}

		if (comment.user?._id?.toString() !== req.user._id?.toString()) {
			return next(
				new ApiError(401, "you are not authorized to perform this operation.")
			);
		}

		// deleting and updating all data related to this comment
		await Promise.all([
			Comment.findByIdAndDelete(comment._id, { session }),
			Comment.deleteMany({ parent_comment: comment._id }, { session }),
			Post.updateMany(
				{ _id: comment.post },
				{ $pull: { comments: comment._id } },
				{ session }
			),
		]);

		await session.commitTransaction();
		session.endSession();

		return ApiSuccess(res, "comment deleted successfull.");
	} catch (error) {
		await session.abortTransaction();
		session.endSession();
		return next(new ApiError(500, "error occurred while deleting comment."));
	}
});
export const likeComment = asyncHandler(async (req, res, next) => {
	const comment = await Comment.findById(req.params.id);

	if (!comment) {
		return next(
			new ApiError(
				404,
				"comment not found, may be it have been already deleted by owner."
			)
		);
	}

	// like comment
	const updatedComment = await Comment.findByIdAndUpdate(
		comment._id,
		{
			$addToSet: {
				likes: req.user._id,
			},
		},
		{ new: true }
	).lean();

	return ApiSuccess(res, "liked comment successfull.", {
		...updatedComment,
		likes: updatedComment.likes?.length,
	});
});

export const unlikeComment = asyncHandler(async (req, res, next) => {
	const comment = await Comment.findById(req.params.id);

	if (!comment) {
		return next(
			new ApiError(
				404,
				"comment not found, may be it have been already deleted by owner."
			)
		);
	}

	// unlike comment
	const updatedComment = await Comment.findByIdAndUpdate(
		comment._id,
		{
			$pull: {
				likes: req.user._id,
			},
		},
		{ new: true }
	).lean();

	return ApiSuccess(res, "liked comment successfull.", {
		...updatedComment,
		likes: updatedComment.likes?.length,
	});
});
