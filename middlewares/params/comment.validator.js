import joi from "joi";
import { ApiError } from "../../utils/ApiError.js";

export const commentCreateValidator = (req, res, next) => {
	const body = joi.object({
		parent_comment: joi.string().optional(),
		content: joi.string().min(1).max(2300).required(),
		type: joi.string().required(),
		mentions: joi.array().optional(),
	});

	const { error, value } = body.validate(req.body);

	if (error) {
		return next(new ApiError(400, error.details[0].message.replace(/\"/g, "")));
	}

	return next();
};
