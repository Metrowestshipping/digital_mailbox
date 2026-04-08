import { Router } from 'express';
import { requireAuth, requireAdmin, supabase } from '../middleware/auth.js';

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

export default router;
