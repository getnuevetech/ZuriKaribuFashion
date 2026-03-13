import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const extension = allMimeTypes[file.mimetype];
    const uniqueName = `${uuidv4()}${extension || path.extname(file.originalname) || '.bin'}`;
    cb(null, uniqueName);
  },
});

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

const sendSingleUploadResponse = (res: any, file: Express.Multer.File, successMessage: string) => {
  res.json({
    success: true,
    message: successMessage,
    data: {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    },
  });
};

const sendMultiUploadResponse = (res: any, files: Express.Multer.File[], label: string) => {
  res.json({
    success: true,
    message: `${files.length} ${label}(s) uploaded successfully.`,
    data: files.map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    })),
  });
};

router.post('/image', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }
    sendSingleUploadResponse(res, req.file, 'Image uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload image.' });
  }
});

router.post('/images', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), imageUpload.array('images', 10), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided.' });
    }
    sendMultiUploadResponse(res, files, 'image');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload images.' });
  }
});

router.post('/document', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), documentUpload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file provided.' });
    }
    sendSingleUploadResponse(res, req.file, 'Document uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload document.' });
  }
});

router.post('/documents', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), documentUpload.array('documents', 10), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No document files provided.' });
    }
    sendMultiUploadResponse(res, files, 'document');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload documents.' });
  }
});

router.post('/file', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), mixedUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided.' });
    }
    sendSingleUploadResponse(res, req.file, 'File uploaded successfully.');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file.' });
  }
});

router.post('/files', authenticate, authorizePermissions(Permissions.UPLOADS_CREATE), mixedUpload.array('files', 10), (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided.' });
    }
    sendMultiUploadResponse(res, files, 'file');
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload files.' });
  }
});

export default router;
