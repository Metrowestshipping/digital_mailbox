import { Router } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;

// POST /api/upload/presign — get a presigned URL for direct S3 upload
// Admin uploads mail images; also used for scan uploads
router.post('/presign', requireAuth, async (req, res) => {
  const { filename, contentType, folder = 'mail-images' } = req.body;
  const isAdmin = req.user.profile?.role === 'admin';

  // Only admins can upload mail images; both can upload scan files (admin only for scans too)
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const ext = filename?.split('.').pop() || 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || 'image/jpeg',
  });

  try {
    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
    const fileUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ uploadUrl: url, fileUrl, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/upload — delete a file from S3 (admin only)
router.delete('/', requireAdmin, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
