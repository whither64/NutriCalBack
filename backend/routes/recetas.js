// routes/recetas.js
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

export const createRecetasRoutes = (prisma) => {

  // ==================== RUTAS PÚBLICAS ====================

  // GET /api/recetas - Obtener todas las recetas
  router.get('/', async (req, res) => {
    try {
      const recetas = await prisma.recetas.findMany({
        include: {
          recetaAlimentos: {
            include: {
              alimento: true  // Incluir los detalles del alimento
            }
          }
        },
        orderBy: {
          id_receta: 'desc'
        }
      })
      
      // Calcular calorías totales por receta
      const recetasConCalorias = recetas.map(receta => {
        const caloriasTotales = receta.recetaAlimentos.reduce((total, item) => {
          return total + (item.alimento.calorias * item.cantidad)
        }, 0)
        
        return {
          ...receta,
          calorias_totales: Math.round(caloriasTotales)
        }
      })
      
      res.json({
        success: true,
        count: recetas.length,
        data: recetasConCalorias
      })
    } catch (error) {
      console.error('Error al obtener recetas:', error)
      res.status(500).json({ error: 'Error al obtener recetas', details: error.message })
    }
  })

  // GET /api/recetas/buscar?q=keyword - Buscar recetas
  router.get('/buscar', async (req, res) => {
    const { q } = req.query
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' })
    }
    
    try {
      const recetas = await prisma.recetas.findMany({
        where: {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
          recetaAlimentos: {
            include: {
              alimento: true
            }
          }
        }
      })
      
      res.json({
        success: true,
        count: recetas.length,
        data: recetas
      })
    } catch (error) {
      console.error('Error en búsqueda:', error)
      res.status(500).json({ error: 'Error en la búsqueda', details: error.message })
    }
  })

  // GET /api/recetas/:id - Obtener receta por ID
  router.get('/:id', async (req, res) => {
    const { id } = req.params
    
    try {
      const receta = await prisma.recetas.findUnique({
        where: { id_receta: parseInt(id) },
        include: {
          recetaAlimentos: {
            include: {
              alimento: true
            }
          }
        }
      })
      
      if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' })
      }
      
      // Calcular calorías totales
      const caloriasTotales = receta.recetaAlimentos.reduce((total, item) => {
        return total + (item.alimento.calorias * item.cantidad)
      }, 0)
      
      res.json({
        success: true,
        data: {
          ...receta,
          calorias_totales: Math.round(caloriasTotales)
        }
      })
    } catch (error) {
      console.error('Error al obtener receta:', error)
      res.status(500).json({ error: 'Error al obtener receta', details: error.message })
    }
  })

  // ==================== RUTAS PROTEGIDAS ====================

  // POST /api/recetas - Crear nueva receta
  router.post('/', verificarToken, async (req, res) => {
    const { 
      nombre, 
      descripcion, 
      tiempo_preparacion, 
      imagen_url,
      ingredientes  // Array de { id_alimento, cantidad }
    } = req.body
    
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la receta es requerido' })
    }
    
    try {
      // Crear la receta
      const nuevaReceta = await prisma.recetas.create({
        data: {
          nombre,
          descripcion: descripcion || '',
          tiempo_preparacion: tiempo_preparacion ? parseInt(tiempo_preparacion) : null,
          imagen_url: imagen_url || null
        }
      })
      
      // Si vienen ingredientes, agregarlos a la relación
      if (ingredientes && ingredientes.length > 0) {
        await prisma.tRecetaAlim.createMany({
          data: ingredientes.map(ing => ({
            id_receta: nuevaReceta.id_receta,
            id_alimento: ing.id_alimento,
            cantidad: ing.cantidad
          }))
        })
      }
      
      // Obtener la receta completa con sus ingredientes
      const recetaCompleta = await prisma.recetas.findUnique({
        where: { id_receta: nuevaReceta.id_receta },
        include: {
          recetaAlimentos: {
            include: {
              alimento: true
            }
          }
        }
      })
      
      res.status(201).json({
        success: true,
        message: 'Receta creada exitosamente',
        data: recetaCompleta
      })
      
    } catch (error) {
      console.error('Error al crear receta:', error)
      res.status(500).json({ error: 'Error al crear receta', details: error.message })
    }
  })

  // PUT /api/recetas/:id - Actualizar receta
  router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    const { nombre, descripcion, tiempo_preparacion, imagen_url } = req.body
    
    try {
      const recetaExistente = await prisma.recetas.findUnique({
        where: { id_receta: parseInt(id) }
      })
      
      if (!recetaExistente) {
        return res.status(404).json({ error: 'Receta no encontrada' })
      }
      
      const recetaActualizada = await prisma.recetas.update({
        where: { id_receta: parseInt(id) },
        data: {
          nombre: nombre || recetaExistente.nombre,
          descripcion: descripcion !== undefined ? descripcion : recetaExistente.descripcion,
          tiempo_preparacion: tiempo_preparacion !== undefined ? parseInt(tiempo_preparacion) : recetaExistente.tiempo_preparacion,
          imagen_url: imagen_url !== undefined ? imagen_url : recetaExistente.imagen_url
        }
      })
      
      res.json({
        success: true,
        message: 'Receta actualizada exitosamente',
        data: recetaActualizada
      })
      
    } catch (error) {
      console.error('Error al actualizar receta:', error)
      res.status(500).json({ error: 'Error al actualizar receta', details: error.message })
    }
  })

  // DELETE /api/recetas/:id - Eliminar receta
  router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    
    try {
      const recetaExistente = await prisma.recetas.findUnique({
        where: { id_receta: parseInt(id) }
      })
      
      if (!recetaExistente) {
        return res.status(404).json({ error: 'Receta no encontrada' })
      }
      
      // Primero eliminar la relación Receta-Alimento
      await prisma.tRecetaAlim.deleteMany({
        where: { id_receta: parseInt(id) }
      })
      
      // Luego eliminar la receta
      await prisma.recetas.delete({
        where: { id_receta: parseInt(id) }
      })
      
      res.json({
        success: true,
        message: 'Receta eliminada exitosamente'
      })
      
    } catch (error) {
      console.error('Error al eliminar receta:', error)
      res.status(500).json({ error: 'Error al eliminar receta', details: error.message })
    }
  })

  // ==================== RUTAS PARA MANEJAR INGREDIENTES ====================

  // POST /api/recetas/:id/ingredientes - Agregar ingrediente a receta
  router.post('/:id/ingredientes', verificarToken, async (req, res) => {
    const { id } = req.params
    const { id_alimento, cantidad } = req.body
    
    if (!id_alimento || !cantidad) {
      return res.status(400).json({ error: 'id_alimento y cantidad son requeridos' })
    }
    
    try {
      // Verificar que la receta existe
      const receta = await prisma.recetas.findUnique({
        where: { id_receta: parseInt(id) }
      })
      
      if (!receta) {
        return res.status(404).json({ error: 'Receta no encontrada' })
      }
      
      // Verificar que el alimento existe
      const alimento = await prisma.tAlimentos.findUnique({
        where: { id_alimento: parseInt(id_alimento) }
      })
      
      if (!alimento) {
        return res.status(404).json({ error: 'Alimento no encontrado' })
      }
      
      // Crear la relación
      const ingrediente = await prisma.tRecetaAlim.create({
        data: {
          id_receta: parseInt(id),
          id_alimento: parseInt(id_alimento),
          cantidad: parseFloat(cantidad)
        },
        include: {
          alimento: true
        }
      })
      
      res.status(201).json({
        success: true,
        message: 'Ingrediente agregado exitosamente',
        data: ingrediente
      })
      
    } catch (error) {
      console.error('Error al agregar ingrediente:', error)
      res.status(500).json({ error: 'Error al agregar ingrediente', details: error.message })
    }
  })

  // PUT /api/recetas/:id/ingredientes/:id_alimento - Actualizar cantidad
  router.put('/:id/ingredientes/:id_alimento', verificarToken, async (req, res) => {
    const { id, id_alimento } = req.params
    const { cantidad } = req.body
    
    if (!cantidad) {
      return res.status(400).json({ error: 'La cantidad es requerida' })
    }
    
    try {
      const ingrediente = await prisma.tRecetaAlim.update({
        where: {
          id_receta_id_alimento: {
            id_receta: parseInt(id),
            id_alimento: parseInt(id_alimento)
          }
        },
        data: {
          cantidad: parseFloat(cantidad)
        },
        include: {
          alimento: true
        }
      })
      
      res.json({
        success: true,
        message: 'Cantidad actualizada exitosamente',
        data: ingrediente
      })
      
    } catch (error) {
      console.error('Error al actualizar ingrediente:', error)
      res.status(500).json({ error: 'Error al actualizar ingrediente', details: error.message })
    }
  })

  // DELETE /api/recetas/:id/ingredientes/:id_alimento - Eliminar ingrediente
  router.delete('/:id/ingredientes/:id_alimento', verificarToken, async (req, res) => {
    const { id, id_alimento } = req.params
    
    try {
      await prisma.tRecetaAlim.delete({
        where: {
          id_receta_id_alimento: {
            id_receta: parseInt(id),
            id_alimento: parseInt(id_alimento)
          }
        }
      })
      
      res.json({
        success: true,
        message: 'Ingrediente eliminado exitosamente'
      })
      
    } catch (error) {
      console.error('Error al eliminar ingrediente:', error)
      res.status(500).json({ error: 'Error al eliminar ingrediente', details: error.message })
    }
  })

  return router
}

export default router