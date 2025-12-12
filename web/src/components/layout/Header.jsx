import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "react-router-dom";

import { getSupportedLanguages } from "../../i18n";
import { useAuth } from "../auth/AuthContext";

import Breadcrumbs from "./Breadcrumbs";

const Header = () => {
  const { user, logout, logoutLocal } = useAuth();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setShowLanguageModal(false);
  };

  // Get language display name from translations
  const getLanguageDisplayName = (languageCode) => {
    const translationKey = `languageNames.${languageCode}`;
    const translated = t(translationKey);
    
    // If translation doesn't exist, fall back to uppercase code
    return translated !== translationKey ? translated : languageCode.toUpperCase();
  };

  // Get supported languages from i18n
  const supportedLanguages = getSupportedLanguages();

  const getUserDisplayName = (userInfo) => {
    if (!userInfo) {
      return t("user.unknownUser");
    }

    if (userInfo.authType === "api_key") {
      return t("user.apiKey", { keyName: userInfo.keyName || "Unnamed" });
    }

    if (userInfo.authType === "basic") {
      return userInfo.username || t("user.basicAuthUser");
    }

    if (userInfo.authType === "jwt" && userInfo.oidcUser) {
      const oidc = userInfo.oidcUser;
      return (
        oidc.name || oidc.email || oidc.preferred_username || t("user.oidcUser")
      );
    }

    return userInfo.username || t("user.user");
  };

  // Close dropdown on navigation or outside click
  useEffect(() => {
    setShowUserDropdown(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown")) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showUserDropdown]);

  return (
    <header className="bg-dark border-bottom border-secondary">
      <div className="container-fluid">
        <div className="row align-items-center py-3">
          <div className="col">
            <Breadcrumbs />
          </div>
          <div className="col-auto">
            <div className="dropdown">
              <button
                className="btn btn-outline-light dropdown-toggle"
                type="button"
                id="userDropdown"
                aria-expanded={showUserDropdown}
                onClick={() => setShowUserDropdown(!showUserDropdown)}
              >
                <i className="bi bi-person-circle me-1" />
                {getUserDisplayName(user)}
              </button>
              <ul
                className={`dropdown-menu dropdown-menu-end bg-dark border-secondary ${
                  showUserDropdown ? "show" : ""
                }`}
                aria-labelledby="userDropdown"
              >
                {!user?.permissions?.includes("restricted") &&
                location.pathname !== "/api-docs" ? (
                  <li>
                    <Link to="/api-docs" className="dropdown-item text-light">
                      <i className="bi bi-book me-2" />
                      {t("navigation.apiDocumentation")}
                    </Link>
                  </li>
                ) : null}
                <li>
                  <hr className="dropdown-divider border-secondary" />
                </li>
                <li>
                  <button
                    className="dropdown-item text-light"
                    onClick={() => setShowLanguageModal(true)}
                  >
                    <i className="bi bi-globe me-2" />
                    {t("language.selectLanguage")}
                  </button>
                </li>
                <li>
                  <hr className="dropdown-divider border-secondary" />
                </li>
                <li>
                  <button className="dropdown-item text-light" onClick={logout}>
                    <i className="bi bi-box-arrow-right me-2" />
                    {t("navigation.logout")}
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item text-light"
                    onClick={logoutLocal}
                  >
                    <i className="bi bi-box-arrow-left me-2" />
                    {t("navigation.logoutLocal")}
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal ? (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-light">
                  <i className="bi bi-globe me-2" />
                  {t("language.changeLanguage")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowLanguageModal(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="list-group list-group-flush">
                  {supportedLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`list-group-item list-group-item-action bg-dark text-light border-secondary d-flex justify-content-between align-items-center ${
                        i18n.language === lang ? "active" : ""
                      }`}
                      onClick={() => changeLanguage(lang)}
                    >
                      <span>
                        <i className="bi bi-globe me-2" />
                        {getLanguageDisplayName(lang)}
                      </span>
                      {i18n.language === lang ? (
                        <i className="bi bi-check-circle text-success" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLanguageModal(false)}
                >
                  {t("buttons.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Header;
