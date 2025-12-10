import { Helmet } from "@dr.pogodin/react-helmet";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";

import api from "../../utils/api";

import { useAuth } from "./AuthContext";

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(["auth", "common"]);
  const [authMethods, setAuthMethods] = useState(null);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAuthMethods = useCallback(async () => {
    try {
      const oidcProvider = searchParams.get("oidc_provider");
      const authMethod = searchParams.get("auth_method");

      let url = "/auth/methods";
      const params = new URLSearchParams();
      if (oidcProvider) {
        params.append("oidc_provider", oidcProvider);
      }
      if (authMethod) {
        params.append("auth_method", authMethod);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await api.get(url);
      setAuthMethods(response.data);
    } catch (fetchError) {
      console.error("Failed to fetch auth methods:", fetchError);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAuthMethods();

    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");
    if (errorParam === "invalid_credentials" && messageParam) {
      setError(decodeURIComponent(messageParam));
    } else if (errorParam === "network_error") {
      setError(t("auth:errors.networkError"));
    }
  }, [searchParams, fetchAuthMethods, t]);

  const handleBasicAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login/basic", credentials);

      if (response.data.success) {
        const returnUrl = searchParams.get("return")
          ? decodeURIComponent(searchParams.get("return"))
          : "/";
        window.location.href = returnUrl;
      } else {
        setError(response.data.message || t("auth:errors.loginFailed"));
      }
    } catch (loginError) {
      setError(
        loginError.response?.data?.message || t("auth:errors.loginFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = (provider) => {
    const returnParam = searchParams.get("return")
      ? `?return=${encodeURIComponent(searchParams.get("return"))}`
      : "";
    window.location.href = `/auth/oidc/${provider}${returnParam}`;
  };

  const lightenColor = (color, amount = 0.3) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
    const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
    const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB)
      .toString(16)
      .slice(1)}`;
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!authMethods) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-dark">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t("common:status.loading")}</span>
        </div>
      </div>
    );
  }

  const title = authMethods?.ui?.login_title || "Web-Terminal";
  const subtitle =
    authMethods?.ui?.login_subtitle ||
    "Web-Terminal Login";
  const primaryColor = authMethods?.ui?.login_primary_color || "#198754";

  const oidcMethods = authMethods.success
    ? authMethods.methods.filter(
        (method) => method.id.startsWith("oidc-") && method.enabled
      )
    : [];
  const hasBasicAuth = authMethods.success
    ? authMethods.methods.some(
        (method) => method.id === "basic" && method.enabled
      )
    : false;

  return (
    <div className="login-container">
      <Helmet>
        <title>{t("auth:login.title")}</title>
      </Helmet>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="login-card">
              <div className="text-center mb-4">
                <i className="bi bi-shield-check display-4 text-success mb-3" />
                <h2 className="text-light">{title}</h2>
                <p className="powered-by-text mb-0">{subtitle}</p>
              </div>

              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}

              {/* OIDC Providers */}
              {oidcMethods.length > 0 ? (
                <div>
                  {oidcMethods.map((method) => {
                    const provider = method.id.replace("oidc-", "");
                    const baseColor = method.color || "#198754";
                    const lightColor = lightenColor(baseColor);

                    return (
                      <button
                        key={method.id}
                        type="button"
                        className="btn btn-oidc w-100 mb-2 d-flex align-items-center justify-content-center"
                        onClick={() => handleOIDCLogin(provider)}
                        style={{
                          backgroundColor: "transparent",
                          borderColor: baseColor,
                          color: lightColor,
                        }}
                      >
                        <i className="bi bi-shield-lock me-2" />
                        {method.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Divider between OIDC and Basic Auth */}
              {oidcMethods.length > 0 && hasBasicAuth ? (
                <div className="divider">
                  <span />
                </div>
              ) : null}

              {/* Basic Auth Form */}
              {hasBasicAuth ? (
                <>
                  <h5 className="text-light mb-3 text-center">
                    {t("auth:login.basicAuth")}
                  </h5>
                  <form onSubmit={handleBasicAuth}>
                    <div className="mb-3">
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        id="username"
                        name="username"
                        placeholder={t("auth:login.username")}
                        value={credentials.username}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            username: e.target.value,
                          })
                        }
                        required
                        autoComplete="username"
                      />
                    </div>
                    <div className="mb-3">
                      <input
                        type="password"
                        className="form-control bg-dark text-white border-secondary"
                        id="password"
                        name="password"
                        placeholder={t("auth:login.password")}
                        value={credentials.password}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            password: e.target.value,
                          })
                        }
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn w-100"
                      style={{
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        color: "white",
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          />
                          {t("auth:login.signingIn")}
                        </>
                      ) : (
                        <>
                          {t("auth:login.loginButton")}
                          <i className="bi bi-box-arrow-in-right ms-2" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : null}

              <div className="text-center mt-3">
                <small className="powered-by-text">
                  {t("auth:login.poweredBy")}{" "}
                  <a
                    href="https://startcloud.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-decoration-none text-light"
                  >
                    {t("auth:login.poweredByCompany")}
                  </a>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
