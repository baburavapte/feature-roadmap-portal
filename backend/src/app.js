import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// --------------- Middleware ---------------

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// CORS — allow the Vite dev server with credentials (cookies)
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser (needed for refresh-token cookies later)
app.use(cookieParser());

// --------------- Routes ---------------

app.use('/api', routes);

// --------------- Error handling ---------------

app.use(errorHandler);

export default app;
