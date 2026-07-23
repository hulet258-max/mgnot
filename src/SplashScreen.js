import React from "react";
import "./SplashScreen.css";

function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="mgnot is loading">
      <div className="splash-brand">
        <img className="splash-logo splash-mark-only" src="/brand/mgnot-mark.png" alt="mgnot" />
      </div>
      <div className="splash-loading" aria-hidden="true" />
    </div>
  );
}

export default SplashScreen;
