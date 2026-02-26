import express from 'express'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Function to initialize routes with pool
export const createFoodRoutes = (pool) => {
  // Get all foods (optional auth - if logged in, show only user's foods)
  router.get('/', optionalAuth, async (req, res) => {
    try {
      let query = 'SELECT * FROM foods'
      let params = []

      if (req.user) {
        query += ' WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC'
        params = [req.user.userId]
      } else {
        query += ' WHERE user_id IS NULL ORDER BY created_at DESC'
      }

      const result = await pool.query(query, params)
      res.json(result.rows)
    } catch (err) {
      console.error('Error fetching foods:', err)
      res.status(500).json({ error: 'Error fetching foods' })
    }
  })

  // Get a single food by ID
  router.get('/:id', async (req, res) => {
    const { id } = req.params
    try {
      const result = await pool.query('SELECT * FROM foods WHERE id = $1', [id])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Food not found' })
      }
      res.json(result.rows[0])
    } catch (err) {
      console.error('Error fetching food:', err)
      res.status(500).json({ error: 'Error fetching food' })
    }
  })

  // Create a new food (requires authentication)
  router.post('/', authMiddleware, async (req, res) => {
    const { name, calories, protein, carbs, fat } = req.body
    
    if (!name || calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const result = await pool.query(
        'INSERT INTO foods (name, calories, protein, carbs, fat, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, calories, protein, carbs, fat, req.user.userId]
      )
      res.status(201).json(result.rows[0])
    } catch (err) {
      console.error('Error creating food:', err)
      res.status(500).json({ error: 'Error creating food' })
    }
  })

  // Update a food (requires authentication and ownership)
  router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params
    const { name, calories, protein, carbs, fat } = req.body

    try {
      // Check if food belongs to user
      const checkResult = await pool.query('SELECT * FROM foods WHERE id = $1', [id])
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Food not found' })
      }

      const food = checkResult.rows[0]
      
      if (food.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized to update this food' })
      }

      const result = await pool.query(
        'UPDATE foods SET name = $1, calories = $2, protein = $3, carbs = $4, fat = $5 WHERE id = $6 RETURNING *',
        [name, calories, protein, carbs, fat, id]
      )
      
      res.json(result.rows[0])
    } catch (err) {
      console.error('Error updating food:', err)
      res.status(500).json({ error: 'Error updating food' })
    }
  })

  // Delete a food (requires authentication and ownership)
  router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params

    try {
      // Check if food belongs to user
      const checkResult = await pool.query('SELECT * FROM foods WHERE id = $1', [id])
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Food not found' })
      }

      const food = checkResult.rows[0]
      
      if (food.user_id && food.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized to delete this food' })
      }

      const result = await pool.query('DELETE FROM foods WHERE id = $1 RETURNING *', [id])
      res.json({ message: 'Food deleted successfully', food: result.rows[0] })
    } catch (err) {
      console.error('Error deleting food:', err)
      res.status(500).json({ error: 'Error deleting food' })
    }
  })

  return router
}

export default router
