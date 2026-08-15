import { createRoot } from "react-dom/client";
import App from "./App";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import "./styles/tennis-loader.css";

createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
