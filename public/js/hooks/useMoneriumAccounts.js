// React is available as a global
const { useState, useEffect } = window.React;
import { getStorageKey } from "../config.js";
import { ENV } from "../config.js";
import { validateAccounts } from "../utils/validation.js";

// Hook to load and validate Monerium accounts
export const useMoneriumAccounts = (wallet) => {
  const [availableAccounts, setAvailableAccounts] = useState([]);

  // Load Monerium accounts once when connection is available
  useEffect(() => {
    const loadAccounts = async () => {
      const storedConnection = localStorage.getItem(
        getStorageKey("monerium_connection")
      );
      if (!storedConnection) {
        setAvailableAccounts([]);
        return;
      }

      try {
        const connection = JSON.parse(storedConnection);
        if (!connection?.accessToken) {
          setAvailableAccounts([]);
          return;
        }

        // Check if token is expired
        if (connection.expiresAt && Date.now() >= connection.expiresAt) {
          console.log("⏰ Token expired, clearing connection");
          localStorage.removeItem(getStorageKey("monerium_connection"));
          localStorage.removeItem(getStorageKey("monerium_oauth"));
          window.dispatchEvent(new Event("monerium-connection-updated"));
          setAvailableAccounts([]);
          return;
        }

        const response = await fetch("/api/monerium/addresses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: connection.accessToken,
            environment: connection.environment || "sandbox",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const accounts = Array.isArray(data) ? data : [];
          // Validate accounts with current wallet/server address
          const signerAddress =
            wallet?.walletAddress || ENV.serverWalletAddress;
          const validatedAccounts = validateAccounts(
            accounts,
            signerAddress
          );
          setAvailableAccounts(validatedAccounts);
        } else {
          setAvailableAccounts([]);
        }
      } catch (err) {
        console.error("Failed to load Monerium accounts:", err);
        setAvailableAccounts([]);
      }
    };

    loadAccounts();
  }, []);

  // Re-validate accounts when wallet address changes
  useEffect(() => {
    if (availableAccounts.length > 0) {
      const signerAddress =
        wallet?.walletAddress || ENV.serverWalletAddress;
      // Get raw accounts without validation props
      const rawAccounts = availableAccounts.map(
        ({ usable, validationError, ...acc }) => acc
      );
      const validatedAccounts = validateAccounts(rawAccounts, signerAddress);
      setAvailableAccounts(validatedAccounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.walletAddress]);

  return availableAccounts;
};

