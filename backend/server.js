import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
// import pg from 'pg' ya no se usa, prisma lo manejará
import pkg from '@prisma/client'
import { createAuthRoutes } from './routes/auth.js'
import { createFoodRoutes } from './routes/foods.js'

dotenv.config()

// const { Pool } = pg, tampoco se usa, prisma lo manejará

const { PrismaClient } = pkg
const app = express()
const PORT = process.env.PORT || 3000
const prisma = new PrismaClient()

// PostgreSQL connection pool
/*
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nutrical',
  user: process.env.DB_USER || 'nutrical_user',
  password: process.env.DB_PASSWORD || 'nutrical_password',
})
igual ya no se usará esta funcion por prisma */ 


// Test database connection
/* para probar la conexión a la base de datos con prisma, se usa otra funcion distinta
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to database:', err)
  } else {
    console.log('Database connected successfully at:', res.rows[0].now)
  }
})
*/
// test database connection con prisma
prisma.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((err) => console.error('Database connection error:', err))

// Middleware
app.use(cors())
app.use(express.json())

// Inicizlizar tablas de la bd
/* la funcion initDB() ya no se usará, prisma se encargará ahora
const initDB = async () => {
  try {
    // Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // Crear tabla de alimentos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS foods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        calories DECIMAL(10, 2) NOT NULL,
        protein DECIMAL(10, 2) NOT NULL,
        carbs DECIMAL(10, 2) NOT NULL,
        fat DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('Database tables initialized')
  } catch (err) {
    console.error('Error initializing database:', err)
  }
}
*/

// initDB(), esta función ya no se usará, prisma se encargará de manejar las migraciones y la creación de tablas a través de su sistema de migraciones.

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'NutriCal API is running' })
})

// Mount routes
app.use('/api/auth', createAuthRoutes(prisma)) // cambiamos el pool por prisma
app.use('/api/foods', createFoodRoutes(prisma)) //cambiamos el pool por prisma

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
