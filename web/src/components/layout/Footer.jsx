import { useState, useEffect } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { isStandalone, showInstallPrompt } from "../../utils/pwa";

const Footer = () => {
  const { t } = useTranslation(["auth", "common"]);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  useEffect(() => {
    // Check for install prompt on load and when it becomes available
    const checkInstallPrompt = () => {
      if (!isInstalled && window.deferredPrompt) {
        setShowInstallButton(true);
      }
    };

    // Listen for install prompt availability
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      if (!isInstalled) {
        setShowInstallButton(true);
      }
    };

    // Listen for app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      window.deferredPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    checkInstallPrompt();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    const installed = await showInstallPrompt();
    if (installed) {
      setShowInstallButton(false);
      setIsInstalled(true);
    }
  };

  return (
    <footer className="py-4 border-top border-secondary">
      <div className="container text-center">
        <div className="d-flex align-items-center justify-content-center">
          <span className="text-light me-2">{t("auth:login.poweredBy")}</span>
          <a
            href="https://startcloud.com"
            target="_blank"
            className="text-decoration-none d-flex align-items-center"
            rel="noreferrer"
          >
            <img
              src="https://startcloud.com/assets/images/logos/startcloud-logo40.png"
              alt="STARTcloud"
              height="20"
              className="me-2"
              onError={(e) => {
                e.target.src = "/images/logo.png";
              }}
            />
            <span className="text-light">
              {t("auth:login.poweredByCompany")}
            </span>
          </a>

          {/* PWA Install Button */}
          {showInstallButton ? (
            <Button
              variant="outline-light"
              size="sm"
              onClick={handleInstallClick}
              className="ms-3"
              title={t("common:actions.installApp", {
                appName: "Web-Terminal",
              })}
            >
              <i className="bi bi-download" />
            </Button>
          ) : null}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
