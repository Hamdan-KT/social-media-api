export const ApiSuccess = (
	res,
	message = "Success",
	data = {},
	status = 200
) => {
	return res.status(status).json({ status, message, data });
};
