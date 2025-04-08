const express = require('express');
const mysql = require('mysql2/promise'); // Usamos mysql2 con promesas para async/await
const app = express();
const port = 8000; // Puerto donde correrá la API

// Configuración de la conexión a MySQL
const dbConfig = {
    host: 'localhost',           // IP del servidor local (o '127.0.0.1')
    user: 'root',            // Usuario de MySQL que creaste
    password: '', // Contraseña del usuario
    database: 'restaurante_empresa' // Nombre de la base de datos
};

// Middleware para parsear JSON (si envías datos en formato JSON)
app.use(express.json());

// Endpoint para verificar una cédula
app.get('/verificar-cedula', async (req, res) => {
    const cedula = req.query.cedula; // Obtener la cédula desde los parámetros de la URL

    if (!cedula) {
        return res.status(400).json({ error: 'Debes proporcionar una cédula' });
    }

    try {
        // Conectar a la base de datos
        const connection = await mysql.createConnection(dbConfig);

        // Verificar si la cédula existe y está activa
        const [usuarios] = await connection.execute(
            'SELECT id, nombre FROM usuarios WHERE cedula = ? AND estado = "activo"',
            [cedula]
        );

        if (usuarios.length === 0) {
            await connection.end();
            return res.json({ existe: false, mensaje: 'Cédula no registrada o inactiva' });
        }

        const usuario = usuarios[0];

        // Verificar si ya almorzó hoy
        const [validaciones] = await connection.execute(
            'SELECT COUNT(*) as count FROM validaciones WHERE cedula = ? AND DATE(fecha_validacion) = DATE(NOW()) AND resultado = "exitoso"',
            [cedula]
        );

        if (validaciones[0].count > 0) {
            await connection.end();
            return res.json({ existe: true, mensaje: 'Ya almorzaste hoy' });
        }

        // Registrar la validación exitosa
        await connection.execute(
            'INSERT INTO validaciones (usuario_id, cedula, resultado) VALUES (?, ?, "exitoso")',
            [usuario.id, cedula]
        );

        await connection.end();
        return res.json({ existe: true, mensaje: `Bienvenido, ${usuario.nombre}, puedes almorzar` });

    } catch (error) {
        console.error('Error en la API:', error);
        return res.status(500).json({ error: 'Error en el servidor' });
    }
});

// (Opcional) Endpoint para consultar el historial de validaciones
app.get('/historial', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            'SELECT v.cedula, u.nombre, v.fecha_validacion, v.resultado FROM validaciones v JOIN usuarios u ON v.usuario_id = u.id ORDER BY v.fecha_validacion DESC'
        );
        await connection.end();
        return res.json(rows);
    } catch (error) {
        console.error('Error en la API:', error);
        return res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`API corriendo en http://localhost:${port}`);
});