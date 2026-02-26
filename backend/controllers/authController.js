import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  })
}

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  )
}

// Register user
export const register = async (req, res, pool) => {
  const { email, password, name } = req.body

  // Validation
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Please provide all required fields' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password, name, verification_token) VALUES ($1, $2, $3, $4) RETURNING id, email, name, is_verified, created_at',
      [email, hashedPassword, name, verificationToken]
    )

    const user = result.rows[0]

    // Send verification email (optional - only if email credentials are set)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      try {
        const transporter = createTransporter()
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Verify your NutriCal account',
          html: `
            <h1>Welcome to NutriCal!</h1>
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verificationUrl}">Verify Email</a>
            <p>Or copy this link: ${verificationUrl}</p>
          `
        })
      } catch (emailError) {
        console.error('Email sending failed:', emailError)
        // Continue even if email fails
      }
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.is_verified
      }
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Server error during registration' })
  }
}

// Login user
export const login = async (req, res, pool) => {
  const { email, password } = req.body

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password' })
  }

  try {
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.is_verified
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error during login' })
  }
}

// Verify email
export const verifyEmail = async (req, res, pool) => {
  const { token } = req.body

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' })
  }

  try {
    // Find user with verification token
    const result = await pool.query(
      'SELECT * FROM users WHERE verification_token = $1',
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    const user = result.rows[0]

    // Update user verification status
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1',
      [user.id]
    )

    res.json({ message: 'Email verified successfully' })
  } catch (err) {
    console.error('Verify email error:', err)
    res.status(500).json({ error: 'Server error during email verification' })
  }
}

// Get current user
export const getCurrentUser = async (req, res, pool) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_verified, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error('Get current user error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Request password reset
export const requestPasswordReset = async (req, res, pool) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    if (result.rows.length === 0) {
      // Don't reveal if user exists
      return res.json({ message: 'If the email exists, a reset link has been sent' })
    }

    const user = result.rows[0]

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

    // Save reset token
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    )

    // Send reset email (optional)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      try {
        const transporter = createTransporter()
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Password Reset - NutriCal',
          html: `
            <h1>Password Reset Request</h1>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>Or copy this link: ${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
          `
        })
      } catch (emailError) {
        console.error('Reset email sending failed:', emailError)
      }
    }

    res.json({ message: 'If the email exists, a reset link has been sent' })
  } catch (err) {
    console.error('Request password reset error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Reset password
export const resetPassword = async (req, res, pool) => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Find user with valid reset token
    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    const user = result.rows[0]

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hashedPassword, user.id]
    )

    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
