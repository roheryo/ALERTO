import React, { useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import "./PatientLogs.css";

const PatientLogs = () => {
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setFileName(file.name);
    setHeaders([]);
    setRows([]);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        if (!workbook.SheetNames.length) {
          throw new Error("No sheets found in the file.");
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ""
        });

        if (sheetData.length < 2) {
          throw new Error("The file has no data rows.");
        }

        setHeaders(sheetData[0]);
        setRows(sheetData.slice(1));
      } catch (err) {
        console.error("File parsing error:", err);
        setError("❌ Failed to read the file. Please check the file format.");
      }
    };

    reader.onerror = () => {
      setError("❌ File reading failed.");
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="patient-log-container">
      <button className="back-btn" onClick={() => navigate("/dashboard")}>
        ⬅ Back to Dashboard
      </button>

      <h2>Patient Logs</h2>

      <div className="upload-box">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
        />
        {fileName && <p className="file-info">📄 {fileName}</p>}
      </div>

      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      {rows.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {headers.map((_, j) => (
                    <td key={j}>{row[j]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PatientLogs;
