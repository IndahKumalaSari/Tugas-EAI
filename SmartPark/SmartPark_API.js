const express = require('express');
const { Client } = require('pg');
const mqtt = require('mqtt');

require('dotenv').config();

const app = express();
const PORT = 3000;

// Konfigurasi koneksi ke PostgreSQL
const db = new Client({
    user: process.env.DB_USER,
    host: 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: 5432,
});

db.connect()
    .then(() => console.log('✅ Connected to PostgreSQL'))
    .catch(err => console.error('❌ Connection error', err));

// Endpoint test
app.get('/', (req, res) => {
    res.send('🚀 SmartPark API is running!');
});

// Menjalankan server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});

// Konfigurasi MQTT
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const topic = 'smartpark/data';

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe(topic);
});

mqttClient.on('message', async (topic, message) => {
  const data = JSON.parse(message.toString());
  const { slot_id, distance, status } = data;
  
  if (!slot_id || distance === undefined || !status) {
    console.error('Invalid sensor data received');
    return;
  }

  try {
    await db.query(
      'INSERT INTO parking_slots (slot_id, distance, status, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (slot_id) DO UPDATE SET distance = $2, status = $3, updated_at = NOW()',
      [slot_id, distance, status]
    );
    console.log('Data updated successfully');
  } catch (err) {
    console.error('Database error:', err);
  }
});

// API untuk mendapatkan status parkir
app.get('/parking-status', async (req, res) => {
    try {
      const { slot_id } = req.query;
      let result;
  
      if (slot_id) {
        result = await db.query('SELECT * FROM parking_slots WHERE slot_id = $1', [slot_id]);
      } else {
        result = await db.query('SELECT * FROM parking_slots');
      }
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No parking data found' });
      }
  
      res.json(result.rows);
    } catch (err) {
      console.error('Database error:', err);  // Tambahkan logging ini
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  });
  