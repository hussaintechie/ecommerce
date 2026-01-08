import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,        // MUST be postgres
  password: process.env.DB_PASS,    // MUST be correct
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  client_encoding: "UTF8",   // master DB
});

export default pool;
