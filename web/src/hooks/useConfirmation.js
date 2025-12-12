import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

const useConfirmation = () => {
  const { t } = useTranslation(["common"]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const confirmDelete = useCallback(
    (message) =>
      new Promise((resolve) => {
        setConfirmAction({
          resolve,
          message,
          title: t("common:buttons.delete"),
          confirmText: t("common:buttons.delete"),
          variant: "danger",
        });
        setShowConfirm(true);
      }),
    [t]
  );

  const confirmGeneric = useCallback(
    (message, title) =>
      new Promise((resolve) => {
        setConfirmAction({
          resolve,
          message,
          title: title || t("common:messages.confirmAction"),
          confirmText: t("common:buttons.confirm"),
          variant: "primary",
        });
        setShowConfirm(true);
      }),
    [t]
  );

  const handleConfirm = useCallback(() => {
    if (confirmAction) {
      confirmAction.resolve(true);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  }, [confirmAction]);

  const handleCancel = useCallback(() => {
    if (confirmAction) {
      confirmAction.resolve(false);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  }, [confirmAction]);

  return {
    showConfirm,
    confirmAction,
    confirmDelete,
    confirmGeneric,
    handleConfirm,
    handleCancel,
  };
};

export default useConfirmation;
