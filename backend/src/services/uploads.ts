import crypto from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';
import { badRequest, configurationError } from '../errors.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const supportedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const storage = new Storage();

export type UploadedContentImage = {
  url: string;
  objectName: string;
  contentType: string;
  size: number;
};

export function validateContentImage(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) {
    throw badRequest('upload_required', 'Please choose an image to upload.');
  }
  if (!supportedTypes[file.mimetype]) {
    throw badRequest('unsupported_file_type', 'Only JPG, PNG, and WebP images can be uploaded.', {
      allowedTypes: Object.keys(supportedTypes),
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw badRequest('file_too_large', 'Images must be 5 MB or smaller.', {
      maxBytes: MAX_UPLOAD_BYTES,
    });
  }
}

export async function uploadContentImage(file: Express.Multer.File): Promise<UploadedContentImage> {
  if (!config.GCS_CONTENT_BUCKET) {
    throw configurationError('GCS_CONTENT_BUCKET is not configured.');
  }

  validateContentImage(file);

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = supportedTypes[file.mimetype];
  const objectName = `content/${year}/${month}/${crypto.randomUUID()}.${ext}`;
  const bucket = storage.bucket(config.GCS_CONTENT_BUCKET);
  const object = bucket.file(objectName);

  await object.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return {
    url: `https://storage.googleapis.com/${config.GCS_CONTENT_BUCKET}/${objectName}`,
    objectName,
    contentType: file.mimetype,
    size: file.size,
  };
}
