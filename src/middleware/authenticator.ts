import { Request, Response, NextFunction } from 'express-serve-static-core';
const { auth } = require('express-oauth2-jwt-bearer');
const { authOptions } = require('../config')
const { audience, issuerBaseURL, tokenSigningAlg } = authOptions

const setUser = (req: Request & { auth?: { payload: { sub: string } } }, res: Response, next: NextFunction) => {
  const user_id = req.auth?.payload?.sub ?? process.env.DEMO_USER!;
  req.body = { ...req.body, user_id };
  next();
};

export default [auth({ audience, issuerBaseURL, tokenSigningAlg }), setUser];