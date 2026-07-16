const buckets = new Map();
export function rateLimit(options) {
    const { windowMs, max } = options;
    return function rateLimitMiddleware(req, res, next) {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (bucket.count >= max) {
            const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfterSec));
            return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
        }
        bucket.count += 1;
        next();
    };
}
