const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Jeff\'s Second Family PenPal Ministry API',
    message: 'Backend is running successfully!',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Ministry API running on port ${port}`);
});
