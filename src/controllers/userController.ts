import { Request, Response, NextFunction } from 'express';
import UserService from '../services/userService';

const userService = new UserService();

function deleteUserHandler(req: Request, res: Response, next: NextFunction) {
  const { user_id } = { ...req.body };
  userService.destroy(user_id)
    .then(() => res.status(204).json())
    .catch((error) => next(error))
}

export default { destroy: deleteUserHandler }

