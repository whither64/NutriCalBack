// routes/planes.js
import express from 'express'
import jwt from 'jsonwebtoken'

const router = express.Router()

// Middleware para verificar token
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' })
  }
  
  const token = authHeader.split(' ')[1]
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi-secreto-temporal-12345')
    req.usuario = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

export const createPlanesRoutes = (prisma) => {

  // ==================== RUTAS PROTEGIDAS (requieren token) ====================

  // POST /api/planes - Crear un nuevo plan alimenticio
  router.post('/', verificarToken, async (req, res) => {
    const { calorias_diarias, fecha_inicio, fecha_fin } = req.body
    
    // Validaciones
    if (!calorias_diarias || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        required: ['calorias_diarias', 'fecha_inicio', 'fecha_fin']
      })
    }
    
    try {
      // Verificar si el usuario ya tiene un plan activo en esas fechas
      const planExistente = await prisma.tPlanAlim.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          OR: [
            {
              AND: [
                { fecha_inicio: { lte: new Date(fecha_fin) } },
                { fecha_fin: { gte: new Date(fecha_inicio) } }
              ]
            }
          ]
        }
      })
      
      if (planExistente) {
        return res.status(400).json({ 
          error: 'Ya tienes un plan activo en ese período de fechas',
          plan_existente: planExistente
        })
      }
      
      const nuevoPlan = await prisma.tPlanAlim.create({
        data: {
          id_usuario: req.usuario.id_usuario,
          calorias_diarias: parseInt(calorias_diarias),
          fecha_inicio: new Date(fecha_inicio),
          fecha_fin: new Date(fecha_fin)
        },
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              correo: true
            }
          }
        }
      })
      
      res.status(201).json({
        success: true,
        message: 'Plan alimenticio creado exitosamente',
        data: nuevoPlan
      })
      
    } catch (error) {
      console.error('Error al crear plan:', error)
      res.status(500).json({ error: 'Error al crear plan', details: error.message })
    }
  })

  // GET /api/planes/mis-planes - Obtener todos los planes del usuario autenticado
  router.get('/mis-planes', verificarToken, async (req, res) => {
    try {
      const planes = await prisma.tPlanAlim.findMany({
        where: { id_usuario: req.usuario.id_usuario },
        orderBy: { fecha_inicio: 'desc' }
      })
      
      res.json({
        success: true,
        count: planes.length,
        data: planes
      })
    } catch (error) {
      console.error('Error al obtener planes:', error)
      res.status(500).json({ error: 'Error al obtener planes', details: error.message })
    }
  })

  // GET /api/planes/activo - Obtener plan activo (fecha actual dentro del rango)
  router.get('/activo', verificarToken, async (req, res) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const planActivo = await prisma.tPlanAlim.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha_inicio: { lte: hoy },
          fecha_fin: { gte: hoy }
        }
      })
      
      if (!planActivo) {
        return res.status(404).json({ 
          success: false,
          message: 'No tienes un plan activo actualmente' 
        })
      }
      
      res.json({
        success: true,
        data: planActivo
      })
      
    } catch (error) {
      console.error('Error al obtener plan activo:', error)
      res.status(500).json({ error: 'Error al obtener plan activo', details: error.message })
    }
  })

  // GET /api/planes/:id - Obtener plan por ID (solo si pertenece al usuario)
  router.get('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    
    try {
      const plan = await prisma.tPlanAlim.findFirst({
        where: {
          id_plan: parseInt(id),
          id_usuario: req.usuario.id_usuario
        },
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              correo: true
            }
          }
        }
      })
      
      if (!plan) {
        return res.status(404).json({ error: 'Plan no encontrado' })
      }
      
      res.json({
        success: true,
        data: plan
      })
      
    } catch (error) {
      console.error('Error al obtener plan:', error)
      res.status(500).json({ error: 'Error al obtener plan', details: error.message })
    }
  })

  // PUT /api/planes/:id - Actualizar plan existente
  router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    const { calorias_diarias, fecha_inicio, fecha_fin } = req.body
    
    try {
      // Verificar que el plan existe y pertenece al usuario
      const planExistente = await prisma.tPlanAlim.findFirst({
        where: {
          id_plan: parseInt(id),
          id_usuario: req.usuario.id_usuario
        }
      })
      
      if (!planExistente) {
        return res.status(404).json({ error: 'Plan no encontrado' })
      }
      
      const planActualizado = await prisma.tPlanAlim.update({
        where: { id_plan: parseInt(id) },
        data: {
          calorias_diarias: calorias_diarias !== undefined ? parseInt(calorias_diarias) : planExistente.calorias_diarias,
          fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : planExistente.fecha_inicio,
          fecha_fin: fecha_fin ? new Date(fecha_fin) : planExistente.fecha_fin
        }
      })
      
      res.json({
        success: true,
        message: 'Plan actualizado exitosamente',
        data: planActualizado
      })
      
    } catch (error) {
      console.error('Error al actualizar plan:', error)
      res.status(500).json({ error: 'Error al actualizar plan', details: error.message })
    }
  })

  // DELETE /api/planes/:id - Eliminar plan
  router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    
    try {
      const planExistente = await prisma.tPlanAlim.findFirst({
        where: {
          id_plan: parseInt(id),
          id_usuario: req.usuario.id_usuario
        }
      })
      
      if (!planExistente) {
        return res.status(404).json({ error: 'Plan no encontrado' })
      }
      
      await prisma.tPlanAlim.delete({
        where: { id_plan: parseInt(id) }
      })
      
      res.json({
        success: true,
        message: 'Plan eliminado exitosamente'
      })
      
    } catch (error) {
      console.error('Error al eliminar plan:', error)
      res.status(500).json({ error: 'Error al eliminar plan', details: error.message })
    }
  })

  // GET /api/planes/estadisticas/resumen - Estadísticas de planes del usuario
  router.get('/estadisticas/resumen', verificarToken, async (req, res) => {
    try {
      const [totalPlanes, promedioCalorias, planMaxCalorias, planMinCalorias] = await Promise.all([
        prisma.tPlanAlim.count({
          where: { id_usuario: req.usuario.id_usuario }
        }),
        prisma.tPlanAlim.aggregate({
          where: { id_usuario: req.usuario.id_usuario },
          _avg: { calorias_diarias: true }
        }),
        prisma.tPlanAlim.findFirst({
          where: { id_usuario: req.usuario.id_usuario },
          orderBy: { calorias_diarias: 'desc' }
        }),
        prisma.tPlanAlim.findFirst({
          where: { id_usuario: req.usuario.id_usuario },
          orderBy: { calorias_diarias: 'asc' }
        })
      ])
      
      res.json({
        success: true,
        estadisticas: {
          total_planes: totalPlanes,
          calorias_promedio: Math.round(promedioCalorias._avg.calorias_diarias || 0),
          plan_mayor_calorias: planMaxCalorias,
          plan_menor_calorias: planMinCalorias
        }
      })
      
    } catch (error) {
      console.error('Error al obtener estadísticas:', error)
      res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message })
    }
  })

  return router
}

export default router