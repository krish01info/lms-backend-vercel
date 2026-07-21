const swaggerJsdoc = require("swagger-jsdoc");
const config = require("./index");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LearnFlow LMS API",
      version: "1.0.0",
      description: "REST API for the LearnFlow learning management system.",
    },
    servers: [{ url: `http://localhost:${config.port}/api/v1`, description: "Local" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Reads JSDoc @openapi/@swagger comment blocks from route files, if/when added.
  apis: ["./src/api/**/*.routes.js"],
});

module.exports = swaggerSpec;
