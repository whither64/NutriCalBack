import express from 'express'
import * as authController from '../controllers/authController.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Function to initialize routes with pool
export const createAuthRoutes = (pool) => {
  // Public routes
  router.post('/register', (req, res) => authController.register(req, res, pool))
  router.post('/login', (req, res) => authController.login(req, res, pool))
  router.post('/verify-email', (req, res) => authController.verifyEmail(req, res, pool))
  router.post('/request-password-reset', (req, res) => authController.requestPasswordReset(req, res, pool))
  router.post('/reset-password', (req, res) => authController.resetPassword(req, res, pool))

  // Protected routes
  router.get('/me', authMiddleware, (req, res) => authController.getCurrentUser(req, res, pool))

  return router
}

export default router
