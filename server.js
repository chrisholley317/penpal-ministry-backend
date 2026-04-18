const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(() => console.log('Connected to Railway PostgreSQL'))
  .catch(err => console.error('Database connection error:', err));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/api/volunteers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM volunteers ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

app.post('/api/volunteers', async (req, res) => {
  try {
    const { name, email, country, age } = req.body;
    
    const result = await pool.query(
      'INSERT INTO volunteers (name, email, country, age) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, country, age]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({ error: 'Failed to create volunteer' });
  }
});

app.get('/api/waiting-inmates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM waiting_inmates ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inmates:', error);
    res.status(500).json({ error: 'Failed to fetch inmates' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Ministry Platform running on port ' + PORT);
});

module.exports = app;
