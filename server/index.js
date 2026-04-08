import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mailRoutes from './routes/mail.js';
import uploadRoutes from './routes/upload.js';
import usersRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/mail', mailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', usersRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
