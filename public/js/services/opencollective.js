import { getOpenCollectiveApiKey } from "../utils/storage.js";

// Open Collective GraphQL service

/**
 * Test the API connection by fetching the current user's profile
 */
export const testConnection = async (apiKey = null) => {
  const key = apiKey || getOpenCollectiveApiKey();
  if (!key) {
    throw new Error("No Open Collective API key configured");
  }

  const response = await fetch("/api/opencollective/test", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-oc-api-key": key,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to test connection");
  }

  return data.me;
};

/**
 * Fetch expenses for a collective
 * @param {string} slug - The collective slug
 * @param {Object} options - Query options
 * @param {number} options.limit - Max expenses to return (default 50)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @param {string} options.status - Filter by status (PENDING, APPROVED, PAID, etc.)
 * @returns {Object} { expenses, account, statusCounts }
 */
export const fetchExpenses = async (slug, { limit = 50, offset = 0, status = null } = {}) => {
  const apiKey = getOpenCollectiveApiKey();
  if (!apiKey) {
    throw new Error("No Open Collective API key configured");
  }

  const params = new URLSearchParams({
    slug,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  const response = await fetch(`/api/opencollective/expenses?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-oc-api-key": apiKey,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch expenses");
  }

  // Extract status counts
  const statusCounts = {
    all: data.all?.totalCount || 0,
    pending: data.pending?.totalCount || 0,
    approved: data.approved?.totalCount || 0,
    paid: data.paid?.totalCount || 0,
    rejected: data.rejected?.totalCount || 0,
    processing: data.processing?.totalCount || 0,
  };

  return {
    expenses: data.expenses,
    account: data.account,
    statusCounts,
  };
};

/**
 * Mark an expense as paid on Open Collective
 * @param {string} expenseId - The expense GraphQL ID (e.g., "expense-123abc")
 * @param {number} amount - The amount in cents
 */
export const markExpenseAsPaid = async (expenseId, amount) => {
  const apiKey = getOpenCollectiveApiKey();
  if (!apiKey) {
    throw new Error("No Open Collective API key configured");
  }

  const response = await fetch("/api/opencollective/mark-paid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-oc-api-key": apiKey,
    },
    body: JSON.stringify({ expenseId, amount }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to mark expense as paid");
  }

  return data.processExpense;
};

/**
 * Get the IBAN from an expense's payout method
 * @param {Object} expense - The expense object
 * @returns {string|null} - The IBAN or null if not available
 */
export const getExpenseIBAN = (expense) => {
  if (!expense?.payoutMethod) {
    return null;
  }

  let data = expense.payoutMethod.data;

  // Handle case where data might be a JSON string
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  if (!data) {
    return null;
  }

  const type = expense.payoutMethod.type;

  // BANK_ACCOUNT type - try various field names
  if (type === "BANK_ACCOUNT") {
    // Direct IBAN fields
    if (data.iban) return data.iban;
    if (data.IBAN) return data.IBAN;
    if (data.accountNumber) return data.accountNumber;

    // Nested in details (Wise/TransferWise structure)
    if (data.details?.iban) return data.details.iban;
    if (data.details?.IBAN) return data.details.IBAN;
    if (data.details?.accountNumber) return data.details.accountNumber;

    // Account holder details
    if (data.accountHolderName && data.iban) return data.iban;

    return null;
  }

  // OTHER type might also have bank details
  if (type === "OTHER" && data.content) {
    // Sometimes IBAN is in a text field
    const ibanMatch = data.content.match(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/);
    if (ibanMatch) return ibanMatch[0];
  }

  return null;
};

/**
 * Get the account holder name and type from an expense's payout method
 * @param {Object} expense - The expense object
 * @returns {{ name: string, type: "individual" | "company" } | null}
 */
export const getExpenseAccountHolder = (expense) => {
  if (!expense?.payoutMethod) return null;

  let data = expense.payoutMethod.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  if (!data) return null;

  // Account holder name may be at the top level or nested in details (Wise/TransferWise)
  const name = data.accountHolderName || data.details?.accountHolderName || null;
  if (!name) return null;

  // Determine if individual or company from legalType when available
  const legalType = data.legalType || data.details?.legalType;
  const type = legalType === "BUSINESS" ? "company" : "individual";

  return { name, type };
};

/**
 * Get address info from an expense's payout method data
 * @param {Object} expense - The expense object
 * @returns {{ street: string, city: string, postCode: string, country: string } | null}
 */
export const getExpensePayoutAddress = (expense) => {
  if (!expense?.payoutMethod) return null;

  let data = expense.payoutMethod.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  if (!data) return null;

  // Address may be at top level or nested in details (Wise/TransferWise)
  const addr = data.address || data.details?.address || {};
  const street = addr.firstLine || addr.street || addr.addressLine1 || null;
  const city = addr.city || null;
  const postCode = addr.postCode || addr.postalCode || addr.zip || null;
  const country = addr.country || addr.countryCode || null;

  if (!street && !city) return null;
  return { street, city, postCode, country };
};

/**
 * Get the BIC/SWIFT code from an expense's payout method
 * @param {Object} expense - The expense object
 * @returns {string|null}
 */
export const getExpenseBIC = (expense) => {
  if (!expense?.payoutMethod) return null;

  let data = expense.payoutMethod.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return null; }
  }
  if (!data) return null;

  return data.BIC || data.bic || data.details?.BIC || data.details?.bic || null;
};

/**
 * Get the email from an expense's payout method data or payee
 * @param {Object} expense - The expense object
 * @returns {string|null}
 */
export const getExpensePayoutEmail = (expense) => {
  // First try the payee email (from Individual inline fragment)
  if (expense?.payee?.email) return expense.payee.email;

  // Then try the payout method data
  if (!expense?.payoutMethod) return null;
  let data = expense.payoutMethod.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return null; }
  }
  if (!data) return null;

  return data.email || data.details?.email || null;
};

/**
 * Check if an expense can be paid via bank transfer
 * @param {Object} expense - The expense object
 * @returns {boolean}
 */
export const canPayExpense = (expense) => {
  if (!expense) return false;

  // Must be APPROVED status
  if (expense.status !== "APPROVED") return false;

  // Try to extract IBAN - this handles various payout method types
  const iban = getExpenseIBAN(expense);
  return Boolean(iban);
};

/**
 * Format expense amount with currency
 * @param {Object} expense - The expense object
 * @returns {string}
 */
export const formatExpenseAmount = (expense) => {
  if (!expense?.amount) return "N/A";

  const amount = expense.amount / 100; // Cents to main unit
  const currency = expense.currency || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
};

/**
 * Get status badge color class
 * @param {string} status - The expense status
 * @returns {string} - Tailwind CSS classes
 */
export const getStatusColor = (status) => {
  const colors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    PAID: "bg-blue-100 text-blue-800",
    REJECTED: "bg-red-100 text-red-800",
    PROCESSING: "bg-purple-100 text-purple-800",
    ERROR: "bg-red-100 text-red-800",
    SCHEDULED_FOR_PAYMENT: "bg-indigo-100 text-indigo-800",
    SPAM: "bg-gray-100 text-gray-800",
    DRAFT: "bg-gray-100 text-gray-800",
    UNVERIFIED: "bg-orange-100 text-orange-800",
    INCOMPLETE: "bg-orange-100 text-orange-800",
    CANCELED: "bg-gray-100 text-gray-800",
  };

  return colors[status] || "bg-gray-100 text-gray-800";
};

/**
 * Fetch all expenses across all collectives hosted by a fiscal host
 * @param {Object} options - Query options
 * @param {string} options.hostSlug - The fiscal host slug (default: "citizenspring-asbl")
 * @param {number} options.limit - Max expenses to return (default 50)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @param {string} options.status - Filter by status (PENDING, APPROVED, PAID, etc.)
 * @returns {Object} { host, expenses, statusCounts }
 */
export const fetchHostExpenses = async ({ hostSlug = "citizenspring-asbl", limit = 50, offset = 0, status = null } = {}) => {
  const apiKey = getOpenCollectiveApiKey();
  if (!apiKey) {
    throw new Error("No Open Collective API key configured");
  }

  const params = new URLSearchParams({
    hostSlug,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  const response = await fetch(`/api/opencollective/host-expenses?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-oc-api-key": apiKey,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch host expenses");
  }

  const statusCounts = {
    all: data.all?.totalCount || 0,
    pending: data.pending?.totalCount || 0,
    approved: data.approved?.totalCount || 0,
    paid: data.paid?.totalCount || 0,
    rejected: data.rejected?.totalCount || 0,
    processing: data.processing?.totalCount || 0,
  };

  return {
    host: data.host,
    expenses: data.expenses,
    statusCounts,
  };
};

/**
 * Fetch hosted collectives
 * @param {Object} options - Query options
 * @param {string} options.hostSlug - The fiscal host slug (default: "citizenspring-asbl")
 * @param {number} options.limit - Max collectives to return (default 100)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @returns {Object} { host, collectives }
 */
export const fetchHostedCollectives = async ({ hostSlug = "citizenspring-asbl", limit = 100, offset = 0 } = {}) => {
  const apiKey = getOpenCollectiveApiKey();
  if (!apiKey) {
    throw new Error("No Open Collective API key configured");
  }

  const params = new URLSearchParams({
    hostSlug,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/opencollective/collectives?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-oc-api-key": apiKey,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch collectives");
  }

  return {
    host: data.host,
    collectives: data.host?.hostedCollectives?.nodes || [],
    totalCount: data.host?.hostedCollectives?.totalCount || 0,
  };
};
