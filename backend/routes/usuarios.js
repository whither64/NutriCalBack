// routes/usuarios.js
import express from 'express';

export function createUsuariosRoutes(prisma) {
  const router = express.Router();

  // Debug interno
  router.get('/debug-prisma', (req, res) => {
    if (!prisma) {
      return res.status(500).json({ error: 'prisma no está definido' });
    }
    
    const models = Object.keys(prisma).filter(key => 
      !key.startsWith('$') && 
      !key.startsWith('_') &&
      typeof prisma[key] === 'object'
    );
    
    res.json({
      success: true,
      prismaExists: true,
      availableModels: models,
      hasTUsuarios: models.includes('tUsuarios'),
      hasUser: models.includes('user'),
      message: 'Debug informativo - no se realizó ninguna búsqueda en DB'
    });
  });

  // Test DB mejorado
  router.get('/test-db', async (req, res) => {
    try {
      if (!prisma) {
        return res.status(500).json({ error: 'Prisma no está inicializado' });
      }
      
      // Intentar con el modelo correcto
      let count = null;
      let modelUsed = null;
      
      if (prisma.tUsuarios) {
        count = await prisma.tUsuarios.count();
        modelUsed = 'tUsuarios';
      } else if (prisma.user) {
        count = await prisma.user.count();
        modelUsed = 'user';
      } else {
        const availableModels = Object.keys(prisma).filter(k => 
          !k.startsWith('$') && !k.startsWith('_')
        );
        return res.status(500).json({ 
          error: 'No se encontró un modelo de usuarios',
          availableModels 
        });
      }
      
      res.json({
        success: true,
        message: 'Conexión exitosa',
        userCount: count,
        modelUsed: modelUsed
      });
      
    } catch (error) {
      console.error('Error en test-db:', error);
      res.status(500).json({ 
        error: 'Error en prueba de DB', 
        details: error.message 
      });
    }
  });

  // Crear usuario
  router.post('/', async (req, res) => {
    const { nombre, correo, contraseña, edad, peso, estatura, objetivo } = req.body;
    
    if (!nombre || !correo || !contraseña || !edad || !peso || !estatura) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        required: ['nombre', 'correo', 'contraseña', 'edad', 'peso', 'estatura']
      });
    }
    
    try {
      // Verificar si el correo ya existe
      const existeUsuario = await prisma.tUsuarios.findUnique({
        where: { correo }
      });
      
      if (existeUsuario) {
        return res.status(400).json({ error: 'El correo ya está registrado' });
      }
      
      const nuevoUsuario = await prisma.tUsuarios.create({
        data: {
          nombre,
          correo,
          contraseña,
          edad: parseInt(edad),
          peso: parseFloat(peso),
          estatura: parseFloat(estatura),
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
      });
      
      res.status(201).json({
        message: 'Usuario creado exitosamente',
        usuario: nuevoUsuario
      });
      
    } catch (error) {
      console.error('Error en POST /:', error);
      res.status(500).json({ error: 'Error al crear usuario', details: error.message });
    }
  });

    // Obtener todos los usuarios
  router.get('/', async (req, res) => {
    try {
      const usuarios = await prisma.tUsuarios.findMany({
        select: {
          id_usuario: true,  // ✅ Usar id_usuario
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
        }
      });
      res.status(200).json(usuarios);
    } catch (error) {
      console.error('Error en GET /:', error);
      res.status(500).json({ error: 'Error al obtener usuarios', details: error.message });
    }
  });

  // Obtener un usuario específico por ID
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const usuario = await prisma.tUsuarios.findUnique({
        where: { id_usuario: parseInt(id) },  // ✅ Usar id_usuario
        select: {
          id_usuario: true,  // ✅ Cambiar id a id_usuario
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
        }
      });
      
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.status(200).json(usuario);
    } catch (error) {
      console.error('Error en GET /:id:', error);
      res.status(500).json({ error: 'Error al obtener usuario', details: error.message });
    }
  });

  // Obtener usuario por correo
  router.get('/email/:correo', async (req, res) => {
    const { correo } = req.params;
    
    try {
      const usuario = await prisma.tUsuarios.findUnique({
        where: { correo },
        select: {
          id_usuario: true,  // ✅ Usar id_usuario
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
        }
      });
      
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.status(200).json(usuario);
    } catch (error) {
      console.error('Error en GET /email/:correo:', error);
      res.status(500).json({ error: 'Error al obtener usuario', details: error.message });
    }
  });

    // Actualizar un usuario
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, contraseña, edad, peso, estatura, objetivo } = req.body;
    
    try {
      const usuarioExistente = await prisma.tUsuarios.findUnique({
        where: { id_usuario: parseInt(id) }  // ✅ Usar id_usuario
      });
      
      if (!usuarioExistente) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Si se actualiza el correo, verificar que no esté en uso
      if (correo && correo !== usuarioExistente.correo) {
        const correoExistente = await prisma.tUsuarios.findUnique({
          where: { correo }
        });
        
        if (correoExistente) {
          return res.status(400).json({ error: 'El correo ya está en uso por otro usuario' });
        }
      }
      
      const usuarioActualizado = await prisma.tUsuarios.update({
        where: { id_usuario: parseInt(id) },  // ✅ Usar id_usuario
        data: {
          nombre: nombre || usuarioExistente.nombre,
          correo: correo || usuarioExistente.correo,
          contraseña: contraseña || usuarioExistente.contraseña,
          edad: edad ? parseInt(edad) : usuarioExistente.edad,
          peso: peso ? parseFloat(peso) : usuarioExistente.peso,
          estatura: estatura ? parseFloat(estatura) : usuarioExistente.estatura,
          objetivo: objetivo !== undefined ? objetivo : usuarioExistente.objetivo
        },
        select: {
          id_usuario: true,  // ✅ Usar id_usuario
          nombre: true,
          correo: true,
          edad: true,
          peso: true,
          estatura: true,
          objetivo: true
        }
      });
      
      res.status(200).json(usuarioActualizado);
    } catch (error) {
      console.error('Error en PUT /:id:', error);
      res.status(500).json({ error: 'Error al actualizar usuario', details: error.message });
    }
  });

  // Eliminar un usuario
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const usuarioExistente = await prisma.tUsuarios.findUnique({
        where: { id_usuario: parseInt(id) }  // ✅ Usar id_usuario
      });
      
      if (!usuarioExistente) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      await prisma.tUsuarios.delete({
        where: { id_usuario: parseInt(id) }  // ✅ Usar id_usuario
      });
      
      res.status(200).json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
      console.error('Error en DELETE /:id:', error);
      res.status(500).json({ error: 'Error al eliminar usuario', details: error.message });
    }
  });

  return router;
}