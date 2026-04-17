const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:cRoFRTacDJYaXqkDbSvfhcjGIxrVzKSB@postgres.railway.internal:5432/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Jeff\'s Second Family PenPal Ministry API',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Jeff's Second Family Ministry API running on port ${port}`);
});
