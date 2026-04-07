import { test, expect } from "bun:test";
import { OdooClient, OdooConfig, type Employee } from "../src/lib/odoo.ts";

// Helper to check if Odoo is configured
function isOdooConfigured(): boolean {
  return !!(
    process.env.ODOO_URL &&
    process.env.ODOO_DATABASE &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_PASSWORD
  );
}

test(
  "getEmployees - fetch all employees (with and without bank accounts)",
  async () => {
    if (!isOdooConfigured()) {
      console.log("⏭️  Skipping: Odoo environment variables not configured");
      return;
    }

    const config: OdooConfig = {
      url: process.env.ODOO_URL || "",
      database: process.env.ODOO_DATABASE || "",
      username: process.env.ODOO_USERNAME || "",
      password: process.env.ODOO_PASSWORD || "",
    };

    console.log("🔐 Authenticating with Odoo...");
    const odooClient = new OdooClient(config);
    const authenticated = await odooClient.authenticate();
    expect(authenticated).toBe(true);
    console.log("✓ Authentication successful");

    console.log("👥 Fetching employees...");
    const employees: Employee[] = await odooClient.getEmployees();
    console.log(`✓ Fetched ${employees.length} employees`);

    // The result should be an array
    expect(Array.isArray(employees)).toBe(true);

    // If there are no employees in this Odoo instance, that's fine
    if (employees.length === 0) {
      console.log("ℹ️  No employees found in this Odoo instance");
      return;
    }

    // Count employees with and without bank accounts
    const withBankAccounts = employees.filter((e) => e.bank_account_number);
    const withoutBankAccounts = employees.filter((e) => !e.bank_account_number);

    console.log(`\n📊 Employee breakdown:`);
    console.log(`   ✅ With bank accounts: ${withBankAccounts.length}`);
    console.log(`   ⚠️  Without bank accounts: ${withoutBankAccounts.length}`);

    // Test the structure of the first employee
    const firstEmployee = employees[0];
    console.log(
      `\n📋 First employee: ${firstEmployee.name} (ID: ${firstEmployee.id})`
    );
    console.log(
      `   Bank Account: ${firstEmployee.bank_account_number || "Not set"}`
    );

    // Verify the employee has required fields
    expect(typeof firstEmployee.id).toBe("number");
    expect(typeof firstEmployee.name).toBe("string");
    expect(firstEmployee.name.length).toBeGreaterThan(0);

    // bank_account_number can be undefined for employees without bank accounts
    if (firstEmployee.bank_account_number) {
      expect(typeof firstEmployee.bank_account_number).toBe("string");
      expect(firstEmployee.bank_account_number.length).toBeGreaterThan(0);

      // Check if the bank account number looks like an IBAN
      const bankAccount = firstEmployee.bank_account_number;
      console.log(`\n🔍 Validating bank account format...`);

      // Remove spaces for validation
      const cleanedAccount = bankAccount.replace(/\s/g, "");

      if (/^[A-Z]{2}\d{2}/.test(cleanedAccount)) {
        console.log("   ✓ Bank account appears to be in IBAN format");
        expect(cleanedAccount.length).toBeGreaterThanOrEqual(15);
        expect(cleanedAccount.length).toBeLessThanOrEqual(34);
      } else {
        console.log(
          "   ℹ️  Bank account is not in IBAN format (could be local format)"
        );
        expect(cleanedAccount.length).toBeGreaterThan(0);
      }
    }

    // Test all employees have the correct structure
    console.log(`\n✅ Validating all ${employees.length} employees...`);
    for (const employee of employees) {
      expect(typeof employee.id).toBe("number");
      expect(typeof employee.name).toBe("string");
      expect(employee.name.length).toBeGreaterThan(0);

      // bank_account_number can be undefined
      if (employee.bank_account_number !== undefined) {
        expect(typeof employee.bank_account_number).toBe("string");
      }
    }

    console.log(`✓ All employees have valid structure`);

    // Log summary
    console.log(`\n📊 Summary:`);
    console.log(`   Total employees: ${employees.length}`);
    console.log(`   Sample employees:`);
    employees.slice(0, 5).forEach((emp, idx) => {
      if (emp.bank_account_number) {
        const maskedAccount = emp.bank_account_number.replace(/\s/g, "");
        const masked =
          maskedAccount.length > 8
            ? `${maskedAccount.slice(0, 4)}...${maskedAccount.slice(-4)}`
            : "***";
        console.log(
          `     ${idx + 1}. ${emp.name} (ID: ${emp.id}) - ${masked}`
        );
      } else {
        console.log(
          `     ${idx + 1}. ${emp.name} (ID: ${emp.id}) - No bank account`
        );
      }
    });
    if (employees.length > 5) {
      console.log(`     ... and ${employees.length - 5} more`);
    }
  }
);

test(
  "getEmployees - handles Odoo instances without employees gracefully",
  async () => {
    if (!isOdooConfigured()) {
      console.log("⏭️  Skipping: Odoo environment variables not configured");
      return;
    }

    const config: OdooConfig = {
      url: process.env.ODOO_URL || "",
      database: process.env.ODOO_DATABASE || "",
      username: process.env.ODOO_USERNAME || "",
      password: process.env.ODOO_PASSWORD || "",
    };

    const odooClient = new OdooClient(config);
    const authenticated = await odooClient.authenticate();
    expect(authenticated).toBe(true);

    // This should not throw, even if there are no employees
    const employees = await odooClient.getEmployees();

    // Should return an array (empty or populated)
    expect(Array.isArray(employees)).toBe(true);

    // All employees should have valid structure (bank_account_number can be undefined)
    employees.forEach((employee) => {
      expect(typeof employee.id).toBe("number");
      expect(typeof employee.name).toBe("string");
      // bank_account_number is optional
      if (employee.bank_account_number !== undefined) {
        expect(typeof employee.bank_account_number).toBe("string");
      }
    });
  }
);

test("getEmployees - authentication required", async () => {
  if (!isOdooConfigured()) {
    console.log("⏭️  Skipping: Odoo environment variables not configured");
    return;
  }

  const config: OdooConfig = {
    url: process.env.ODOO_URL || "",
    database: process.env.ODOO_DATABASE || "",
    username: process.env.ODOO_USERNAME || "",
    password: process.env.ODOO_PASSWORD || "",
  };

  const odooClient = new OdooClient(config);

  // Try to fetch employees without authenticating first
  try {
    await odooClient.getEmployees();
    // If we get here, the test should fail
    expect(true).toBe(false); // Force failure
  } catch (error) {
    // Should throw an error about authentication
    expect(error).toBeDefined();
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toContain("authenticate");
  }
});
