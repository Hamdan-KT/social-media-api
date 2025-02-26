export const getPublicIdFromCloudinaryURL = (cloudinaryURL) => {
	const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
	const match = cloudinaryURL.match(regex);
	return match ? match[1] : null;
};
