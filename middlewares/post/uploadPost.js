import multer from "multer";
import fs from "fs";
import path from "path";
import { ApiError } from "../../utils/ApiError.js";

function uploadPosts() {
	const uploadDir = path.join("../../assets/userPosts");

	const storage = multer.diskStorage({
		destination: function (req, file, cb) {
			if (!fs.existsSync(uploadDir)) {
				fs.mkdir(uploadDir, { recursive: true });
			}
			cb(null, uploadDir);
		},
		filename: function (req, file, cb) {
			const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
			const ext = path.extname(file.originalname);
			cb(null, uniqueSuffix + ext);
		},
	});

	const upload = multer({
		storage,
		limits: {
			fileSize: 50 * 1024 * 1024,
		},
		fileFilter: function (req, file, cb) {
			if (
				file.mimetype.startsWith("image/") ||
				file.mimetype.startsWith("video/")
			) {
				cb(null, true);
			} else {
				cb(null, false);
			}
		},
    });
    
    upload.any()(req, res, (err) => {
        if (err) {
            return next(new ApiError(500, "error occured while uploading posts."))
        }

        //checking files are exist
        if (!req.files || req.files.length === 0) {
            return next(400, "post files are not found to upload.")
        }
    })
}

export default uploadPosts;
