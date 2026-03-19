// CSV parsing and validation utilities for batch payments

/**
 * Parse CSV text into an array of objects
 * Handles quoted values, commas in quotes, empty lines
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== "string") {
    throw new Error("CSV text is required");
  }

  const lines = csvText.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Validate required headers
  const requiredHeaders = ["name", "type", "iban", "amount"];
  const missingHeaders = requiredHeaders.filter(
    (h) => !headers.map((h) => h.toLowerCase()).includes(h)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(", ")}. Required columns are: ${requiredHeaders.join(
        ", "
      )}, description (optional)`
    );
  }

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    try {
      const values = parseCSVLine(line);

      if (values.length !== headers.length) {
        throw new Error(
          `Column count mismatch: expected ${headers.length}, got ${values.length}`
        );
      }

      const row = {};
      headers.forEach((header, index) => {
        row[header.toLowerCase()] = values[index];
      });

      rows.push(row);
    } catch (error) {
      throw new Error(
        `Error parsing line ${i + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (rows.length === 0) {
    throw new Error("CSV has no data rows");
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values and commas within quotes
 */
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Push last field
  values.push(current.trim());

  return values;
}

/**
 * Validate a single payment row
 * Returns { valid: boolean, errors: string[] }
 */
export function validatePaymentRow(row, index) {
  const errors = [];

  // Validate name
  if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
    errors.push("name is required");
  } else if (row.name.length > 100) {
    errors.push("name must be 100 characters or less");
  }

  // Validate type
  if (!row.type || typeof row.type !== "string") {
    errors.push("type is required");
  } else {
    const typeValue = row.type.toLowerCase().trim();
    if (!["organisation", "individual"].includes(typeValue)) {
      errors.push('type must be "organisation" or "individual"');
    }
  }

  // Validate IBAN
  if (!row.iban || typeof row.iban !== "string" || !row.iban.trim()) {
    errors.push("iban is required");
  } else {
    const iban = row.iban.replace(/\s/g, "");
    // Basic IBAN validation: 2 letters + 2 digits + up to 30 alphanumeric
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/i;
    if (!ibanRegex.test(iban)) {
      errors.push(
        "iban must be a valid format (e.g., DE89370400440532013000)"
      );
    }
  }

  // Validate amount
  if (!row.amount) {
    errors.push("amount is required");
  } else {
    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push("amount must be a positive number");
    }
  }

  // Validate description (optional)
  if (row.description && row.description.length > 140) {
    errors.push("description must be 140 characters or less");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an array of payment rows
 * Returns { valid: boolean, payments: Payment[], errors: Map<number, string[]> }
 */
export function validateBatchPayments(rows) {
  const errors = new Map();
  const payments = [];

  rows.forEach((row, index) => {
    const validation = validatePaymentRow(row, index);

    if (!validation.valid) {
      errors.set(index, validation.errors);
    } else {
      // Normalize payment data
      payments.push({
        name: row.name.trim(),
        type: row.type.toLowerCase().trim(),
        iban: row.iban.replace(/\s/g, ""),
        amount: parseFloat(row.amount),
        description: (row.description || "").trim(),
      });
    }
  });

  return {
    valid: errors.size === 0,
    payments,
    errors,
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors) {
  const messages = [];
  errors.forEach((errorList, index) => {
    messages.push(`Row ${index + 1}: ${errorList.join(", ")}`);
  });
  return messages.join("\n");
}

/**
 * Generate a sample CSV for download/display
 */
export function generateSampleCSV() {
  return `name,type,iban,amount,description
"Acme Corp",organisation,DE89370400440532013000,1234.56,"Invoice INV-2024-001"
"John Doe",individual,FR1420041010050500013M02606,500.00,"Expense reimbursement"
"Tech Solutions Ltd",organisation,GB82WEST12345698765432,750.25,"Consulting services"`;
}

/**
 * Convert batch results to CSV for download
 */
export function resultsToCsv(results) {
  const header = "index,name,amount,status,orderId,error\n";
  const rows = results
    .map((r) => {
      return [
        r.index,
        `"${r.name}"`,
        r.amount,
        r.status,
        r.orderId || "",
        r.error ? `"${r.error.replace(/"/g, '""')}"` : "",
      ].join(",");
    })
    .join("\n");

  return header + rows;
}
