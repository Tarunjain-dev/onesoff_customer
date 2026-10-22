"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingUpload = exports.upload = void 0;
const multer = require('multer');
const storage = multer.memoryStorage();
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ONBOARDING_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
]);
const createUpload = (allowedTypes, errorMessage) => multer({
    storage,
    fileFilter: (_req, file, cb) => {
        if (allowedTypes.has(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(errorMessage), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});
exports.upload = createUpload(IMAGE_TYPES, 'Invalid file type. Only JPEG, PNG and WebP allowed');
exports.onboardingUpload = createUpload(ONBOARDING_TYPES, 'Invalid file type. Only JPEG, PNG, WebP and PDF allowed');
