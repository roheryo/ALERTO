import "./Notifications.css";
import logo from "../assets/images/ddoLOGO.JPG";

function Notification() {

  const notifications = [

    {
      id: 1,
      type: "warning",
      title: "New Country Login",
      message: "Your account was accessed from a new location.",
      time: "Today 09:45"
    },

    {
      id: 2,
      type: "error",
      title: "Balance is Low",
      message: "Your balance is running low.",
      time: "Today 09:45"
    },

    {
      id: 3,
      type: "success",
      title: "Payment Activated",
      message: "Payment has been successfully activated.",
      time: "Today 09:45"
    },

    {
      id: 4,
      type: "info",
      title: "Recharge Cancelled",
      message: "Auto recharge has been cancelled.",
      time: "Today 09:45"
    }

  ];

  return (

    <div className="notifications-container">

      {/* HEADER */}

      <div className="dashboard-header">

        <h2>Notifications</h2>

        <div className="header-right">

          <div className="header-text">
            <span>Davao de Oro</span>
            <small>Provincial Health Office</small>
          </div>

          <img
            src={logo}
            alt="DDO Logo"
            className="header-logo"
          />

        </div>

      </div>

      {/* CONTENT */}

      <div className="notifications-content">

        {/* TOP BAR */}

        <div className="notif-topbar">

          <div className="notif-left">

            <h3>
              All Notifications
              <span className="info-icon">ⓘ</span>
            </h3>

            <div className="show-entries">

              Show

              <select>
                <option>10</option>
                <option defaultValue>20</option>
                <option>50</option>
              </select>

              entries

            </div>

          </div>

          <div className="notif-right">

            <label className="toggle">

              Only Show Unread

              <input type="checkbox" />

              <span className="slider"></span>

            </label>

            <button className="mark-all">
              Mark All as Read
            </button>

          </div>

        </div>

        {/* LIST */}

        <div className="notifications-list">

          {/* HEADER ROW */}

         <div className="notifications-header">

            <div></div> 

            <div>Title</div>

            <div>Message</div>

            <div>Time</div>

            <div>Mark as Read</div>

          </div>

          {/* DATA ROWS */}

          {notifications.map((notif) => (

            <div
              key={notif.id}
              className="notification-row"
            >

              {/* ICON */}

              <div className={`notif-bullet ${notif.type}`}>
                •
              </div>

              {/* TITLE */}

              <div className="notif-title">
                {notif.title}
              </div>

              {/* MESSAGE */}

              <div className="notif-message">
                {notif.message}
              </div>

              {/* TIME */}

              <div className="notif-time">
                {notif.time}
              </div>

              {/* ACTION */}

              <button className="mark-read">
                Mark as Read
              </button>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}

export default Notification;