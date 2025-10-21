const express = require('express');
const cors = require('cors');
require('dotenv').config();

const mfaRoutes = require('./routes/mfa');
const { errorHandler } = require('./middleware/errorHandler'); // ← CAMBIO AQUÍ

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',
    'https://tu-dominio-produccion.com'
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/mfa', mfaRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'MFA Service',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(` MFA Service running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
});