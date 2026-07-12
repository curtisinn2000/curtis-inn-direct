import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { z } from 'zod';
import { allowedOrigins, config } from './config.js';
import { errorHandler } from './middleware.js';
import { publicRouter } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { stripeRouter, stripeWebhookRouter } from './routes/stripe.js';
import { pool } from './db.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);
app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed.',
        details: error.flatten(),
      },
    });
  }
  return errorHandler(error, _req, res, next);
});

const server = app.listen(config.PORT, () => {
  console.log(`Curtis Inn backend listening on ${config.PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
