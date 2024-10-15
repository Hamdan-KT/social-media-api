import joi from "joi";
import { ApiError } from "../../utils/ApiError.js";

export const registerValidator = (req, res, next) => {
	const body = joi.object({
		userName: joi.string().required(),
		name: joi.string().required(),
		email: joi.string().email(),
		password: joi.string().required(),
	});

	const { error, value } = body.validate(req.body);

	if (error) {
		return next(new ApiError(400, error.details[0].message.replace(/\"/g, "")));
	}

	return next();
};
