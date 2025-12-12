import { useTranslation } from "react-i18next";

import ProtectedRoute from "../auth/ProtectedRoute";
import Layout from "../layout/Layout";

const SwaggerPlaceholder = () => {
  const { t } = useTranslation(["common"]);
  
  return (
    <div className="container py-5">
      <h1>{t("common:swagger.title")}</h1>
      <p>{t("common:swagger.placeholder")}</p>
    </div>
  );
};

const ProtectedSwaggerRoute = () => (
  <ProtectedRoute>
    <Layout>
      <SwaggerPlaceholder />
    </Layout>
  </ProtectedRoute>
);

export default ProtectedSwaggerRoute;
