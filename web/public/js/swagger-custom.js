window.onload = function () {
  // Get current URL for dynamic server configuration
  const currentUrl = `${window.location.protocol}//${window.location.host}`;

  // Create modified spec with current server URL and additional options
  const modifiedSpec = window.swaggerSpec
    ? JSON.parse(JSON.stringify(window.swaggerSpec))
    : null;
  if (modifiedSpec && modifiedSpec.servers) {
    // Provide multiple server options for manual override
    modifiedSpec.servers = [
      {
        url: currentUrl,
        description: "- Current",
      },
    ];
  }

  SwaggerUIBundle({
    spec: modifiedSpec || window.swaggerSpec,
    dom_id: "#swagger-ui",
    deepLinking: {
      enabled: true,
      updateHistory: true,
      whitespaceSeparator: "%20", // Use URL encoding instead of underscore for v4.0 compatibility
    },
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.presets.standalone],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: "BaseLayout",
    configUrl: null, // Disable config fetching to avoid warnings
    validatorUrl: null, // Disable validator to reduce warnings
    requestInterceptor: (req) => {
      // Ensure API requests use the selected server
      const serverSelect = document.querySelector(".servers select");
      if (serverSelect && serverSelect.value && !req.url.startsWith("http")) {
        const baseUrl = serverSelect.value.replace(/\/$/, "");
        req.url = baseUrl + (req.url.startsWith("/") ? req.url : `/${req.url}`);
      } else if (req.url.startsWith("/")) {
        req.url = currentUrl + req.url;
      }
      return req;
    },
  });

  setTimeout(() => {
    const container = document.querySelector(".swagger-ui");
    if (container) {
      // Modify the scheme container to create horizontal layout
      const schemesSection = document.querySelector(
        ".swagger-ui .scheme-container .schemes"
      );
      const schemesServerContainer = document.querySelector(
        ".swagger-ui .schemes-server-container"
      );
      const authWrapper = document.querySelector(".swagger-ui .auth-wrapper");

      if (schemesSection && schemesServerContainer && authWrapper) {
        // Make the schemes section a flex container
        schemesSection.style.cssText =
          "display: flex; align-items: center; gap: 16px; flex-wrap: wrap;";

        const customServerDiv = document.createElement("div");
        customServerDiv.style.cssText =
          "display: flex; gap: 8px; align-items: center; flex: 1; min-width: 300px;";

        const customUrlInput = document.createElement("input");
        customUrlInput.type = "text";
        customUrlInput.placeholder =
          "Enter custom server URL (e.g., https://api.example.com:8080)";
        customUrlInput.style.cssText = `
          flex: 1;
          height: 38px;
        `;

        const setButton = document.createElement("button");
        setButton.className = "btn authorize unlocked";
        setButton.style.cssText =
          "background: transparent; border: 2px solid #198754; color: #198754;";
        setButton.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"></path></svg>';

        customServerDiv.appendChild(customUrlInput);
        customServerDiv.appendChild(setButton);

        // Add functionality to set button
        setButton.addEventListener("click", () => {
          const customUrl = customUrlInput.value.trim();
          if (customUrl) {
            const serverSelect = document.querySelector("#servers");
            if (serverSelect) {
              // Add the custom URL as a new option
              const customOption = document.createElement("option");
              customOption.value = customUrl;
              customOption.textContent = `${customUrl} - Custom`;
              serverSelect.appendChild(customOption);
              serverSelect.value = customUrl;

              // Visual feedback with checkmark animation
              const originalIcon = setButton.innerHTML;
              setButton.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path></svg>';
              setButton.style.cssText =
                "background: #198754; border: 2px solid #198754; color: #fff; transform: scale(1.1);";
              setTimeout(() => {
                setButton.innerHTML = originalIcon;
                setButton.style.cssText =
                  "background: transparent; border: 2px solid #198754; color: #198754; transform: scale(1);";
              }, 1500);
            }
          }
        });

        // Allow Enter key to set server
        customUrlInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            setButton.click();
          }
        });

        // Remove the "Servers" title
        const serversTitle = document.querySelector(
          ".swagger-ui .servers-title"
        );
        if (serversTitle) {
          serversTitle.style.display = "none";
        }

        // Make the servers dropdown the same height as other elements and fix label margin
        const serverSelect = document.querySelector("#servers");
        if (serverSelect) {
          serverSelect.style.height = "38px";
        }

        // Fix the label margin to align properly
        const serverLabel = document.querySelector(
          ".swagger-ui .servers label"
        );
        if (serverLabel) {
          serverLabel.style.margin = "0";
        }

        // Insert the custom server div into the schemes section (before auth wrapper)
        schemesSection.insertBefore(customServerDiv, authWrapper);
      }
    }
  }, 500); // Slightly longer delay to ensure auth elements are rendered
  // Watch for authorize modal and add API keys section inside it
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.querySelector &&
          node.querySelector(".modal-ux")
        ) {
          // Modal opened, add API keys section
          setTimeout(() => {
            const modalContent = node.querySelector(".modal-ux-content");
            if (
              modalContent &&
              !modalContent.querySelector(".modal-api-keys")
            ) {
              // Fetch current user API keys and config
              fetch("/api/user-api-keys")
                .then((response) => response.json())
                .then((data) => {
                  if (data.success) {
                    const apiKeys = data.api_keys || [];
                    const swaggerConfig = data.swagger_config || {};

                    const apiKeysDiv = document.createElement("div");
                    apiKeysDiv.className = "modal-api-keys";
                    apiKeysDiv.style.cssText = `
                      background: #2d3540;
                      border: 1px solid #495057;
                      border-radius: 8px;
                      margin-bottom: 16px;
                      padding: 16px;
                    `;

                    const title = document.createElement("h4");
                    title.textContent = "🔑 Your API Keys";
                    title.style.cssText =
                      "color: #fff; margin: 0 0 12px 0; font-size: 14px;";
                    apiKeysDiv.appendChild(title);

                    // Show existing API keys based on configuration
                    if (apiKeys.length > 0) {
                      if (swaggerConfig.allow_full_key_retrieval) {
                        // Full key retrieval enabled - show keys with fill buttons
                        apiKeys.forEach((key) => {
                          const keyItem = document.createElement("div");
                          keyItem.style.cssText = `
                            background: #495057;
                            border: 1px solid #6c757d;
                            border-radius: 4px;
                            padding: 8px 12px;
                            margin-bottom: 8px;
                            font-family: monospace;
                            font-size: 11px;
                            color: #fff;
                          `;

                          const keyHeader = document.createElement("div");
                          keyHeader.style.cssText =
                            "display: flex; justify-content: space-between; align-items: center;";

                          const keyName = document.createElement("strong");
                          keyName.textContent = key.name;
                          keyName.style.cssText =
                            "color: #fff; font-size: 12px;";

                          const keyInfo = document.createElement("div");
                          keyInfo.style.cssText =
                            "color: #adb5bd; font-size: 10px;";
                          keyInfo.textContent = `Permissions: ${key.permissions.join(", ")} | Expires: ${new Date(key.expires_at).toLocaleDateString()}`;

                          const fillBtn = document.createElement("button");
                          fillBtn.textContent = "Fill Auth Field";
                          fillBtn.style.cssText = `
                            background: #198754;
                            border: none;
                            color: #fff;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 10px;
                          `;

                          keyHeader.appendChild(keyName);
                          keyHeader.appendChild(keyInfo);
                          keyHeader.appendChild(fillBtn);

                          keyItem.appendChild(keyHeader);

                          // Add fill auth field functionality for full keys
                          fillBtn.addEventListener("click", () => {
                            fillBtn.textContent = "Retrieving...";
                            fillBtn.disabled = true;

                            fetch(`/api/user-api-keys/${key.id}/full`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                            })
                              .then((response) => response.json())
                              .then((result) => {
                                if (result.success && result.full_key) {
                                  const authInput =
                                    document.querySelector(
                                      "#auth-bearer-value"
                                    );
                                  if (authInput) {
                                    authInput.value = `Bearer ${result.full_key}`;

                                    // Clear field first, then fill - more robust for Swagger UI state management
                                    authInput.value = "";
                                    authInput.focus();

                                    // Simulate typing for better compatibility
                                    setTimeout(() => {
                                      const bearerToken = result.full_key;

                                      // Use native setter to bypass React/framework state
                                      const nativeInputValueSetter =
                                        Object.getOwnPropertyDescriptor(
                                          window.HTMLInputElement.prototype,
                                          "value"
                                        ).set;
                                      nativeInputValueSetter.call(
                                        authInput,
                                        bearerToken
                                      );

                                      // Trigger comprehensive events
                                      const events = [
                                        "input",
                                        "change",
                                        "keyup",
                                        "keydown",
                                        "blur",
                                        "focus",
                                      ];
                                      events.forEach((eventType) => {
                                        authInput.dispatchEvent(
                                          new Event(eventType, {
                                            bubbles: true,
                                          })
                                        );
                                      });

                                      // Additional React-specific events
                                      authInput.dispatchEvent(
                                        new InputEvent("input", {
                                          bubbles: true,
                                          data: bearerToken,
                                        })
                                      );

                                      // Force focus and selection to trigger validation
                                      authInput.focus();
                                      authInput.select();
                                      authInput.setSelectionRange(
                                        0,
                                        bearerToken.length
                                      );

                                      // Final blur to complete the input cycle
                                      setTimeout(() => {
                                        authInput.blur();
                                        authInput.focus();
                                      }, 50);
                                    }, 50);

                                    fillBtn.textContent = "Filled!";
                                    fillBtn.style.background = "#198754";
                                    setTimeout(() => {
                                      fillBtn.textContent = "Fill Auth Field";
                                      fillBtn.style.background = "#198754";
                                      fillBtn.disabled = false;
                                    }, 2000);
                                  }
                                } else {
                                  fillBtn.textContent = "Failed";
                                  fillBtn.style.background = "#c83232";
                                  setTimeout(() => {
                                    fillBtn.textContent = "Fill Auth Field";
                                    fillBtn.style.background = "#198754";
                                    fillBtn.disabled = false;
                                  }, 2000);
                                }
                              })
                              .catch((keyError) => {
                                console.error("Key retrieval error:", keyError);
                                fillBtn.textContent = "Error";
                                fillBtn.style.background = "#c83232";
                                setTimeout(() => {
                                  fillBtn.textContent = "Fill Auth Field";
                                  fillBtn.style.background = "#198754";
                                  fillBtn.disabled = false;
                                }, 2000);
                              });
                          });

                          apiKeysDiv.appendChild(keyItem);
                        });
                      } else {
                        // Full key retrieval disabled - show keys without fill buttons
                        const infoMsg = document.createElement("div");
                        infoMsg.style.cssText =
                          "color: #adb5bd; font-size: 11px; margin-bottom: 12px; text-align: center;";
                        infoMsg.textContent = `You have ${apiKeys.length} API key(s), but full key retrieval is disabled. Use temporary key generation below.`;
                        apiKeysDiv.appendChild(infoMsg);
                      }
                    }

                    // Add temporary key generation option if enabled
                    if (swaggerConfig.allow_temp_key_generation) {
                      const tempKeyDiv = document.createElement("div");
                      tempKeyDiv.style.cssText = `
                        background: #495057;
                        border: 1px solid #6c757d;
                        border-radius: 4px;
                        padding: 4px 4px;
                        margin-top: 12px;
                        text-align: center;
                      `;

                      const tempBtn = document.createElement("button");
                      tempBtn.textContent = "Generate Temp Key";
                      tempBtn.style.cssText = `
                        background: #6f42c1;
                        border: none;
                        color: #fff;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                      `;

                      tempKeyDiv.appendChild(tempBtn);

                      // Add temporary key generation functionality
                      tempBtn.addEventListener("click", () => {
                        tempBtn.textContent = "Generating...";
                        tempBtn.disabled = true;

                        fetch("/api/user-api-keys/temp", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                        })
                          .then((response) => response.json())
                          .then((result) => {
                            if (result.success && result.temp_key) {
                              const authInput =
                                document.querySelector("#auth-bearer-value");
                              if (authInput) {
                                // Clear field first, then fill - more robust for Swagger UI state management
                                authInput.value = "";
                                authInput.focus();

                                // Simulate typing for better compatibility
                                setTimeout(() => {
                                  const bearerToken = result.temp_key.key;

                                  // Use native setter to bypass React/framework state
                                  const nativeInputValueSetter =
                                    Object.getOwnPropertyDescriptor(
                                      window.HTMLInputElement.prototype,
                                      "value"
                                    ).set;
                                  nativeInputValueSetter.call(
                                    authInput,
                                    bearerToken
                                  );

                                  // Trigger comprehensive events
                                  const events = [
                                    "input",
                                    "change",
                                    "keyup",
                                    "keydown",
                                    "blur",
                                    "focus",
                                  ];
                                  events.forEach((eventType) => {
                                    authInput.dispatchEvent(
                                      new Event(eventType, { bubbles: true })
                                    );
                                  });

                                  // Additional React-specific events
                                  authInput.dispatchEvent(
                                    new InputEvent("input", {
                                      bubbles: true,
                                      data: bearerToken,
                                    })
                                  );

                                  // Force focus and selection to trigger validation
                                  authInput.focus();
                                  authInput.select();
                                  authInput.setSelectionRange(
                                    0,
                                    bearerToken.length
                                  );

                                  // Final blur to complete the input cycle
                                  setTimeout(() => {
                                    authInput.blur();
                                    authInput.focus();
                                  }, 50);
                                }, 50);

                                tempBtn.textContent = "Filled with Temp Key!";
                                tempBtn.style.background = "#198754";
                                setTimeout(() => {
                                  tempBtn.textContent = "Generate Temp Key";
                                  tempBtn.style.background = "#6f42c1";
                                  tempBtn.disabled = false;
                                }, 3000);
                              }
                            } else {
                              tempBtn.textContent = "Failed";
                              tempBtn.style.background = "#c83232";
                              setTimeout(() => {
                                tempBtn.textContent = "Generate Temp Key";
                                tempBtn.style.background = "#6f42c1";
                                tempBtn.disabled = false;
                              }, 2000);
                            }
                          })
                          .catch((tempError) => {
                            console.error(
                              "Temp key generation error:",
                              tempError
                            );
                            tempBtn.textContent = "Error";
                            tempBtn.style.background = "#c83232";
                            setTimeout(() => {
                              tempBtn.textContent = "Generate Temp Key";
                              tempBtn.style.background = "#6f42c1";
                              tempBtn.disabled = false;
                            }, 2000);
                          });
                      });

                      apiKeysDiv.appendChild(tempKeyDiv);
                    }

                    if (
                      apiKeys.length === 0 &&
                      !swaggerConfig.allow_temp_key_generation
                    ) {
                      const noKeysMsg = document.createElement("div");
                      noKeysMsg.style.cssText =
                        "color: #adb5bd; text-align: center; padding: 16px;";
                      noKeysMsg.textContent =
                        "No API keys available. Create keys in the API Keys page.";
                      apiKeysDiv.appendChild(noKeysMsg);
                    }

                    // Insert at the top of modal content
                    modalContent.insertBefore(
                      apiKeysDiv,
                      modalContent.firstChild
                    );
                  }
                })
                .catch((apiError) => {
                  console.error("Failed to fetch API keys:", apiError);
                });
            }
          }, 100);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};
