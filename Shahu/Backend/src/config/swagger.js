const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shahu API',
      version: '1.0.0'
    },
    servers: [
      {
        url: `/api/${env.apiVersion}`
      }
    ]
  },
  apis: ['./src/routes/*.js']
});

module.exports = swaggerSpec;
