const express = require('express');
const { Pool } = require('pg');
const mqtt = require('mqtt');
require('dotenv').config();

const app = express();
const port = 3000;
app.use(express.json());

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// MQTT Client Setup
const mqttClient = mqtt.connect(process.env.MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('smartpark/parking-status');
});

mqttClient.on('message', async (topic, message) => {
    const data = JSON.parse(message.toString());
    const { parking_lot_id, distance } = data;
    const status = distance < 20 ? 'full' : 'available';

    await pool.query(
        'UPDATE parking_lots SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, parking_lot_id]
    );
    console.log(`Updated parking lot ${parking_lot_id} to status: ${status}`);
});

// API Endpoints
app.get('/parking-status', async (req, res) => {
    const result = await pool.query('SELECT * FROM parking_lots');
    res.json(result.rows);
});

app.post('/add-parking', async (req, res) => {
    const { parking_lot_id, status } = req.body;
    await pool.query(
        'INSERT INTO parking_lots (id, status, updated_at) VALUES ($1, $2, NOW())',
        [parking_lot_id, status]
    );
    res.json({ message: 'Data parkir berhasil ditambahkan', parking_lot_id });
});

app.put('/update-parking', async (req, res) => {
    const { parking_lot_id, status } = req.body;
    await pool.query(
        'UPDATE parking_lots SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, parking_lot_id]
    );
    res.json({ message: 'Data parkir berhasil diperbarui', parking_lot_id });
});

app.delete('/delete-parking', async (req, res) => {
    const { parking_lot_id } = req.body;
    await pool.query('DELETE FROM parking_lots WHERE id = $1', [parking_lot_id]);
    res.json({ message: 'Data parkir berhasil dihapus', parking_lot_id });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
