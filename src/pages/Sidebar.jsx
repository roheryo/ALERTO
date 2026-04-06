import { Link } from "react-router-dom";
import "./Sidebar.css";

function Sidebar() {

  return (

    <div className="sidebar">

      <h3 className="sidebar-title">
        Disease Surveillance
      </h3>

      <ul>

        <li>
          <Link to="/">Dashboard</Link>
        </li>

        <li>
          <Link to="/cases">Cases Logs</Link>
        </li>

        <li>
          <Link to="/reports">Reports</Link>
        </li>

        <li>
          <Link to="/notification">Notification</Link>
        </li>

      </ul>

    </div>

  );

}

export default Sidebar;