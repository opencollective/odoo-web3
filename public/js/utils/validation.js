import { formatAddress } from "./format.js";

// Validation utilities for Monerium accounts

export const getSafeUrl = (address, chain) => {
  const chainPrefix =
    chain === "gnosis" ? "gno" : chain === "chiado" ? "chiado" : "gno";
  return `https://app.safe.global/settings/setup?safe=${chainPrefix}:${address}`;
};

export const validateAccounts = (accounts, signerAddress) => {
  if (!signerAddress) {
    console.log(">>> validateAccounts signerAddress missing", signerAddress);
    return accounts.map((acc) => ({
      ...acc,
      usable: false,
      validationError: null,
    }));
  }
  if (!Array.isArray(accounts)) {
    console.log(">>> validateAccounts accounts is not a valid array", accounts);
    return accounts.map((acc) => ({
      ...acc,
      usable: false,
      validationError: null,
    }));
  }

  return accounts.map((account) => {
    const normalizedAccountAddress = account.address.toLowerCase();
    const normalizedSignerAddress = signerAddress.toLowerCase();

    // Check if signer address matches the account address
    if (normalizedAccountAddress === normalizedSignerAddress) {
      return { ...account, usable: true, validationError: null };
    }

    // Check if the account is a Safe with signer as signatory
    console.log(
      ">>> validateAccounts account.signatories",
      account.signatories
    );
    console.log(
      ">>> validateAccounts normalizedSignerAddress",
      normalizedSignerAddress
    );
    if (account.signatories && Array.isArray(account.signatories)) {
      const hasSignerAsSignatory = account.signatories.some(
        (signatory) => signatory.toLowerCase() === normalizedSignerAddress
      );
      if (hasSignerAsSignatory) {
        return { ...account, usable: true, validationError: null };
      }
    }

    // Invalid - return error with Safe link
    const chainPrefix =
      account.chain === "gnosis"
        ? "gno"
        : account.chain === "chiado"
        ? "chiado"
        : "gno";
    const safeUrl = `https://app.safe.global/settings/setup?safe=${chainPrefix}:${account.address}`;
    const signerDisplay = formatAddress(signerAddress);
    return {
      ...account,
      usable: false,
      validationError: {
        message: `The address (${signerDisplay}) is not the owner or a signatory of this account.`,
        safeUrl: safeUrl,
      },
    };
  });
};
