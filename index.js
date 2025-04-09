const express = require('express');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs'); // Nueva librería
const app = express();
const port = 8000;

const dbConfig = {
    host: 'localhost',
    user: 'resturante_user',
    password: 'Rest@1234emp',
    database: 'restaurante_empresa'
};

app.use(express.json());

// Endpoint existente para verificar cédula
app.get('/verificar-cedula', async (req, res) => {
    const cedula = req.query.cedula;
    if (!cedula) {
        return res.status(400).json({ error: 'Debes proporcionar una cédula' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [usuarios] = await connection.execute(
            'SELECT id, nombre FROM usuarios WHERE cedula = ? AND estado = "activo"',
            [cedula]
        );

        if (usuarios.length === 0) {
            await connection.end();
            return res.json({ existe: false, mensaje: 'Cédula no registrada o inactiva' });
        }

        const usuario = usuarios[0];
        const [validaciones] = await connection.execute(
            'SELECT COUNT(*) as count FROM validaciones WHERE cedula = ? AND DATE(fecha_validacion) = DATE(NOW()) AND resultado = "exitoso"',
            [cedula]
        );

        if (validaciones[0].count > 0) {
            await connection.end();
            return res.json({ existe: true, mensaje: 'Ya almorzaste hoy' });
        }

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

// Nuevo endpoint para generar el reporte en Excel
// Nuevo endpoint para generar el reporte en Excel (todos los registros)
// Nuevo endpoint para generar el reporte en Excel (todos los registros)
app.get('/generar-reporte', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            'SELECT u.cedula, u.nombre, v.fecha_validacion ' +
            'FROM validaciones v ' +
            'JOIN usuarios u ON v.usuario_id = u.id ' +
            'WHERE v.resultado = "exitoso" ' + // Sin restricción de fecha
            'ORDER BY v.fecha_validacion'
        );
        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No hay registros para generar el reporte' });
        }

        // Crear el archivo Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Almuerzos');

        worksheet.columns = [
            { header: 'Cédula', key: 'cedula', width: 15 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Fecha y Hora', key: 'fecha_validacion', width: 25 }
        ];

        worksheet.addRows(rows);

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="reporte_almuerzos_completo.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error al generar el reporte' });
    }
});

app.listen(port, () => {
    console.log(`API corriendo en http://localhost:${port}`);
});