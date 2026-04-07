// React is available as a global
const { useState, useEffect } = window.React;

// Wallet connection hook for MetaMask + server-side signer fallback
export const useWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [serverSignerAddress, setServerSignerAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch server-side signer address (available after keystore unlock)
  useEffect(() => {
    fetch("/api/monerium/signer-address")
      .then((r) => r.json())
      .then((data) => {
        if (data.address) {
          setServerSignerAddress(data.address);
        }
      })
      .catch(() => {
        // Server key not available -- WalletConnect only
      });
  }, []);

  useEffect(() => {
    // Check if already connected on page load
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        })
        .catch(console.error);
    }

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress(null);
        }
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Ethereum wallet to continue.");
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      alert("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const signMessage = async (message) => {
    if (!window.ethereum || !walletAddress) {
      throw new Error("Wallet not connected");
    }

    try {
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, walletAddress],
      });
      return signature;
    } catch (err) {
      console.error("Failed to sign message:", err);
      throw new Error("Failed to sign message with wallet");
    }
  };

  // Browser wallet takes precedence, server signer is fallback
  const signerAddress = walletAddress || serverSignerAddress;

  return {
    walletAddress,
    signerAddress,
    isConnecting,
    connectWallet,
    signMessage,
  };
};
