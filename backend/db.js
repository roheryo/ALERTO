import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

function createPool(password) {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "localhost",
    user: process.env.DB_USER ?? "root",
    password: password ?? "",
    database: process.env.DB_NAME ?? "ALERTO",
    waitForConnections: true,
    connectionLimit: 10
  });
}

const primary = createPool(process.env.DB_PASS ?? "");
const fallbackNoPassword = createPool("");

async function queryWithFallback(method, args) {
  try {
    return await primary[method](...args);
  } catch (err) {
    if (
      err?.code === "ER_ACCESS_DENIED_ERROR" &&
      (process.env.DB_PASS ?? "") !== ""
    ) {
      return await fallbackNoPassword[method](...args);
    }
    throw err;
  }
}

export const pool = {
  query: (...args) => queryWithFallback("query", args),
  execute: (...args) => queryWithFallback("execute", args)
};
