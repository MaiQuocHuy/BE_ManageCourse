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
import { errorHandler } from "./middleware/error.middleware";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
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

// Error handling middleware must be after all routes
app.use(errorHandler);

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}/api-docs`);
});

export default app;
