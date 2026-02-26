-- Crear la base de datos, comprobar si exite antes de crearla para evitar problemas
SELECT 'CREATE DATABASE nutrical'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nutrical')\gexec

-- Connectarse con la bd
\c nutrical;

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tablas de recetas
CREATE TABLE IF NOT EXISTS foods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    calories DECIMAL(10, 2) NOT NULL,
    protein DECIMAL(10, 2) NOT NULL,
    carbs DECIMAL(10, 2) NOT NULL,
    fat DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de demostracion, para probar si funciona
INSERT INTO foods (name, calories, protein, carbs, fat) VALUES
    ('Manzana', 52, 0.3, 14, 0.2),
    ('Pechuga de Pollo', 165, 31, 0, 3.6),
    ('Arroz Integral', 111, 2.6, 23, 0.9),
    ('Huevo', 155, 13, 1.1, 11),
    ('Banana', 89, 1.1, 23, 0.3);
