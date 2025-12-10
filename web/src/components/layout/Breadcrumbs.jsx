import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link, useSearchParams } from "react-router-dom";

import api from "../../utils/api";

const Breadcrumbs = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(["common"]);
  const [primaryColor, setPrimaryColor] = useState("#198754");

  useEffect(() => {
    const fetchUIConfig = async () => {
      try {
        const response = await api.get("/auth/methods");
        if (response.data.success && response.data.ui?.login_primary_color) {
          setPrimaryColor(response.data.ui.login_primary_color);
        }
      } catch (error) {
        console.error("Failed to fetch UI config:", error);
      }
    };

    fetchUIConfig();
  }, []);

  const generateBreadcrumbs = (pathname) => {
    const viewIndex = searchParams.get("view") === "index";

    if (!pathname || pathname === "/") {
      const breadcrumbs = [{ name: t("common:breadcrumbs.web-terminal"), path: "/" }];
      if (viewIndex) {
        breadcrumbs.push({
          name: t("common:breadcrumbs.home"),
          path: "/?view=index",
          isHome: true,
        });
      }
      return breadcrumbs;
    }

    const parts = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ name: t("common:breadcrumbs.web-terminal"), path: "/" }];

    let currentPath = "";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      breadcrumbs.push({
        name: decodeURIComponent(part),
        path: currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs(location.pathname);

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb mb-0">
        {breadcrumbs.map((crumb, index) => (
          <li
            key={crumb.path}
            className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? "active" : ""}`}
          >
            {index === breadcrumbs.length - 1 ? (
              <span className="text-light">
                {index === 0 ? (
                  <i
                    className="bi bi-shield-check me-1"
                    style={{ color: primaryColor }}
                  />
                ) : null}
                {index !== 0 && crumb.isHome ? (
                  <i className="bi bi-house me-1 text-light" />
                ) : null}
                {index !== 0 && !crumb.isHome ? (
                  <i className="bi bi-folder2 me-1 text-light" />
                ) : null}
                {crumb.name}
              </span>
            ) : (
              <Link to={crumb.path} className="text-decoration-none text-light">
                {index === 0 ? (
                  <i
                    className="bi bi-shield-check me-1"
                    style={{ color: primaryColor }}
                  />
                ) : null}
                {index !== 0 && crumb.isHome ? (
                  <i className="bi bi-house me-1 text-light" />
                ) : null}
                {index !== 0 && !crumb.isHome ? (
                  <i className="bi bi-folder2 me-1 text-light" />
                ) : null}
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
