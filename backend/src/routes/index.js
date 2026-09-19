import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import featureRoutes from './featureRequest.routes.js';
import commentRoutes from './comment.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/features', featureRoutes);
router.use('/comments', commentRoutes);

// Future route registrations:
// router.use('/roadmap', roadmapRoutes);

export default router;

