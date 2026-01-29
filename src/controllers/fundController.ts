import { Request, Response, NextFunction } from 'express';
import FundService from '../services/fundService';

const fundService = new FundService();

function createFundHandler(req: Request, res: Response, next: NextFunction) {
  const payload = req.body;
  fundService.create(payload)
    .then((data) => res.status(201).json(data))
    .catch((error) => next(error))
}

function destroyFundHandler(req: Request, res: Response, next: NextFunction) {
  const payload = { id: req.params.id, user_id: req.body.user_id };
  fundService.destroy(payload)
    .then(() => res.sendStatus(204))
    .catch((error) => next(error))
}

function readFundHandler(req: Request, res: Response, next: NextFunction) {
  const payload = req.body;
  fundService.read(payload)
    .then((data) => res.status(200).json(data))
    .catch((error: Error) => next(error))
}

function updateFundHandler(req: Request, res: Response, next: NextFunction) {
  const payload = { ...req.body, id: req.params.id };
  fundService.update(payload)
    .then((data) => res.status(200).json(data))
    .catch((error) => next(error))
}

export default {
  create: createFundHandler,
  destroy: destroyFundHandler,
  read: readFundHandler,
  update: updateFundHandler,
}