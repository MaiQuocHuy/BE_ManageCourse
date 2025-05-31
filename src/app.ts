import express, { Request, Response } from "express";
import morgan from "morgan";
import { config } from "dotenv";
import userRoutes from "./routes/user.routes";
import categoryRoutes from "./routes/category.routes";
import courseRoutes from "./routes/course.routes";
import sectionRoutes from "./routes/section.routes";
import lessonRoutes from "./routes/lesson.routes";
import enrollmentRoutes from "./routes/enrollment.routes";
import paymentRoutes from "./routes/payment.routes";
import reviewRoutes from "./routes/review.routes";
import cacheRoutes from './routes/cache.routes';
import { errorHandler } from './middleware/error.middleware';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import RedisClient from './config/redis';
import categoryService from './services/category.service';
// Import models to initialize associations
import "./models/index";

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 4322;

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Course Platform API",
      version: "1.0.0",
      description: "A RESTful API for an online course platform",
      contact: {
        name: "API Support",
        email: "support@courseplatform.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [`${__dirname}/routes/**/*.ts`],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
// Configure swagger-ui with persistAuthorization to save tokens between sessions
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true, // Save token in browser localStorage
  },
};

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocs, swaggerUiOptions)
);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "API is running" });
});

// Routes
app.get("/", (_req, res) => {
  res.send("Hello World");
});

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use('/api/cache', cacheRoutes);

// Error handling middleware must be after all routes
app.use(errorHandler);

// Initialize Redis and warm up cache on startup
async function initializeApp() {
  try {
    // Test Redis connection
    console.log('🔌 Testing Redis connection...');
    const redisConnected = await RedisClient.testConnection();

    if (redisConnected) {
      console.log('✅ Redis connected successfully');

      // Warm up cache with frequently accessed data
      console.log('🔥 Warming up cache...');
      await categoryService.warmUpCache();
    } else {
      console.warn('⚠️ Redis not available - application will run without caching');
    }
  } catch (error) {
    console.error('❌ Error during app initialization:', error);
    console.warn('⚠️ Continuing without Redis caching...');
  }
}

app.listen(port, async () => {
  console.log(`🚀 Express is listening at http://localhost:${port}/api-docs`);

  // Initialize Redis and cache after server starts
  await initializeApp();

  console.log('✅ Application fully initialized');
});

export default app;
