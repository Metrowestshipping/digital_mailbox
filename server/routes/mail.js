import { Router } from 'express';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth, requireAdmin, supabase } from '../middleware/auth.js';
import { sendDailySummary } from '../lib/mailer.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.S3_BUCKET;

function s3KeyFromUrl(url) {
  // URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
  try {
    const { pathname } = new URL(url);
    return pathname.slice(1); // strip leading /
  } catch {
    return null;
  }
}

async function deleteFromS3(url) {
  const key = s3KeyFromUrl(url);
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

const router = Router();

// GET /api/mail — customer gets own mail, admin gets all (optionally filtered by customer_id)
router.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user.profile?.role === 'admin';
  const { customer_id, status } = req.query;

  let query = supabase.from('mail_items').select(`
    *,
    customer:profiles!mail_items_customer_id_fkey(id, full_name, email, box_number),
    timeline:mail_timeline(id, action, notes, created_at, performed_by)
  `).order('received_date', { ascending: false });

  if (!isAdmin) {
    query = query.eq('customer_id', req.user.id);
  } else if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/mail/:id — get single mail item with timeline
router.get('/:id', requireAuth, async (req, res) => {
  const isAdmin = req.user.profile?.role === 'admin';

  let query = supabase.from('mail_items').select(`
    *,
    customer:profiles!mail_items_customer_id_fkey(id, full_name, email, box_number),
    timeline:mail_timeline(id, action, notes, created_at, performed_by)
  `).eq('id', req.params.id).single();

  const { data, error } = await query;
  if (error) return res.status(404).json({ error: 'Not found' });

  // Customers can only view their own mail
  if (!isAdmin && data.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(data);
});

// POST /api/mail — admin creates new mail item
router.post('/', requireAdmin, async (req, res) => {
  const { customer_id, image_url, notes } = req.body;

  if (!customer_id || !image_url) {
    return res.status(400).json({ error: 'customer_id and image_url are required' });
  }

  const { data: mailItem, error } = await supabase.from('mail_items').insert({
    customer_id,
    image_url,
    notes,
    status: 'new',
    received_date: new Date().toISOString(),
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Add timeline entry
  await supabase.from('mail_timeline').insert({
    mail_item_id: mailItem.id,
    action: 'received',
    performed_by: req.user.id,
    notes: 'Mail received and added to inbox',
  });

  res.status(201).json(mailItem);
});

// POST /api/mail/bulk — admin creates multiple mail items at once
router.post('/bulk', requireAdmin, async (req, res) => {
  const { customer_id, image_urls, notes } = req.body;

  if (!customer_id || !Array.isArray(image_urls) || image_urls.length === 0) {
    return res.status(400).json({ error: 'customer_id and image_urls array are required' });
  }

  const now = new Date().toISOString();
  const rows = image_urls.map((image_url) => ({
    customer_id,
    image_url,
    notes: notes || null,
    status: 'new',
    received_date: now,
  }));

  const { data: mailItems, error } = await supabase
    .from('mail_items')
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Add timeline entries for all
  const timelineRows = mailItems.map((item) => ({
    mail_item_id: item.id,
    action: 'received',
    performed_by: req.user.id,
    notes: 'Mail received and added to inbox',
  }));
  await supabase.from('mail_timeline').insert(timelineRows);

  res.status(201).json(mailItems);
});

// PATCH /api/mail/:id/request-action — customer requests an action
router.patch('/:id/request-action', requireAuth, async (req, res) => {
  const { action } = req.body;

  const validActions = ['scan_requested', 'forward_requested', 'shred_requested', 'keep_requested', 'shred_after_scan_requested'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('mail_items')
    .select('id, customer_id, status, action')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.customer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  // Validate allowed transitions
  const isInitialAction = ['scan_requested', 'forward_requested', 'shred_requested', 'keep_requested'].includes(action);
  const isPostScanShred = action === 'shred_after_scan_requested'
    && existing.status === 'completed'
    && existing.action === 'scan_completed';

  if (isInitialAction && existing.status !== 'new') {
    return res.status(400).json({ error: 'Action already requested' });
  }
  if (!isInitialAction && !isPostScanShred) {
    return res.status(400).json({ error: 'Cannot request this action at this stage' });
  }

  const { data, error } = await supabase
    .from('mail_items')
    .update({ status: 'pending_action', action, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  const labels = {
    scan_requested: 'Scan requested by customer',
    forward_requested: 'Forward requested by customer',
    shred_requested: 'Shred requested by customer',
    keep_requested: 'Keep requested by customer',
    shred_after_scan_requested: 'Customer reviewed scan and requested shred',
  };

  await supabase.from('mail_timeline').insert({
    mail_item_id: req.params.id,
    action,
    performed_by: req.user.id,
    notes: labels[action],
  });

  res.json(data);
});

// PATCH /api/mail/:id/complete — admin completes an action
router.patch('/:id/complete', requireAdmin, async (req, res) => {
  const { action, scan_files, tracking_number, notes } = req.body;

  const validCompletions = ['scan_completed', 'forwarded', 'shredded', 'kept'];
  if (!validCompletions.includes(action)) {
    return res.status(400).json({ error: 'Invalid completion action' });
  }

  const updates = {
    status: 'completed',
    action,
    updated_at: new Date().toISOString(),
  };

  if (action === 'scan_completed' && scan_files) updates.scan_files = scan_files;
  if (action === 'forwarded' && tracking_number) updates.tracking_number = tracking_number;

  const { data, error } = await supabase
    .from('mail_items')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  const labels = {
    scan_completed: 'Mail scanned and uploaded',
    forwarded: `Mail forwarded${tracking_number ? ` — tracking: ${tracking_number}` : ''}`,
    shredded: 'Mail shredded',
    kept: 'Mail kept — confirmed by admin',
  };

  await supabase.from('mail_timeline').insert({
    mail_item_id: req.params.id,
    action,
    performed_by: req.user.id,
    notes: notes || labels[action],
  });

  res.json(data);
});

// DELETE /api/mail/:id — admin permanently deletes a mail item
router.delete('/:id', requireAdmin, async (req, res) => {
  const { data: existing } = await supabase
    .from('mail_items')
    .select('id, image_url, scan_files')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { error } = await supabase
    .from('mail_items')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  // Delete files from S3 (best effort — don't fail the request if S3 errors)
  const filesToDelete = [
    existing.image_url,
    ...(Array.isArray(existing.scan_files) ? existing.scan_files : []),
  ].filter(Boolean);

  await Promise.allSettled(filesToDelete.map(deleteFromS3));

  res.json({ success: true });
});

// PATCH /api/mail/:id/archive — archive a completed mail item
router.patch('/:id/archive', requireAuth, async (req, res) => {
  const isAdmin = req.user.profile?.role === 'admin';

  const { data: existing } = await supabase
    .from('mail_items')
    .select('id, customer_id, status')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && existing.customer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('mail_items')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('mail_timeline').insert({
    mail_item_id: req.params.id,
    action: 'archived',
    performed_by: req.user.id,
    notes: 'Mail archived',
  });

  res.json(data);
});

// POST /api/mail/send-reminders — admin sends daily summary emails to all customers who got mail today
router.post('/send-reminders', requireAdmin, async (req, res) => {
  // Get today's date range in UTC
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch all mail items received today with customer info
  const { data: todaysMail, error } = await supabase
    .from('mail_items')
    .select('customer_id, customer:profiles!mail_items_customer_id_fkey(id, full_name, email)')
    .gte('received_date', todayStart.toISOString())
    .lte('received_date', todayEnd.toISOString());

  if (error) return res.status(500).json({ error: error.message });
  if (!todaysMail || !todaysMail.length) return res.json({ sent: 0, total: 0, results: [] });

  // Group by customer
  const byCustomer = {};
  for (const item of todaysMail) {
    const id = item.customer_id;
    if (!byCustomer[id]) byCustomer[id] = { customer: item.customer, count: 0 };
    byCustomer[id].count++;
  }

  // Send one email per customer
  const results = [];
  for (const { customer, count } of Object.values(byCustomer)) {
    if (!customer?.email) continue;
    try {
      await sendDailySummary({
        toEmail: customer.email,
        toName: customer.full_name || customer.email,
        count,
      });
      results.push({ email: customer.email, count, ok: true });
    } catch (err) {
      results.push({ email: customer.email, count, ok: false, error: err.message });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  res.json({ sent, total: results.length, results });
});

export default router;
