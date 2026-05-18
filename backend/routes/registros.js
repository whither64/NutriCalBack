// routes/registros.js
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

export const createRegistrosRoutes = (prisma) => {

  // ==================== RUTAS PROTEGIDAS (requieren token) ====================

  // POST /api/registros - Crear nuevo registro diario
  router.post('/', verificarToken, async (req, res) => {
    const { fecha, calorias_consumidas } = req.body
    
    // Validaciones
    if (!fecha || calorias_consumidas === undefined) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        required: ['fecha', 'calorias_consumidas']
      })
    }
    
    try {
      // Verificar si ya existe un registro para esa fecha
      const fechaObj = new Date(fecha)
      fechaObj.setHours(0, 0, 0, 0)
      
      const registroExistente = await prisma.tRegistroDiario.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: fechaObj
        }
      })
      
      if (registroExistente) {
        return res.status(400).json({ 
          error: 'Ya existe un registro para esta fecha',
          registro_existente: registroExistente
        })
      }
      
      const nuevoRegistro = await prisma.tRegistroDiario.create({
        data: {
          id_usuario: req.usuario.id_usuario,
          fecha: fechaObj,
          calorias_consumidas: parseInt(calorias_consumidas)
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
        message: 'Registro diario creado exitosamente',
        data: nuevoRegistro
      })
      
    } catch (error) {
      console.error('Error al crear registro:', error)
      res.status(500).json({ error: 'Error al crear registro', details: error.message })
    }
  })

  // GET /api/registros/hoy - Obtener registro del día actual
  router.get('/hoy', verificarToken, async (req, res) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const registroHoy = await prisma.tRegistroDiario.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: hoy
        }
      })
      
      // Obtener plan activo para mostrar meta de calorías
      const planActivo = await prisma.tPlanAlim.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha_inicio: { lte: hoy },
          fecha_fin: { gte: hoy }
        }
      })
      
      res.json({
        success: true,
        data: {
          registro: registroHoy || null,
          meta_calorias: planActivo?.calorias_diarias || null,
          porcentaje: registroHoy && planActivo 
            ? Math.round((registroHoy.calorias_consumidas / planActivo.calorias_diarias) * 100)
            : null
        }
      })
      
    } catch (error) {
      console.error('Error al obtener registro de hoy:', error)
      res.status(500).json({ error: 'Error al obtener registro', details: error.message })
    }
  })

  // GET /api/registros/semana - Obtener registros de la última semana
  router.get('/semana', verificarToken, async (req, res) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const hace7Dias = new Date(hoy)
      hace7Dias.setDate(hace7Dias.getDate() - 7)
      
      const registros = await prisma.tRegistroDiario.findMany({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: {
            gte: hace7Dias,
            lte: hoy
          }
        },
        orderBy: {
          fecha: 'asc'
        }
      })
      
      // Calcular total de calorías de la semana
      const totalCalorias = registros.reduce((sum, reg) => sum + reg.calorias_consumidas, 0)
      const promedioDiario = registros.length > 0 ? Math.round(totalCalorias / registros.length) : 0
      
      res.json({
        success: true,
        data: {
          registros,
          resumen: {
            total_dias: registros.length,
            total_calorias: totalCalorias,
            promedio_diario: promedioDiario,
            desde: hace7Dias,
            hasta: hoy
          }
        }
      })
      
    } catch (error) {
      console.error('Error al obtener registros de la semana:', error)
      res.status(500).json({ error: 'Error al obtener registros', details: error.message })
    }
  })

  // GET /api/registros/mes - Obtener registros del mes actual
  router.get('/mes', verificarToken, async (req, res) => {
    try {
      const hoy = new Date()
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      
      const registros = await prisma.tRegistroDiario.findMany({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: {
            gte: inicioMes,
            lte: finMes
          }
        },
        orderBy: {
          fecha: 'asc'
        }
      })
      
      // Calcular estadísticas del mes
      const totalCalorias = registros.reduce((sum, reg) => sum + reg.calorias_consumidas, 0)
      const diasRegistrados = registros.length
      const promedioDiario = diasRegistrados > 0 ? Math.round(totalCalorias / diasRegistrados) : 0
      
      res.json({
        success: true,
        data: {
          registros,
          resumen: {
            mes: hoy.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
            total_dias_registrados: diasRegistrados,
            total_dias_mes: finMes.getDate(),
            total_calorias: totalCalorias,
            promedio_diario: promedioDiario
          }
        }
      })
      
    } catch (error) {
      console.error('Error al obtener registros del mes:', error)
      res.status(500).json({ error: 'Error al obtener registros', details: error.message })
    }
  })

  // GET /api/registros/fecha/:fecha - Obtener registro por fecha específica
  router.get('/fecha/:fecha', verificarToken, async (req, res) => {
    const { fecha } = req.params
    
    try {
      const fechaObj = new Date(fecha)
      fechaObj.setHours(0, 0, 0, 0)
      
      const registro = await prisma.tRegistroDiario.findFirst({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: fechaObj
        }
      })
      
      res.json({
        success: true,
        data: registro || null
      })
      
    } catch (error) {
      console.error('Error al obtener registro por fecha:', error)
      res.status(500).json({ error: 'Error al obtener registro', details: error.message })
    }
  })

  // GET /api/registros/rango/:inicio/:fin - Obtener registros en rango de fechas
  router.get('/rango/:inicio/:fin', verificarToken, async (req, res) => {
    const { inicio, fin } = req.params
    
    try {
      const fechaInicio = new Date(inicio)
      fechaInicio.setHours(0, 0, 0, 0)
      
      const fechaFin = new Date(fin)
      fechaFin.setHours(23, 59, 59, 999)
      
      const registros = await prisma.tRegistroDiario.findMany({
        where: {
          id_usuario: req.usuario.id_usuario,
          fecha: {
            gte: fechaInicio,
            lte: fechaFin
          }
        },
        orderBy: {
          fecha: 'asc'
        }
      })
      
      const totalCalorias = registros.reduce((sum, reg) => sum + reg.calorias_consumidas, 0)
      
      res.json({
        success: true,
        data: {
          registros,
          resumen: {
            desde: fechaInicio,
            hasta: fechaFin,
            total_dias: registros.length,
            total_calorias: totalCalorias,
            promedio_diario: registros.length > 0 ? Math.round(totalCalorias / registros.length) : 0
          }
        }
      })
      
    } catch (error) {
      console.error('Error al obtener registros por rango:', error)
      res.status(500).json({ error: 'Error al obtener registros', details: error.message })
    }
  })

  // PUT /api/registros/:id - Actualizar registro
  router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    const { fecha, calorias_consumidas } = req.body
    
    try {
      // Verificar que el registro existe y pertenece al usuario
      const registroExistente = await prisma.tRegistroDiario.findFirst({
        where: {
          id_registro: parseInt(id),
          id_usuario: req.usuario.id_usuario
        }
      })
      
      if (!registroExistente) {
        return res.status(404).json({ error: 'Registro no encontrado' })
      }
      
      const registroActualizado = await prisma.tRegistroDiario.update({
        where: { id_registro: parseInt(id) },
        data: {
          fecha: fecha ? new Date(fecha) : registroExistente.fecha,
          calorias_consumidas: calorias_consumidas !== undefined 
            ? parseInt(calorias_consumidas) 
            : registroExistente.calorias_consumidas
        }
      })
      
      res.json({
        success: true,
        message: 'Registro actualizado exitosamente',
        data: registroActualizado
      })
      
    } catch (error) {
      console.error('Error al actualizar registro:', error)
      res.status(500).json({ error: 'Error al actualizar registro', details: error.message })
    }
  })

  // DELETE /api/registros/:id - Eliminar registro
  router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params
    
    try {
      const registroExistente = await prisma.tRegistroDiario.findFirst({
        where: {
          id_registro: parseInt(id),
          id_usuario: req.usuario.id_usuario
        }
      })
      
      if (!registroExistente) {
        return res.status(404).json({ error: 'Registro no encontrado' })
      }
      
      await prisma.tRegistroDiario.delete({
        where: { id_registro: parseInt(id) }
      })
      
      res.json({
        success: true,
        message: 'Registro eliminado exitosamente'
      })
      
    } catch (error) {
      console.error('Error al eliminar registro:', error)
      res.status(500).json({ error: 'Error al eliminar registro', details: error.message })
    }
  })

  // GET /api/registros/estadisticas/resumen - Estadísticas completas del usuario
  router.get('/estadisticas/resumen', verificarToken, async (req, res) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const inicioSemana = new Date(hoy)
      inicioSemana.setDate(hoy.getDate() - hoy.getDay())
      inicioSemana.setHours(0, 0, 0, 0)
      
      const [
        totalRegistros,
        registroHoy,
        totalCaloriasSemana,
        totalCaloriasMes,
        mejorDia,
        peorDia
      ] = await Promise.all([
        prisma.tRegistroDiario.count({
          where: { id_usuario: req.usuario.id_usuario }
        }),
        prisma.tRegistroDiario.findFirst({
          where: {
            id_usuario: req.usuario.id_usuario,
            fecha: hoy
          }
        }),
        prisma.tRegistroDiario.aggregate({
          where: {
            id_usuario: req.usuario.id_usuario,
            fecha: { gte: inicioSemana }
          },
          _sum: { calorias_consumidas: true }
        }),
        prisma.tRegistroDiario.aggregate({
          where: {
            id_usuario: req.usuario.id_usuario,
            fecha: { gte: inicioMes }
          },
          _sum: { calorias_consumidas: true }
        }),
        prisma.tRegistroDiario.findFirst({
          where: { id_usuario: req.usuario.id_usuario },
          orderBy: { calorias_consumidas: 'desc' }
        }),
        prisma.tRegistroDiario.findFirst({
          where: { id_usuario: req.usuario.id_usuario },
          orderBy: { calorias_consumidas: 'asc' }
        })
      ])
      
      res.json({
        success: true,
        estadisticas: {
          total_registros: totalRegistros,
          registro_hoy: registroHoy || null,
          semana_actual: {
            total_calorias: totalCaloriasSemana._sum.calorias_consumidas || 0
          },
          mes_actual: {
            total_calorias: totalCaloriasMes._sum.calorias_consumidas || 0
          },
          mejor_dia: mejorDia,
          peor_dia: peorDia
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