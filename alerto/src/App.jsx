import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

function App() {

  return (

    <Router>

      <Routes>

        <Route
          path="/"
          element={<Dashboard />}
        />
        
        /* Login Page */
        <Route path="/" element={<Login />} />

        /* Signup Page */
        <Route path="/signup" element={<Signup />} />

         /*Dashboard PAGE */
         <Route path="/dashboard" element={<Dashboard />} />

      </Routes>

    </Router>

  );

}

export default App;