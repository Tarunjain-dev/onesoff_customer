"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const crypto_1 = require("crypto");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'onesoff-images';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000;
const s3LegacyClient = new aws_sdk_1.default.S3({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const getObjectKeyFromUrl = (imageUrl) => {
    try {
        const url = new URL(imageUrl);
        const host = url.hostname;
        const path = url.pathname.replace(/^\/+/, '');
        if (host.includes(`${BUCKET_NAME}.s3`)) {
            return path || null;
        }
        if (host === 's3.amazonaws.com') {
            const parts = path.split('/');
            if (parts[0] === BUCKET_NAME) {
                return parts.slice(1).join('/') || null;
            }
        }
        return imageUrl.includes('.com/') ? imageUrl.split('.com/')[1] || null : null;
    }
    catch {
        return imageUrl.includes('.com/') ? imageUrl.split('.com/')[1] || null : null;
    }
};
const signedUrlCache = new Map();
exports.S3Service = {
    async uploadImage(file, folder) {
        if (!file.mimetype.startsWith('image/')) {
            throw new errors_1.ValidationError('Only image files are allowed');
        }
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${folder}/${(0, crypto_1.randomUUID)()}.${fileExtension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        });
        try {
            await s3Client.send(command);
            const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
            return url;
        }
        catch (error) {
            logger_1.default.error({ error: error?.message || String(error), bucket: BUCKET_NAME, key: fileName }, 'S3 image upload failed');
            throw new errors_1.ValidationError(`File upload failed: ${error.message}`);
        }
    },
    async uploadDocument(file, folder) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new errors_1.ValidationError('Invalid document type');
        }
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${folder}/${(0, crypto_1.randomUUID)()}.${fileExtension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        });
        try {
            await s3Client.send(command);
            const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
            return url;
        }
        catch (error) {
            logger_1.default.error({ error: error?.message || String(error), bucket: BUCKET_NAME, key: fileName }, 'S3 document upload failed');
            throw new errors_1.ValidationError(`Document upload failed: ${error.message}`);
        }
    },
    async uploadMultipleImages(files, folder) {
        const uploadPromises = files.map((file) => exports.S3Service.uploadImage(file, folder));
        return Promise.all(uploadPromises);
    },
    async getAccessibleImageUrl(imageUrl) {
        if (!imageUrl)
            return imageUrl;
        // Keep non-S3 URLs untouched (e.g. example.com seed data).
        if (!imageUrl.includes('amazonaws.com')) {
            return imageUrl;
        }
        const cached = signedUrlCache.get(imageUrl);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        if (cached) {
            signedUrlCache.delete(imageUrl);
        }
        const key = getObjectKeyFromUrl(imageUrl);
        if (!key) {
            return imageUrl;
        }
        try {
            const signedUrl = await s3LegacyClient.getSignedUrlPromise('getObject', {
                Bucket: BUCKET_NAME,
                Key: key,
                Expires: SIGNED_URL_TTL_SECONDS
            });
            signedUrlCache.set(imageUrl, {
                value: signedUrl,
                expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS
            });
            return signedUrl;
        }
        catch (error) {
            logger_1.default.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to sign S3 image URL');
            return imageUrl;
        }
    },
    async getAccessibleImageUrls(imageUrls) {
        return Promise.all(imageUrls.map((url) => exports.S3Service.getAccessibleImageUrl(url)));
    },
    async deleteFile(imageUrl) {
        try {
            const fileName = imageUrl.split('.com/')[1];
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName
            });
            await s3Client.send(command);
        }
        catch (error) {
            logger_1.default.warn({ error: error instanceof Error ? error.message : String(error) }, 'S3 file deletion failed');
        }
    },
    async deleteImage(imageUrl) {
        return exports.S3Service.deleteFile(imageUrl);
    }
};
