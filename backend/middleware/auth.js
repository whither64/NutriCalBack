import jwt from 'jsonwebtoken'

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'No token provided, authorization denied' })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    
    // Add user info to request
    req.user = decoded
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(401).json({ error: 'Token is not valid' })
  }
}

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
      req.user = decoded
    }
    
    next()
  } catch (err) {
    // If token is invalid, continue without user
    next()
  }
}
