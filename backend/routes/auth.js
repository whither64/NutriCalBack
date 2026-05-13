// routes/auth.js
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const router = express.Router()

// Función para inicializar rutas con prisma
export const createAuthRoutes = (prisma) => {
  
  // Registro de usuario
  router.post('/register', async (req, res) => {
    try {
      const { nombre, correo, contraseña, edad, peso, estatura, objetivo } = req.body
      
      // Validaciones
      if (!nombre || !correo || !contraseña) {
        return res.status(400).json({ 
          error: 'Faltan campos requeridos',
          required: ['nombre', 'correo', 'contraseña']
        })
      }
      
      // Verificar si el usuario ya existe
      const existeUsuario = await prisma.tUsuarios.findUnique({
        where: { correo }
      })
      
      if (existeUsuario) {
        return res.status(400).json({ error: 'El correo ya está registrado' })
      }
      
      // Encriptar contraseña
      const saltRounds = 10
      const contraseñaEncriptada = await bcrypt.hash(contraseña, saltRounds)
      
      // Crear usuario
      const nuevoUsuario = await prisma.tUsuarios.create({
        data: {
          nombre,
          correo,
          contraseña: contraseñaEncriptada,
          edad: edad ? parseInt(edad) : null,
          peso: peso ? parseFloat(peso) : null,
          estatura: estatura ? parseFloat(estatura) : null,
          objetivo: objetivo || null
        },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
          
        }
      })
      
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        usuario: nuevoUsuario
      })
      
    } catch (error) {
      console.error('Error en registro:', error)
      res.status(500).json({ error: 'Error al registrar usuario', details: error.message })
    }
  })
  
  // Login de usuario
  router.post('/login', async (req, res) => {
    try {
      const { correo, contraseña } = req.body
      
      if (!correo || !contraseña) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' })
      }
      
      // Buscar usuario por correo
      const usuario = await prisma.tUsuarios.findUnique({
        where: { correo }
      })
      
      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales inválidas' })
      }
      
      // Verificar contraseña
      const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña)
      
      if (!contraseñaValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' })
      }
      
      // Generar JWT
      const token = jwt.sign(
        { 
          id_usuario: usuario.id_usuario, 
          correo: usuario.correo,
          nombre: usuario.nombre 
        },
        process.env.JWT_SECRET || 'mi-secreto-temporal-12345',
        { expiresIn: '7d' }
      )
      
      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          correo: usuario.correo,
          edad: usuario.edad,
          peso: usuario.peso,
          estatura: usuario.estatura,
          objetivo: usuario.objetivo
        }
      })
      
    } catch (error) {
      console.error('Error en login:', error)
      res.status(500).json({ error: 'Error al iniciar sesión', details: error.message })
    }
  })
  
  // Obtener usuario actual (protegido)
  router.get('/me', async (req, res) => {
    try {
      // Obtener token del header
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' })
      }
      
      const token = authHeader.split(' ')[1]
      
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi-secreto-temporal-12345')
      
      // Buscar usuario actualizado
      const usuario = await prisma.tUsuarios.findUnique({
        where: { id_usuario: decoded.id_usuario },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
          
        }
      })
      
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' })
      }
      
      res.json({
        success: true,
        usuario
      })
      
    } catch (error) {
      console.error('Error en /me:', error)
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' })
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' })
      }
      res.status(500).json({ error: 'Error al obtener usuario', details: error.message })
    }
  })
  
  // Verificar email (opcional - si implementas verificación por email)
  router.post('/verify-email', async (req, res) => {
    // Por ahora, endpoint placeholder
    res.json({ message: 'Verificación de email - por implementar' })
  })
  
  // Solicitar reset de contraseña (opcional)
  router.post('/request-password-reset', async (req, res) => {
    res.json({ message: 'Reset de contraseña - por implementar' })
  })
  
  // Resetear contraseña (opcional)
  router.post('/reset-password', async (req, res) => {
    res.json({ message: 'Reset de contraseña - por implementar' })
  })
  
  return router
}

export default router