import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const getTenantPool = (dbName) => {
  return new pg.Pool({
    user: process.env.DB_USER,     // from .env
    password: process.env.DB_PASS, // from .env
    host: process.env.DB_HOST,     // from .env
    port: process.env.DB_PORT,     // from .env
    database: dbName               // dynamic tenant DB
  });
};
