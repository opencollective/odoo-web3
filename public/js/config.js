// Environment configuration
// Note: ENV values are injected by the server at runtime
export const ENV = {
  environment: "{{ENV}}" || "sandbox",
  odooDatabase: "{{ODOO_DATABASE}}" || "",
};

export const getStorageKey = (baseKey) => {
  return `${baseKey}_${ENV.environment}`;
};

