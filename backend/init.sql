-- Crear la base de datos, comprobar si exite antes de crearla para evitar problemas
SELECT 'CREATE DATABASE nutrical'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nutrical')\gexec

-- Connectarse con la bd
\c nutrical;
-- aqui solo se crean los esquemas, extenciones y funciones, las tablas se crean con prisma migrate
-- ejemplo:

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ya no se crean las tablas aqui