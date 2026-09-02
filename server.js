import fs from "fs";
import dotenv from "dotenv";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";

const envPath = fs.existsSync(".env") ? ".env" : "env";
dotenv.config({ path: envPath });

const PORT = process.env.PORT || 9090;

const startServer = async () => {
  try {
    console.log(`Loading environment from ${envPath}`);
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
