import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join("C:", "Users", "vnchxxxxx", "Downloads", "ILI.xlsx-2023.xlsx");
const wb = XLSX.readFile(file);
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  console.log("SHEET:", name, "rows:", rows.length);
  if (rows[0]) console.log("COLUMNS:", Object.keys(rows[0]));
  console.log("SAMPLE:", JSON.stringify(rows.slice(0, 2), null, 2));
}
