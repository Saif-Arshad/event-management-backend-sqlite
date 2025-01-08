const logger = require("morgan");
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
require("dotenv").config();
const userRoutes = require("./user.routes");
const eventsRoutes = require("./event.routes");

const initializeDatabase = () => {
  const db = new sqlite3.Database("mydatabase.db", (err) => {
    if (err) {
      console.error("Error connecting to SQLite database:", err.message);
    } else {
      console.log("Connected to SQLite database.");

      const schemaPath = path.join(__dirname, "../schema.sql");

      const schema = fs.readFileSync(schemaPath, "utf-8");
      db.exec(schema, (err) => {
        if (err) {
          console.error("Error applying database schema:", err.message);
        } else {
          console.log("Database schema applied successfully.");
        }
      });
    }
  });

  return db;
};

// Initialize the database
const db = initializeDatabase();

(async () => {
  const allowedOrigins = "*";
  const corsOptionsAll = {
    optionsSuccessStatus: 202,
    origin: allowedOrigins,
    credentials: true,
  };

  const app = express();
  const server = http.createServer(app);

  app.use(cors(corsOptionsAll));
  app.use(express.json({ limit: "10mb" }));
  app.use(logger("dev"));

  // Custom success and error response handlers
  app.use(function (req, res, next) {
    res.success = async (data, meta) => {
      return res
        .status(200)
        .send({ success: true, error: null, body: data, meta });
    };

    res.error = async (error) => {
      return res.status(error.status || 500).send({
        success: false,
        error: error.message || "Internal Server Error",
        body: null,
        status: error.status || 500,
      });
    };

    next();
  });

  app.use("/api/user", (req, res, next) => {
    req.db = db;
    next();
  }, userRoutes);
  app.use("/api/events", (req, res, next) => {
    req.db = db;
    next();
  }, eventsRoutes);

  // Handle 404 errors
  app.use((req, res) => {
    return res.status(404).send({ error: "Route not found" });
  });

  const port = process.env.PORT || 3344;
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
})();
