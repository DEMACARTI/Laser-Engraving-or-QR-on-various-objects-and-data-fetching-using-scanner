import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import EngraveQRPage from "./pages/EngraveQRPage";
import "./App.css";

function MainRouter() {
  const [showEngrave, setShowEngrave] = useState(false);
  if (showEngrave) return <EngraveQRPage />;
  return <App onDone={() => setShowEngrave(true)} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MainRouter />
  </React.StrictMode>
);
