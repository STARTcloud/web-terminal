/**
 * PWA Status Component
 * Shows install prompts, offline status, and PWA-related notifications
 */
import { useState, useEffect } from "react";
import { Button, Toast, ToastContainer } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import {
  isStandalone,
  canInstall,
  showInstallPrompt,
  isOnline,
  addOnlineOfflineListeners,
} from "../../utils/pwa";

/**
 * PWA Status Component
 * Handles install prompts, offline indicators, and update notifications
 */
const PWAStatus = () => {
  const { t } = useTranslation(["common", "auth"]);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isAppOnline, setIsAppOnline] = useState(isOnline());
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  useEffect(() => {
    // Check if install prompt is available
    const checkInstallPrompt = () => {
      setShowInstallButton(!isInstalled && canInstall());
    };

    // Listen for install prompt availability
    window.addEventListener("beforeinstallprompt", () => {
      if (!isInstalled) {
        setShowInstallButton(true);
      }
    });

    // Listen for app installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowInstallButton(false);
    });

    // Set up online/offline listeners
    const removeListeners = addOnlineOfflineListeners(
      () => {
        setIsAppOnline(true);
        setShowOfflineToast(false);
      },
      () => {
        setIsAppOnline(false);
        setShowOfflineToast(true);
      }
    );

    checkInstallPrompt();

    return () => {
      removeListeners();
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
    <>
      {/* Install App Button */}
      {showInstallButton ? (
        <Button
          variant="outline-success"
          size="sm"
          onClick={handleInstallClick}
          className="me-2"
          title={t("common:pwa.installWebTerminalAsApp", {
            appName: "Web-Terminal",
          })}
        >
          <i className="bi bi-download" /> {t("common:pwa.installApp")}
        </Button>
      ) : null}

      {/* Offline Status Indicator */}
      {!isAppOnline ? (
        <span className="badge bg-warning text-dark me-2">
          <i className="bi bi-wifi-off" /> {t("common:pwa.offline")}
        </span>
      ) : null}


      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        {/* Offline Notification */}
        <Toast
          show={showOfflineToast}
          onClose={() => setShowOfflineToast(false)}
          bg="warning"
          autohide={false}
        >
          <Toast.Header>
            <i className="bi bi-wifi-off me-2" />
            <strong className="me-auto">{t("common:pwa.offlineMode")}</strong>
          </Toast.Header>
          <Toast.Body className="text-dark">
            {t("common:pwa.youreOfflineMessage")}
          </Toast.Body>
        </Toast>

        {/* Update Available Notification */}
        <Toast
          show={showUpdateToast}
          onClose={() => setShowUpdateToast(false)}
          bg="info"
          autohide={false}
        >
          <Toast.Header>
            <i className="bi bi-arrow-clockwise me-2" />
            <strong className="me-auto">
              {t("common:pwa.updateAvailable")}
            </strong>
          </Toast.Header>
          <Toast.Body>
            {t("common:pwa.newVersionAvailable", { appName: "Web-Terminal" })}
            <Button
              variant="outline-primary"
              size="sm"
              className="ms-2"
              onClick={() => window.location.reload()}
            >
              {t("common:pwa.refresh")}
            </Button>
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
};

export default PWAStatus;
