// server.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createAuthRoutes } from './routes/auth.js'
import { createUsuariosRoutes } from './routes/usuarios.js'
import { createAlimentosRoutes } from './routes/alimentos.js'
import { createRecetasRoutes } from './routes/recetas.js'
import { createPlanesRoutes } from './routes/planes.js'
import { createRegistrosRoutes } from './routes/registros.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Configuración mejorada de Prisma
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'pretty',
})

// Manejo de conexión con reintentos
async function connectWithRetry() {
  let retries = 5
  while (retries) {
    try {
      await prisma.$connect()
      console.log('✅ Database connected successfully')
      
      // Verificar modelos disponibles
      const models = Object.keys(prisma).filter(key => 
        !key.startsWith('$') && 
        !key.startsWith('_') &&
        typeof prisma[key] === 'object'
      )
      console.log('📊 Modelos disponibles:', models)
      return true
    } catch (err) {
      console.error(`❌ Database connection error (${retries} retries left):`, err.message)
      retries -= 1
      if (retries === 0) {
        console.error('❌ Failed to connect to database after multiple attempts')
        return false
      }
      await new Promise(resolve => setTimeout(resolve, 5000)) // Esperar 5 segundos
    }
  }
}

// Middleware
app.use(cors({
  origin: '*', // Temporal para pruebas
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'NutriCal API is running', timestamp: new Date() })
})

// Debug route mejorada
app.get('/api/debug', (req, res) => {
  const models = Object.keys(prisma).filter(key => 
    !key.startsWith('$') && 
    !key.startsWith('_') &&
    typeof prisma[key] === 'object' &&
    prisma[key] !== null
  )
  
  res.json({
    success: true,
    timestamp: new Date(),
    databaseConnected: true,
    prismaModels: models,
    hasTUsuarios: models.includes('tUsuarios'),
    hasUser: models.includes('user'),
    nodeEnv: process.env.NODE_ENV
  })
})

// Montar rutas - solo después de conectar
connectWithRetry().then((connected) => {
  if (connected) {
    app.use('/api/auth', createAuthRoutes(prisma))
    app.use('/api/usuarios', createUsuariosRoutes(prisma))
    app.use('/api/alimentos', createAlimentosRoutes(prisma))
    app.use('/api/recetas', createRecetasRoutes(prisma))
    app.use('/api/planes', createPlanesRoutes(prisma))
    app.use('/api/registros', createRegistrosRoutes(prisma))
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📍 Debug: http://localhost:${PORT}/api/debug`)
      console.log(`📍 Test DB: http://localhost:${PORT}/api/usuarios/test-db`)
    })
  } else {
    console.error('❌ Server started but database connection failed')
    process.exit(1)
  }
})

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  console.log('🔌 Disconnected from database')
  process.exit(0)
})