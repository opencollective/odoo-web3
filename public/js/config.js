// Environment configuration
// Note: ENV values are injected by the server at runtime
export const ENV = {
  environment: "{{ENV}}" || "sandbox",
  serverWalletAddress: "{{SERVER_WALLET_ADDRESS}}" || "",
};

export const getStorageKey = (baseKey) => {
  return `${baseKey}_${ENV.environment}`;
};

