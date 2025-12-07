import { Request, Response, NextFunction } from 'express';
import { ConnectionError, ValidationError, EmptyResultError } from 'sequelize';

function errorLogger(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error(error.message);
  next(error);
}

function dbErrorHandler(error : Error, req: Request, res: Response, next: NextFunction) {
  if (error instanceof ConnectionError) return res.sendStatus(503);
  else if (error instanceof ValidationError) return res.status(409).json({ message: error.message });
  else if (error instanceof EmptyResultError) return res.sendStatus(404);
  else next(error);
}

function serverErrorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  return res.sendStatus(500);
}

export default [errorLogger, dbErrorHandler, serverErrorHandler];
