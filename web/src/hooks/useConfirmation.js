import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

const useConfirmation = () => {
  const { t } = useTranslation(["files", "common"]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const confirmDelete = useCallback(
    (message) =>
      new Promise((resolve) => {
        setConfirmAction({
          resolve,
          message,
          title: t("files:operations.delete"),
          confirmText: t("common:buttons.delete"),
          variant: "danger",
        });
        setShowConfirm(true);
      }),
    [t]
  );

  const confirmMove = useCallback(
    (message) =>
      new Promise((resolve) => {
        setConfirmAction({
          resolve,
          message,
          title: t("files:operations.move"),
          confirmText: t("common:buttons.move"),
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
    confirmMove,
    handleConfirm,
    handleCancel,
  };
};

export default useConfirmation;
