import type { Request, Response, NextFunction, RequestHandler } from 'express'

// Express 4 does not forward rejected promises from async handlers to
// next() automatically — an uncaught error in an `async (req, res) => {}`
// route becomes an unhandled rejection instead of a JSON 500 response.
// Wrapping a handler in asyncHandler(...) fixes that for the routes that
// use it, without touching how any existing route is written.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
