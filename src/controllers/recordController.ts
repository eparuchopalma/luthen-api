import { Request, Response, NextFunction } from 'express';
import RecordService from '../services/recordService';

const { read, update, create, destroy } = new RecordService();

function createRecordHandler(req: Request, res: Response, next: NextFunction) {
  const payload = req.body;
  create(payload)
    .then((data) => res.status(201).json(data))
    .catch((error) => next(error))
}

function deleteRecordHandler(req: Request, res: Response, next: NextFunction) {
  const payload = { ...req.body, id: req.params.id };
  destroy(payload)
    .then((data) => res.status(200).json(data))
    .catch((error) => next(error))
}

function readRecordHandler(req: Request, res: Response, next: NextFunction) {
  const payload = { user_id: req.body.user_id, ...req.query };
  read(payload)
    .then((data) => res.json(data))
    .catch((error: Error) => next(error))
}

function updateRecordHandler(req: Request, res: Response, next: NextFunction) {
  const payload = { ...req.body, id: req.params.id };
  update(payload)
    .then((data) => res.status(200).json(data))
    .catch((error) => next(error))
}

export default {
  read: readRecordHandler,
  update: updateRecordHandler,
  create: createRecordHandler,
  destroy: deleteRecordHandler
}