export const getPublicIdFromCloudinaryURL = (cloudinaryURL) => {
	const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
	const match = cloudinaryURL?.match(regex);
	return match ? match[1] : null;
};

export const getAspectValToString = (value) => {
	const ratioMap = {
		0.8: "4/5",
		1: "1/1",
		1.7777777777777777: "16/9",
		0.5625: "9/16",
	};
	return ratioMap[value] || null;
};
