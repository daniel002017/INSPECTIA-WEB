const express = require('express');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/dataroutes');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require("path"); 
require('dotenv').config();

// Render asigna un puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;

// Usamos BASE_URL para que Swagger apunte al dominio correcto
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Configuración de Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Usuarios',
      version: '1.0.0',
      description: 'Documentación de la API de Usuarios',
    },
    servers: [
      { url: BASE_URL }
    ],
  },
  apis: ['./routes/*.js', './models/*.js'], // Rutas y modelos
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// --- Servidor principal ---
const app = express();

app.use(cors({ 
  origin: ['https://inspectia-web.vercel.app', 'http://localhost:5173'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use('/', userRoutes);

// Servir archivos estáticos (ej. evidencias, documentos, etc.)
app.use("/documents", express.static(path.join(__dirname, "documents")));

// Swagger en el mismo servidor
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Ruta para obtener swagger.json
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: ${BASE_URL}`);
  console.log(`📄 Swagger docs en: ${BASE_URL}/api-docs`);
});
