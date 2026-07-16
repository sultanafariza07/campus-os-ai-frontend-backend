import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { authRouter } from './routes/auth.routes.js';
import { notesRouter } from './routes/notes.routes.js';
import { tasksRouter } from './routes/tasks.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
const app = express();
app.use(helmet({
    // Sensible defaults for an API server (no HTML pages served here beyond
    // the root status message), plus the usual security headers helmet
    // already applies (X-Content-Type-Options, X-Frame-Options, etc).
    crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({
    origin: (origin, cb) => {
        // Allow non-browser clients (e.g., curl, Render health checks) that don't send an Origin header.
        if (!origin)
            return cb(null, true);
        // Allow explicit configured origin (e.g. production frontend URL).
        if (config.CORS_ORIGIN && origin === config.CORS_ORIGIN)
            return cb(null, true);
        return cb(new Error(`CORS blocked: origin=${origin}`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api/notes', notesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.get('/', (_req, res) => {
    res.json({
        message: 'CampusOS AI Backend Running 🚀',
    });
});
app.use(notFound);
app.use(errorHandler);
app.listen(config.PORT, () => {
    console.log(`CampusOS AI Backend listening on http://localhost:${config.PORT}`);
});
