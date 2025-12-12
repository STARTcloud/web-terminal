import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web-Terminal',
      version: '0.1.1',
      description: 'Web-Terminal - Web based Terminal',
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
      contact: {
        name: 'Web-Terminal Project',
        url: 'https://github.com/STARTcloud/web-terminal',
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'Endpoint Documentation',
        description: 'OpenAPI specification and documentation endpoints',
      },
      {
        name: 'Internationalization',
        description: 'Multi-language support and locale management',
      },
    ],
    servers: [
      {
        url: 'https://localhost:443',
        description: 'Current API Server (will be updated dynamically)',
      },
      {
        url: 'http://localhost:80',
        description: 'HTTP API Server',
      },
    ],
    components: {
      securitySchemes: {
        JwtAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT token authentication. Login via web interface to get JWT token in cookies.',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status (always false for errors)',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Authentication required',
            },
          },
        },
      },
    },
    security: [
      {
        JwtAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './models/*.js'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

// This function is no longer used - we now use external JavaScript files

export { specs, swaggerUi };
