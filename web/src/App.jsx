import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { Suspense } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./components/auth/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import LandingPage from "./components/pages/LandingPage";
import ProtectedSwaggerRoute from "./components/routing/ProtectedSwaggerRoute";
import TerminalPage from "./components/terminal/TerminalPage";
import { TerminalProvider } from "./contexts/TerminalContext";
import i18n from "./i18n";

const LoadingFallback = () => {
  const { t } = useTranslation(["common"]);
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-dark">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{t("common:status.loading")}</span>
      </div>
    </div>
  );
};

const App = () => {
  const isDevelopment = import.meta.env.NODE_ENV === "development";

  const loginElement = (
    <ErrorBoundary>
      <LoginPage />
    </ErrorBoundary>
  );

  const apiDocsElement = (
    <ErrorBoundary>
      <ProtectedSwaggerRoute />
    </ErrorBoundary>
  );

  const landingElement = (
    <ErrorBoundary>
      <LandingPage />
    </ErrorBoundary>
  );

  const terminalElement = (
    <ErrorBoundary>
      <TerminalPage />
    </ErrorBoundary>
  );

  return (
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary showErrorDetails={isDevelopment}>
          <Suspense fallback={<LoadingFallback />}>
            <AuthProvider>
              <TerminalProvider>
                <Router>
                  <Routes>
                    <Route path="/login" element={loginElement} />
                    <Route path="/terminal" element={terminalElement} />
                    <Route path="/api-docs" element={apiDocsElement} />
                    <Route path="*" element={landingElement} />
                  </Routes>
                </Router>
              </TerminalProvider>
            </AuthProvider>
          </Suspense>
        </ErrorBoundary>
      </I18nextProvider>
    </HelmetProvider>
  );
};

export default App;
