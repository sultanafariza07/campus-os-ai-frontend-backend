import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication invalid.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    // Assuming the payload has an `id` property for the user ID
    req.user = { id: (payload as any).id };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication invalid.' });
  }
};

// This extends the Express Request type to include our user property
declare global {
  namespace Express {
    export interface Request {
      user: { id: number };
    }
  }
}