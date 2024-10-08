export const ApiSuccess = (
	res,
	message = "Success",
	data = {},
	status = 200
) => {
	return res.status(statusCode).json({ status, message, data });
};
