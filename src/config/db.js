import mongoose from "mongoose";
import dns from "dns";

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);


const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in environment configuration");
    }

    const connectionTimeoutMs = 10000;
    const connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: connectionTimeoutMs,
      connectTimeoutMS: connectionTimeoutMs,
    });

    // SRV DNS lookups can hang before Mongoose's server-selection timeout starts.
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `MongoDB connection timed out after ${connectionTimeoutMs / 1000} seconds. Check your internet connection, DNS, and MongoDB Atlas network access.`,
          ),
        );
      }, connectionTimeoutMs);
    });

    const conn = await Promise.race([connectionPromise, timeoutPromise]);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
