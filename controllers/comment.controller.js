import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiSuccess } from "../utils/ApiSuccess.js";
import Post from "../Models/post.model.js";
import Comment from "../Models/comment.model.js";
import mongoose from "mongoose";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { COMMENT_TYPES, MODELS } from "../utils/constants.js";
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
	const { id } = req.params;
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	// Check if post exists
	const postExists = await Post.exists({ _id: id });
	if (!postExists) {
		return next(
			new ApiError(
				404,
				"post not found, may be it has already been deleted by the owner."
			)
		);
	}

	// Aggregation pipeline for comments
	const comments = await Comment.aggregate([
		{
			$match: {
				post: new mongoose.Types.ObjectId(String(id)),
				type: COMMENT_TYPES.GENERAL,
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "user",
				foreignField: "_id",
				as: "user",
			},
		},
		{ $unwind: "$user" },
		{
			$lookup: {
				from: MODELS.USER,
				localField: "mentions",
				foreignField: "_id",
				as: "mentions",
			},
		},
		{
			$lookup: {
				from: MODELS.COMMENT,
				let: { commentId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$parent_comment", "$$commentId"] },
									{ $eq: ["$type", COMMENT_TYPES.REPLY] },
								],
							},
						},
					},
				],
				as: "replies",
			},
		},
		{
			$addFields: {
				isReplies: {
					$cond: {
						if: { $gt: [{ $size: "$replies" }, 0] },
						then: true,
						else: false,
					},
				},
				repliesCount: { $size: "$replies" },
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$likes",
							],
						},
						then: true,
						else: false,
					},
				},
				likes: { $size: "$likes" },
			},
		},
		{
			$project: {
				_id: 1,
				post: 1,
				content: 1,
				user: {
					_id: "$user._id",
					userName: "$user.userName",
					avatar: "$user.avatar",
				},
				mentions: {
					_id: "$user._id",
					userName: "$user.userName",
					avatar: "$user.avatar",
				},
				type: 1,
				likes: 1,
				createdAt: 1,
				isReplies: 1,
				repliesCount: 1,
				isLiked: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
		// Pagination
		{ $skip: skip },
		{ $limit: limit },
	]);

	const formattedComments = comments?.map((comment) => ({
		...comment,
		createdAt: dayjs(comment?.createdAt).fromNow(true),
	}));

	return ApiSuccess(res, "comments fetch successful.", formattedComments);
});

export const getReplyComments = asyncHandler(async (req, res, next) => {
	const { id } = req.params;
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;

	const parentComment = await Comment.findById(id);

	if (!parentComment) {
		return next(
			new ApiError(
				404,
				"comment not found, may be it have been already deleted by owner."
			)
		);
	}

	// Aggregation pipeline for comments
	const replyComments = await Comment.aggregate([
		{
			$match: {
				parent_comment: new mongoose.Types.ObjectId(String(id)),
				post: new mongoose.Types.ObjectId(String(parentComment.post)),
				type: COMMENT_TYPES.REPLY,
			},
		},
		{
			$lookup: {
				from: MODELS.USER,
				localField: "user",
				foreignField: "_id",
				as: "user",
			},
		},
		{ $unwind: "$user" },
		{
			$lookup: {
				from: MODELS.USER,
				localField: "mentions",
				foreignField: "_id",
				as: "mentions",
			},
		},
		{
			$addFields: {
				likes: { $size: "$likes" },
				isLiked: {
					$cond: {
						if: {
							$in: [
								new mongoose.Types.ObjectId(String(req.user._id)),
								"$likes",
							],
						},
						then: true,
						else: false,
					},
				},
			},
		},
		{
			$project: {
				_id: 1,
				post: 1,
				content: 1,
				user: {
					_id: "$user._id",
					userName: "$user.userName",
					avatar: "$user.avatar",
				},
				mentions: {
					_id: "$user._id",
					userName: "$user.userName",
					avatar: "$user.avatar",
				},
				type: 1,
				likes: 1,
				createdAt: 1,
				isLiked: 1,
			},
		},
		// Pagination
		{ $skip: skip },
		{ $limit: limit },
	]);

	const formattedComments = replyComments?.map((comment) => ({
		...comment,
		createdAt: dayjs(comment?.createdAt).fromNow(true),
	}));

	return ApiSuccess(res, "comments fetch successful.", formattedComments);
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
