import { Request, Response, NextFunction } from 'express-serve-static-core';
const { auth } = require('express-oauth2-jwt-bearer');
const { authOptions } = require('../config')
const { audience, issuerBaseURL, tokenSigningAlg } = authOptions

const checkAuth = auth({ audience, issuerBaseURL, tokenSigningAlg });

const authenticator = (req: Request, res: Response, next: NextFunction) => {
  const inDemo = req.path.includes('public');
  return (inDemo) ? next() : checkAuth(req, res, next);
}

const identifier = (req: Request & { auth?: { payload: { sub: string } } }, res: Response, next: NextFunction) => {
  const user_id = req.auth?.payload?.sub ?? process.env.DEMO_USER!;
  req.body = { ...req.body, user_id };
  next();
};

export default [authenticator, identifier];