import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
// Always load the backend's own .env file, even when PM2 starts this process
// from a different working directory.
dotenv.config({ path: path.join(serverDirectory, ".env") });

const PORT = process.env.PORT || 9090;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup aborted because MongoDB is unavailable.");
    process.exit(1);
  }
};

startServer();
