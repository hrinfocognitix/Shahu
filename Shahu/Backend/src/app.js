const compression = require('compression');
const cors = require('cors');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const requestLogger = require('./middleware/logger.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');
const paymentController = require('./controllers/payment.controller');
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true
  })
);
app.use(compression());
// Must be registered before express.json(): Razorpay signs the exact unparsed request bytes.
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), paymentController.razorpayWebhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  '/uploads',
  (req, res, next) => {
    if (/\.(pdf|doc|docx|xls|xlsx)$/i.test(req.path)) {
      return res.status(403).json({
        success: false,
        message: 'Use an authorized document download link',
      });
    }
    // Uploaded academy media is intentionally public and is rendered by the
    // separately hosted website and mobile app.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);
app.use(requestLogger);
app.use(apiLimiter);

app.use(`/api/${env.apiVersion}`, routes);
// Exact Standard Checkout aliases; handlers still use the same payment service and database records.
app.post('/api/create-order', paymentController.createRazorpayCheckoutOrder);
app.post('/api/verify-payment', paymentController.verifyRazorpayCheckoutPayment);
// Versionless aliases used by the mobile purchase flow. The handlers stay in the same router.
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/admin/payments', require('./routes/adminPayment.routes'));
// Versionless aliases retained for mobile clients that call /api/auth directly.
app.use('/api/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
