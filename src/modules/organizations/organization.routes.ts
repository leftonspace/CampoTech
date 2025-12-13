/**
 * Organization Routes
 * ===================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { organizationController, organizationErrorHandler } from './organization.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Current organization (requires auth)
router.get('/me', (req: Request, res: Response, next: NextFunction) => organizationController.getCurrent(req, res, next));
router.put('/me', (req: Request, res: Response, next: NextFunction) => organizationController.updateCurrent(req, res, next));
router.put('/me/settings', (req: Request, res: Response, next: NextFunction) => organizationController.updateSettings(req, res, next));

// AFIP configuration
router.post('/me/afip', (req: Request, res: Response, next: NextFunction) => organizationController.configureAFIP(req, res, next));
router.get('/me/afip/status', (req: Request, res: Response, next: NextFunction) => organizationController.getAFIPStatus(req, res, next));

// By ID (admin only)
router.get('/:id', (req: Request, res: Response, next: NextFunction) => organizationController.getById(req, res, next));

// Error handler
router.use(organizationErrorHandler);

export default router;
