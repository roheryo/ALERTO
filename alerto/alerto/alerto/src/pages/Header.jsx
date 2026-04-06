import logo from "../assets/images/ddoLOGO.jpg";

function Header() {

  return (

    <div className="dashboard-header">

      <div className="header-left">

        <h2 className="header-title">
          Dashboard
        </h2>

      </div>

      <div className="header-right">

        <div className="header-text">

          <h3>Davao de Oro</h3>

          <p>Provincial Health Office</p>

        </div>

        <img
          src={logo}
          alt="logo"
          className="header-logo"
        />

      </div>

    </div>

  );

}

export default Header;