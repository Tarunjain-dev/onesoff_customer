import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import AWS from 'aws-sdk';
import { randomUUID } from 'crypto';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'onesoff-images';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000;
const s3LegacyClient = new AWS.S3({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const getObjectKeyFromUrl = (imageUrl: string): string | null => {
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
  } catch {
    return imageUrl.includes('.com/') ? imageUrl.split('.com/')[1] || null : null;
  }
};

const signedUrlCache = new Map<
  string,
  {
    value: string;
    expiresAt: number;
  }
>();

export const S3Service = {
  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    if (!file.mimetype.startsWith('image/')) {
      throw new ValidationError('Only image files are allowed');
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    try {
      await s3Client.send(command);
      const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      return url;
    } catch (error: any) {
      logger.error(
        { error: error?.message || String(error), bucket: BUCKET_NAME, key: fileName },
        'S3 image upload failed'
      );
      throw new ValidationError(`File upload failed: ${error.message}`);
    }
  },

  async uploadDocument(file: Express.Multer.File, folder: string): Promise<string> {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError('Invalid document type');
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    try {
      await s3Client.send(command);
      const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      return url;
    } catch (error: any) {
      logger.error(
        { error: error?.message || String(error), bucket: BUCKET_NAME, key: fileName },
        'S3 document upload failed'
      );
      throw new ValidationError(`Document upload failed: ${error.message}`);
    }
  },

  async uploadMultipleImages(files: Express.Multer.File[], folder: string): Promise<string[]> {
    const uploadPromises = files.map((file) => S3Service.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  },

  async getAccessibleImageUrl(imageUrl: string): Promise<string> {
    if (!imageUrl) return imageUrl;

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
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to sign S3 image URL'
      );
      return imageUrl;
    }
  },

  async getAccessibleImageUrls(imageUrls: string[]): Promise<string[]> {
    return Promise.all(imageUrls.map((url) => S3Service.getAccessibleImageUrl(url)));
  },

  async deleteFile(imageUrl: string): Promise<void> {
    try {
      const fileName = imageUrl.split('.com/')[1];
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName
      });
      await s3Client.send(command);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'S3 file deletion failed'
      );
    }
  },

  async deleteImage(imageUrl: string): Promise<void> {
    return S3Service.deleteFile(imageUrl);
  }
};
