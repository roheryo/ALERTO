const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mysql = require("mysql2");

function createDb(password) {
  return mysql
    .createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password,
      database: process.env.DB_NAME
    })
    .promise();
}

const primary = createDb(process.env.DB_PASS ?? "");
const fallbackNoPassword = createDb("");

async function queryWithFallback(method, args) {
  try {
    return await primary[method](...args);
  } catch (err) {
    // Common local setup: root user has NO password (XAMPP/WAMP).
    if (err?.code === "ER_ACCESS_DENIED_ERROR" && (process.env.DB_PASS ?? "") !== "") {
      return await fallbackNoPassword[method](...args);
    }
    throw err;
  }
}

module.exports = {
  query: (...args) => queryWithFallback("query", args),
  execute: (...args) => queryWithFallback("execute", args)
};