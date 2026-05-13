// test-db.js
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    console.log('Conectando a DB...')
    await prisma.$connect()
    console.log('✅ Conectado')
    
    console.log('Modelos disponibles:', Object.keys(prisma).filter(k => !k.startsWith('$')))
    
    console.log('Probando count...')
    const count = await prisma.tUsuarios.count()
    console.log('✅ Count exitoso:', count)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()