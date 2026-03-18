import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();
const imageMimeTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const documentMimeTypes: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'application/rtf': '.rtf',
  'application/vnd.oasis.opendocument.text': '.odt',
};
const allMimeTypes: Record<string, string> = {
  ...imageMimeTypes,
  ...documentMimeTypes,
};

const uploadBucket = String(process.env.AWS_UPLOADS_BUCKET || '').trim();
const uploadRegion = String(process.env.AWS_UPLOADS_REGION || process.env.AWS_REGION || 'us-east-1').trim();
const uploadBaseUrl = String(process.env.AWS_UPLOADS_BASE_URL || '').trim().replace(/\/+$/, '');
const uploadPrefixRaw = String(process.env.AWS_UPLOADS_PREFIX || 'uploads').trim();
const uploadPrefix = uploadPrefixRaw ? uploadPrefixRaw.replace(/^\/+/, '').replace(/\/+$/, '') : 'uploads';
const useS3Uploads =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.AWS_UPLOADS_ENABLED || '').trim().toLowerCase()) &&
  Boolean(uploadBucket);

const s3Client = useS3Uploads
  ? new S3Client({
      region: uploadRegion,
    })
  : null;

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const extension = allMimeTypes[file.mimetype];
    const uniqueName = `${uuidv4()}${extension || path.extname(file.originalname) || '.bin'}`;
    cb(null, uniqueName);
  },
});
const storage = useS3Uploads ? multer.memoryStorage() : localDiskStorage;

const resolveFileExtension = (file: Express.Multer.File) =>
  allMimeTypes[file.mimetype] || path.extname(String(file.originalname || '')) || '.bin';

const resolveS3ObjectKey = (filename: string) => `${uploadPrefix}/${filename}`;

const resolveRequestOrigin = (req: any) => {
  const envBase =
    String(process.env.APP_BASE_URL || process.env.API_BASE_URL || process.env.PUBLIC_API_BASE_URL || '')
      .trim()
      .replace(/\/+$/g, '');
  if (envBase) return envBase;
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req?.headers?.host || '').trim();
  const protocol = forwardedProto || req?.protocol || 'https';
  if (!host) return '';
  return `${protocol}://${host}`;
};

const resolveUploadedUrl = (req: any, filename: string) => {
  if (!useS3Uploads) {
    const relativePath = `/uploads/${filename}`;
    const origin = resolveRequestOrigin(req);
    if (!origin) return relativePath;
    try {
      return new URL(relativePath, origin).toString();
    } catch {
      return relativePath;
    }
  }
  const key = resolveS3ObjectKey(filename);
  if (uploadBaseUrl) {
    return `${uploadBaseUrl}/${key}`;
  }
  return `https://${uploadBucket}.s3.${uploadRegion}.amazonaws.com/${key}`;
};

const persistUploadedFile = async (req: any, file: Express.Multer.File) => {
  const extension = resolveFileExtension(file);
  const filename = useS3Uploads ? `${uuidv4()}${extension}` : String(file.filename || `${uuidv4()}${extension}`);
  if (useS3Uploads) {
    if (!s3Client || !uploadBucket) {
      throw new Error('AWS S3 upload is enabled but bucket/client is not configured.');
    }
    const bodyBuffer = file.buffer;
    if (!bodyBuffer) {
      throw new Error('Uploaded file buffer is missing for S3 upload.');
    }
    const objectKey = resolveS3ObjectKey(filename);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: uploadBucket,
        Key: objectKey,
        Body: bodyBuffer,
        ContentType: file.mimetype,
        CacheControl: /^image\//i.test(String(file.mimetype || ''))
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=0, no-cache',
      })
    );
  }
  return {
    url: resolveUploadedUrl(req, filename),
    filename,
    size: file.size,
  };
};

const createUpload = (allowedMap: Record<string, string>, fileSizeMb: number, rejectedMessage: string) =>
  multer({
    storage,
    fileFilter: (_req: any, file: any, cb: any) => {
      if (allowedMap[file.mimetype]) {
        cb(null, true);
      } else {
        cb(new Error(rejectedMessage), false);
      }
    },
    limits: {
      fileSize: fileSizeMb * 1024 * 1024,
    },
  });

const imageUpload = createUpload(
  imageMimeTypes,
  5,
  'Only JPEG, PNG, and WebP images are allowed.'
);
const documentUpload = createUpload(
  documentMimeTypes,
  10,
  'Only PDF, DOC, DOCX, TXT, RTF, and ODT documents are allowed.'
);
const mixedUpload = createUpload(
  allMimeTypes,
  10,
  'Only approved image or document files are allowed.'
);

const sendSingleUploadResponse = async (req: any, res: any, file: Express.Multer.File, successMessage: string) => {
  const persisted = await persistUploadedFile(req, file);
  res.json({
    success: true,
    message: successMessage,
    data: persisted,
  });
};

const sendMultiUploadResponse = async (req: any, res: any, files: Express.Multer.File[], label: string) => {
  const persisted = await Promise.all(files.map((file) => persistUploadedFile(req, file)));
  res.json({
    success: true,
    message: `${files.length} ${label}(s) uploaded successfully.`,
    data: persisted,
  });
};

router.post('/image', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }
    await sendSingleUploadResponse(req, res, req.file, 'Image uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload image.' });
  }
});

router.post('/images', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), imageUpload.array('images', 10), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided.' });
    }
    await sendMultiUploadResponse(req, res, files, 'image');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload images.' });
  }
});

router.post('/document', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), documentUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file provided.' });
    }
    await sendSingleUploadResponse(req, res, req.file, 'Document uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload document.' });
  }
});

router.post('/documents', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), documentUpload.array('documents', 10), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No document files provided.' });
    }
    await sendMultiUploadResponse(req, res, files, 'document');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload documents.' });
  }
});

router.post('/file', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), mixedUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided.' });
    }
    await sendSingleUploadResponse(req, res, req.file, 'File uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file.' });
  }
});

router.post('/files', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), mixedUpload.array('files', 10), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided.' });
    }
    await sendMultiUploadResponse(req, res, files, 'file');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload files.' });
  }
});

export default router;
