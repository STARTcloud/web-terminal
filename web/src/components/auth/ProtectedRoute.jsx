import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation(["common"]);
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t("common:status.loading")}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnPath = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?return=${encodeURIComponent(returnPath)}`}
        replace
      />
    );
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;
