import { Router } from 'express';
import { requireAdmin, supabase } from '../middleware/auth.js';

const router = Router();

// GET /api/users — admin gets all customers
router.get('/', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, box_number, phone, role, created_at')
    .eq('role', 'customer')
    .order('full_name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/users — admin creates a customer account
router.post('/', requireAdmin, async (req, res) => {
  const { email, password, full_name, box_number, phone } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password, and full_name are required' });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  // Profile is created by DB trigger; update with extra fields
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name, box_number, phone, role: 'customer' })
    .eq('id', authData.user.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/users/:id — admin updates a customer
router.patch('/:id', requireAdmin, async (req, res) => {
  const { full_name, box_number, phone } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name, box_number, phone })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/users/:id — admin deletes a customer
router.delete('/:id', requireAdmin, async (req, res) => {
  // Deleting from auth.users cascades to profiles and mail_items
  const { error } = await supabase.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
