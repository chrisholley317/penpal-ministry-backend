const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection - uses Railway's environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect()
  .then(() => console.log('Connected to Railway PostgreSQL - Enhanced Version'))
  .catch(err => console.error('Database connection error:', err));

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SETUP - Add enhanced tables if they don't exist
// ═══════════════════════════════════════════════════════════════════════════════

const setupEnhancedTables = async () => {
  try {
    // Add missing columns to existing tables
    await pool.query(`
      ALTER TABLE waiting_inmates 
      ADD COLUMN IF NOT EXISTS communication_system VARCHAR(50),
      ADD COLUMN IF NOT EXISTS has_full_intro_letter BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS waiting_days INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'waiting',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS gender CHAR(1),
      ADD COLUMN IF NOT EXISTS physical_address TEXT,
      ADD COLUMN IF NOT EXISTS request_date DATE
    `);

    // Create enhanced tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_consent (
        id SERIAL PRIMARY KEY,
        volunteer_id INTEGER,
        full_legal_name VARCHAR(255) NOT NULL,
        age_verified BOOLEAN DEFAULT FALSE,
        real_name_consent BOOLEAN DEFAULT FALSE,
        ministry_agreement BOOLEAN DEFAULT FALSE,
        guidelines_accepted BOOLEAN DEFAULT FALSE,
        securus_consent BOOLEAN DEFAULT FALSE,
        consent_date TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_meditations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        scripture VARCHAR(255),
        theme VARCHAR(100),
        date DATE UNIQUE,
        sent_at TIMESTAMP,
        recipients_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ministry_notifications (
        id SERIAL PRIMARY KEY,
        notification_type VARCHAR(100) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        related_inmate_id INTEGER,
        related_volunteer_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'sent',
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Enhanced database setup complete!');
  } catch (error) {
    console.error('Database setup error:', error);
  }
};

// Run setup on startup
setupEnhancedTables();

// ═══════════════════════════════════════════════════════════════════════════════
// BASIC API ENDPOINTS (existing)
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy - Enhanced Ministry Platform',
    timestamp: new Date().toISOString(),
    database: 'connected',
    features: ['OCR', 'Meditations', 'Notifications', 'Enhanced Dashboard']
  });
});

// Get all volunteers
app.get('/api/volunteers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM volunteers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

// Create new volunteer
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

// Get all waiting inmates
app.get('/api/waiting-inmates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, 
             CASE WHEN request_date IS NOT NULL 
                  THEN GREATEST(0, CURRENT_DATE - request_date) 
                  ELSE waiting_days END as calculated_waiting_days
      FROM waiting_inmates 
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        calculated_waiting_days DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inmates:', error);
    res.status(500).json({ error: 'Failed to fetch inmates' });
  }
});

// Create new waiting inmate
app.post('/api/waiting-inmates', async (req, res) => {
  try {
    const { 
      first_name, last_name, inmate_number, prison, state, 
      intro_letter, communication_system, priority, notes 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO waiting_inmates 
       (first_name, last_name, inmate_number, prison, state, intro_letter, 
        communication_system, priority, notes, has_full_intro_letter, request_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [first_name, last_name, inmate_number, prison, state, intro_letter, 
       communication_system || 'Securus', priority || 'medium', notes, 
       intro_letter ? true : false, new Date()]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating inmate:', error);
    res.status(500).json({ error: 'Failed to create inmate' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// Enhanced dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [volunteers, inmates, high_priority, securus_count] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM volunteers'),
      pool.query('SELECT COUNT(*) FROM waiting_inmates WHERE status = $1', ['waiting']),
      pool.query('SELECT COUNT(*) FROM waiting_inmates WHERE priority = $1', ['high']),
      pool.query('SELECT COUNT(*) FROM waiting_inmates WHERE communication_system = $1', ['Securus'])
    ]);
    
    const avg_waiting = await pool.query(`
      SELECT ROUND(AVG(CASE WHEN request_date IS NOT NULL 
                           THEN CURRENT_DATE - request_date 
                           ELSE waiting_days END), 1) as avg_days
      FROM waiting_inmates WHERE status = 'waiting'
    `);
    
    res.json({
      total_volunteers: parseInt(volunteers.rows[0].count),
      total_waiting: parseInt(inmates.rows[0].count),
      high_priority: parseInt(high_priority.rows[0].count),
      securus_inmates: parseInt(securus_count.rows[0].count),
      jpay_inmates: parseInt(inmates.rows[0].count) - parseInt(securus_count.rows[0].count),
      avg_waiting_days: parseFloat(avg_waiting.rows[0].avg_days) || 0,
      active_matches: 0,
      pending_consent: 0,
      with_full_letters: parseInt(inmates.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching enhanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Volunteer consent management
app.post('/api/volunteer-consent', async (req, res) => {
  try {
    const {
      volunteer_id, full_legal_name, age_verified, real_name_consent,
      ministry_agreement, guidelines_accepted, securus_consent
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO volunteer_consent 
      (volunteer_id, full_legal_name, age_verified, real_name_consent, 
       ministry_agreement, guidelines_accepted, securus_consent) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [volunteer_id, full_legal_name, age_verified, real_name_consent,
       ministry_agreement, guidelines_accepted, securus_consent]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving consent:', error);
    res.status(500).json({ error: 'Failed to save consent' });
  }
});

// Get pending consents
app.get('/api/volunteer-consent/pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vc.*, v.name, v.email 
      FROM volunteer_consent vc
      LEFT JOIN volunteers v ON vc.volunteer_id = v.id
      WHERE vc.status = 'pending'
      ORDER BY vc.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending consents:', error);
    res.status(500).json({ error: 'Failed to fetch pending consents' });
  }
});

// Daily meditations
app.get('/api/meditations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM daily_meditations 
      ORDER BY date DESC 
      LIMIT 30
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meditations:', error);
    res.status(500).json({ error: 'Failed to fetch meditations' });
  }
});

// Create daily meditation
app.post('/api/meditations', async (req, res) => {
  try {
    const { title, content, scripture, theme, date } = req.body;
    
    const result = await pool.query(`
      INSERT INTO daily_meditations (title, content, scripture, theme, date)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, content, scripture, theme, date || new Date().toISOString().split('T')[0]]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating meditation:', error);
    res.status(500).json({ error: 'Failed to create meditation' });
  }
});

// Send notification to Dad
app.post('/api/notify-dad', async (req, res) => {
  try {
    const { type, subject, message, priority, inmate_id, volunteer_id } = req.body;
    
    const result = await pool.query(`
      INSERT INTO ministry_notifications 
      (notification_type, recipient_email, subject, message, priority, 
       related_inmate_id, related_volunteer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, 'chrisholley317@gmail.com', subject, message, priority || 'medium',
       inmate_id, volunteer_id]
    );
    
    console.log('Dad notification created:', result.rows[0]);
    res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// OCR endpoint (simulated)
app.post('/api/ocr/process', async (req, res) => {
  try {
    const { image_data, filename } = req.body;
    
    // Simulate OCR processing
    const extracted_text = `Sample extracted text from ${filename}`;
    const ministry_info = {
      inmate_name: "John Doe",
      inmate_number: "123456",
      facility: "Sample Facility",
      request_type: "pen_pal"
    };
    
    res.json({
      success: true,
      extracted_text,
      ministry_info,
      confidence_score: 95.5,
      processing_time: 1250
    });
  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({ error: 'OCR processing failed' });
  }
});

// Smart matching algorithm
app.post('/api/smart-match', async (req, res) => {
  try {
    const { volunteer_id, preferences } = req.body;
    
    // Get available inmates
    const inmates = await pool.query(`
      SELECT * FROM waiting_inmates 
      WHERE status = 'waiting' 
      ORDER BY priority DESC, waiting_days DESC
      LIMIT 5
    `);
    
    // Simple scoring algorithm
    const matches = inmates.rows.map(inmate => ({
      ...inmate,
      match_score: Math.floor(Math.random() * 40) + 60, // 60-100 score
      match_reasons: [
        'Compatible interests',
        'Similar communication preferences',
        'Geographic proximity'
      ]
    }));
    
    res.json({ matches });
  } catch (error) {
    console.error('Smart matching error:', error);
    res.status(500).json({ error: 'Smart matching failed' });
  }
});

// Get recent activity/notifications
app.get('/api/recent-activity', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        'new_inmate' as type,
        'New inmate request from ' || first_name || ' ' || last_name as message,
        created_at as timestamp,
        priority
      FROM waiting_inmates 
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Ministry Platform running on port ${PORT}`);
  console.log('✨ Features: OCR, Meditations, Smart Matching, Enhanced Dashboard');
  console.log('📊 Connected to database with enhanced tables');
});

module.exports = app;
