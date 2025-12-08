/**
 * Organization Routes
 * ===================
 */

import { Router } from 'express';
import { organizationController, organizationErrorHandler } from './organization.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Current organization (requires auth)
router.get('/me', (req, res, next) => organizationController.getCurrent(req, res, next));
router.put('/me', (req, res, next) => organizationController.updateCurrent(req, res, next));
router.put('/me/settings', (req, res, next) => organizationController.updateSettings(req, res, next));

// AFIP configuration
router.post('/me/afip', (req, res, next) => organizationController.configureAFIP(req, res, next));
router.get('/me/afip/status', (req, res, next) => organizationController.getAFIPStatus(req, res, next));

// By ID (admin only)
router.get('/:id', (req, res, next) => organizationController.getById(req, res, next));

// Error handler
router.use(organizationErrorHandler);

export default router;
