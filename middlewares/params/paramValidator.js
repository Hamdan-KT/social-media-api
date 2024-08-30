import joi from "joi";

export const createUser = (req, res, next) => {
	const body = joi.object({
		userName: joi.string().required(),
		name: joi.string().required(),
	});

	const { error, value } = body.validate(req.body);
};
