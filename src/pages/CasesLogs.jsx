import "./CasesLogs.css";

function CasesLogs() {
  return (
    <div className="caseslogs-container">

      {/* Page Header */}
      <div className="dashboard-header">
        <h2>Cases Logs</h2>
      </div>

      {/* Content */}
      <div className="caseslogs-content">

        {/* Top Controls */}
        <div className="caseslogs-controls">

          <input
            type="text"
            placeholder="Search patient name..."
            className="search-input"
          />

          <select className="filter-select">
            <option>All Diseases</option>
            <option>Acute Watery Diarrhea</option>
            <option>Influenza-Like Illness</option>
            <option>Dengue</option>
          </select>

        </div>

        {/* Table */}
        <div className="table-container">

          <table className="cases-table">

            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Disease</th>
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Date Started</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {/* Sample Row */}
              <tr>
                <td>Juan Dela Cruz</td>
                <td>25</td>
                <td>Male</td>
                <td>Dengue</td>
                <td>Nabunturan</td>
                <td>Poblacion</td>
                <td>08/04/2026</td>

                <td className="action-buttons">

                  <button className="view-btn">
                    View
                  </button>

                  <button className="edit-btn">
                    Edit
                  </button>

                  <button className="delete-btn">
                    Delete
                  </button>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

export default CasesLogs;