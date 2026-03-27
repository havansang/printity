const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { env } = require('./config/env');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFoundMiddleware } = require('./middlewares/not-found.middleware');
const apiRoutes = require('./routes');
const { ensureUploadRootExists, getUploadRootAbsolutePath } = require('./utils/file');

const app = express();

const allowedOrigins = env.CLIENT_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

ensureUploadRootExists();

app.disable('x-powered-by');
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(helmet({
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

if (env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(getUploadRootAbsolutePath()));
app.use('/fonts', express.static(path.resolve(process.cwd(), 'resources', 'fonts')));
app.use('/mockups', express.static(path.resolve(process.cwd(), 'resources', 'mockups')));
app.use('/api/v1', apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
