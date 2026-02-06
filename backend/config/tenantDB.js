import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const getTenantPool = (dbName) => {
  return new pg.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: dbName
  });
};
