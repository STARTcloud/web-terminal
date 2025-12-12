import express from 'express';
import configLoader from '../config/configLoader.js';
import { specs } from '../config/swagger.js';
import { logger } from '../config/logger.js';
import { getSupportedLocales, getDefaultLocale } from '../config/i18n.js';

const router = express.Router();

/**
 * @swagger
 * /api/swagger.json:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the complete OpenAPI 3.0 specification for this API in JSON format
 *     tags: [API Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Complete OpenAPI 3.0 specification document
 *               properties:
 *                 openapi:
 *                   type: string
 *                   example: "3.0.4"
 *                 info:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: "File Server API"
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                 paths:
 *                   type: object
 *                   description: All API endpoints and their specifications
 *                 components:
 *                   type: object
 *                   description: Reusable components including schemas and security schemes
 */
router.get('/swagger.json', (req, res) => {
  logger.debug('Serving OpenAPI spec for React Swagger UI', { path: req.path });
  res.json(specs);
});

/**
 * @swagger
 * /api/i18n/languages:
 *   get:
 *     summary: Get available languages
 *     description: Returns the list of available languages that have been auto-detected from translation files in the system
 *     tags: [Internationalization]
 *     responses:
 *       200:
 *         description: Available languages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of available language codes
 *                   example: ['en', 'es', 'fr']
 *                 defaultLanguage:
 *                   type: string
 *                   description: Default language code used as fallback
 *                   example: 'en'
 *       500:
 *         description: Error retrieving language information (fallback response)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Fallback language array
 *                   example: ['en']
 *                 defaultLanguage:
 *                   type: string
 *                   description: Fallback default language
 *                   example: 'en'
 */
router.get('/i18n/languages', (req, res) => {
  try {
    logger.debug('i18n languages requested', { path: req.path });
    res.json({
      success: true,
      languages: getSupportedLocales(),
      defaultLanguage: getDefaultLocale(),
    });
  } catch (error) {
    logger.error('Failed to get i18n languages', { error: error.message });
    res.json({
      success: false,
      languages: [],
      defaultLanguage: undefined,
    });
  }
});

export default router;
