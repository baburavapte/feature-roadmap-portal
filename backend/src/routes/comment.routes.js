import { Router } from 'express';
import { updateComment, deleteComment } from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.patch('/:id', authenticate, updateComment);
router.delete('/:id', authenticate, deleteComment);

export default router;
