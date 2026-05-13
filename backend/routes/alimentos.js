// routes/alimentos.js
import express from 'express'
import jwt from 'jsonwebtoken'

const router = express.Router()

// Middleware para verificar token (para operaciones de admin)
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

export const createAlimentosRoutes = (prisma) => {

  // ==================== RUTAS PÚBLICAS ====================

  // GET /api/alimentos 
  // - Obtener todos los alimentos (con paginación)
  router.get('/', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const skip = (page - 1) * limit
      
      const [alimentos, total] = await Promise.all([
        prisma.tAlimentos.findMany({
          skip,
          take: limit,
          orderBy: {
            nombre: 'asc'
          }
        }),
        prisma.tAlimentos.count()
      ])
      
      res.json({
        success: true,
        data: alimentos,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Error al obtener alimentos:', error)
      res.status(500).json({ error: 'Error al obtener alimentos', details: error.message })
    }
  })

  // GET /api/alimentos/buscar?q=keyword 
  // - Buscar alimentos
  router.get('/buscar', async (req, res) => {
    const { q } = req.query
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' })
    }
    
    try {
      const alimentos = await prisma.tAlimentos.findMany({
        where: {
          nombre: {
            contains: q,
            mode: 'insensitive' // Búsqueda case-insensitive
          }
        },
        orderBy: {
          nombre: 'asc'
        },
        take: 50
      })
      
      res.json({
        success: true,
        count: alimentos.length,
        data: alimentos
      })
    } catch (error) {
      console.error('Error en búsqueda:', error)
      res.status(500).json({ error: 'Error en la búsqueda', details: error.message })
    }
  })

  // GET /api/alimentos/calorias/:rango 
  // - Filtrar por rango de calorías
  router.get('/calorias/:rango', async (req, res) => {
    const { rango } = req.params
    
    let whereCondition = {}
    
    switch(rango) {
      case 'bajo':
        whereCondition = { calorias: { lt: 50 } }
        break
      case 'medio':
        whereCondition = { calorias: { gte: 50, lte: 150 } }
        break
      case 'alto':
        whereCondition = { calorias: { gt: 150 } }
        break
      default:
        return res.status(400).json({ error: 'Rango inválido. Usa: bajo, medio, alto' })
    }
    
    try {
      const alimentos = await prisma.tAlimentos.findMany({
        where: whereCondition,
        orderBy: {
          calorias: 'asc'
        }
      })
      
      res.json({
        success: true,
        count: alimentos.length,
        data: alimentos
      })
    } catch (error) {
      console.error('Error al filtrar por calorías:', error)
      res.status(500).json({ error: 'Error al filtrar alimentos', details: error.message })
    }
  })
    // GET /api/alimentos/:id 
  // - Obtener alimento por ID
  router.get('/:id', async (req, res) => {
    const { id } = req.params
    
    try {
      const alimento = await prisma.tAlimentos.findUnique({
        where: { id_alimento: parseInt(id) }
      })
      
      if (!alimento) {
        return res.status(404).json({ error: 'Alimento no encontrado' })
      }
      
      res.json({
        success: true,
        data: alimento
      })
    } catch (error) {
      console.error('Error al obtener alimento:', error)
      res.status(500).json({ error: 'Error al obtener alimento', details: error.message })
    }
  })

  // ==================== RUTAS PROTEGIDAS (ADMIN) ====================

  // POST /api/alimentos 
  // - Crear nuevo alimento (requiere autenticación)
  router.post('/', verificarToken, async (req, res) => {
    const { nombre, calorias, proteinas, carbohidratos, grasas } = req.body
    
    // Validaciones
    if (!nombre || calorias === undefined) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        required: ['nombre', 'calorias']
      })
    }
    
    try {
      // Verificar si ya existe un alimento con el mismo nombre
      const existeAlimento = await prisma.tAlimentos.findFirst({
        where: {
          nombre: {
            equals: nombre,
            mode: 'insensitive'
          }
        }
      })
      
      if (existeAlimento) {
        return res.status(400).json({ error: 'Ya existe un alimento con ese nombre' })
      }
      
      const nuevoAlimento = await prisma.tAlimentos.create({
        data: {
          nombre,
          calorias: parseFloat(calorias),
          proteinas: proteinas ? parseFloat(proteinas) : 0,
          carbohidratos: carbohidratos ? parseFloat(carbohidratos) : 0,
          grasas: grasas ? parseFloat(grasas) : 0
        }
      })
      
      res.status(201).json({
        success: true,
        message: 'Alimento creado exitosamente',
        data: nuevoAlimento
      })
      
    } catch (error) {
      console.error('Error al crear alimento:', error)
      res.status(500).json({ error: 'Error al crear alimento', details: error.message })
    }
  })

  // PUT /api/alimentos/:id 
  // - Actualizar alimento (requiere autenticación)
  router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    const { nombre, calorias, proteinas, carbohidratos, grasas } = req.body
    
    try {
      // Verificar si el alimento existe
      const alimentoExistente = await prisma.tAlimentos.findUnique({
        where: { id_alimento: parseInt(id) }
      })
      
      if (!alimentoExistente) {
        return res.status(404).json({ error: 'Alimento no encontrado' })
      }
      
      // Si se actualiza el nombre, verificar que no exista otro con el mismo nombre
      if (nombre && nombre !== alimentoExistente.nombre) {
        const duplicado = await prisma.tAlimentos.findFirst({
          where: {
            nombre: {
              equals: nombre,
              mode: 'insensitive'
            },
            id_alimento: { not: parseInt(id) }
          }
        })
        
        if (duplicado) {
          return res.status(400).json({ error: 'Ya existe otro alimento con ese nombre' })
        }
      }
      
      const alimentoActualizado = await prisma.tAlimentos.update({
        where: { id_alimento: parseInt(id) },
        data: {
          nombre: nombre || alimentoExistente.nombre,
          calorias: calorias !== undefined ? parseFloat(calorias) : alimentoExistente.calorias,
          proteinas: proteinas !== undefined ? parseFloat(proteinas) : alimentoExistente.proteinas,
          carbohidratos: carbohidratos !== undefined ? parseFloat(carbohidratos) : alimentoExistente.carbohidratos,
          grasas: grasas !== undefined ? parseFloat(grasas) : alimentoExistente.grasas
        }
      })
      
      res.json({
        success: true,
        message: 'Alimento actualizado exitosamente',
        data: alimentoActualizado
      })
      
    } catch (error) {
      console.error('Error al actualizar alimento:', error)
      res.status(500).json({ error: 'Error al actualizar alimento', details: error.message })
    }
  })

  // DELETE /api/alimentos/:id 
  // - Eliminar alimento (requiere autenticación)
  router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    
    try {
      // Verificar si el alimento existe
      const alimentoExistente = await prisma.tAlimentos.findUnique({
        where: { id_alimento: parseInt(id) },
        include: {
          recetaAlimentos: true // Verificar si está siendo usado en recetas
        }
      })
      
      if (!alimentoExistente) {
        return res.status(404).json({ error: 'Alimento no encontrado' })
      }
      
      // Verificar si el alimento está siendo usado en alguna receta
      if (alimentoExistente.recetaAlimentos.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar el alimento porque está siendo usado en recetas',
          recetasCount: alimentoExistente.recetaAlimentos.length
        })
      }
      
      await prisma.tAlimentos.delete({
        where: { id_alimento: parseInt(id) }
      })
      
      res.json({
        success: true,
        message: 'Alimento eliminado exitosamente'
      })
      
    } catch (error) {
      console.error('Error al eliminar alimento:', error)
      res.status(500).json({ error: 'Error al eliminar alimento', details: error.message })
    }
  })

  // ==================== RUTA ESTADÍSTICAS ====================
  
  // GET /api/alimentos/estadisticas/resumen 
  // - Obtener estadísticas de alimentos
  router.get('/estadisticas/resumen', async (req, res) => {
    try {
      const [total, promedioCalorias, maxCalorias, minCalorias] = await Promise.all([
        prisma.tAlimentos.count(),
        prisma.tAlimentos.aggregate({
          _avg: { calorias: true }
        }),
        prisma.tAlimentos.aggregate({
          _max: { calorias: true }
        }),
        prisma.tAlimentos.aggregate({
          _min: { calorias: true }
        })
      ])
      
      res.json({
        success: true,
        estadisticas: {
          total_alimentos: total,
          calorias_promedio: Math.round(promedioCalorias._avg.calorias || 0),
          calorias_max: maxCalorias._max.calorias || 0,
          calorias_min: minCalorias._min.calorias || 0
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