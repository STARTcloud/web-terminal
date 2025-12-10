import ProtectedRoute from "../auth/ProtectedRoute";
import Layout from "../layout/Layout";

const SwaggerPlaceholder = () => (
  <div className="container py-5">
    <h1>API Documentation</h1>
    <p>Swagger documentation will be available here.</p>
  </div>
);

const ProtectedSwaggerRoute = () => (
  <ProtectedRoute>
    <Layout>
      <SwaggerPlaceholder />
    </Layout>
  </ProtectedRoute>
);

export default ProtectedSwaggerRoute;
