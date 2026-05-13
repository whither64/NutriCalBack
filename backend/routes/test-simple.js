// test-simple.js
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    console.log('Conectando...')
    await prisma.$connect()
    
    console.log('Modelos:', Object.keys(prisma).filter(k => !k.startsWith('$')))
    
    console.log('Probando tUsuarios...')
    const count = await prisma.tUsuarios.count()
    console.log('Count:', count)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()