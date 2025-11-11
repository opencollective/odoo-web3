export interface JournalTransaction {
  id: number;
  name: string;
  date: string;
  ref: string;
  amount: number;
  debit: number;
  credit: number;
  account_id: [number, string];
  journal_id: [number, string];
  partner_id: [number, string] | false;
  description?: string;
}

export type BankAccountIdentifier = {
  standard: "iban" | "bic" | "accountNumber";
  iban?: string;
  bic?: string;
  accountNumber?: string;
};

export interface InvoiceLine {
  id: number;
  name: string;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
  product_id: [number, string] | false;
  account_id: [number, string] | false;
  tax_ids?: number[];
  discount?: number;
}

export interface Attachment {
  id: number;
  name: string;
  mimetype: string;
  file_size?: number;
  url: string;
  create_date?: string;
}

export interface Activity {
  id: number;
  activity_type_id: [number, string] | false;
  date_deadline: string;
  summary?: string;
  note?: string;
  user_id: [number, string] | false;
  state: "overdue" | "today" | "planned" | "done";
  create_date?: string;
}

export interface Message {
  id: number;
  body: string;
  author_id: [number, string] | false;
  date: string;
  message_type: "email" | "comment" | "notification";
  subtype_id?: [number, string] | false;
}

export interface Invoice {
  id: number;
  name: string;
  ref: string;
  date: string;
  invoice_date?: string;
  invoice_date_due?: string;
  state: "draft" | "posted" | "cancel";
  payment_state?:
    | "not_paid"
    | "in_payment"
    | "paid"
    | "partial"
    | "reversed"
    | "invoicing_legacy";
  move_type:
    | "out_invoice"
    | "in_invoice"
    | "out_refund"
    | "in_refund"
    | "entry";
  partner_id: [number, string] | false;
  partner_name?: string;
  amount_total: number;
  amount_residual: number;
  currency_id: [number, string] | false;
  partner_bank_id?: [number, string] | false;
  bank_account_number?: string;
  pdf_url: string;
  invoice_line_ids: InvoiceLine[];
  attachment_ids?: Attachment[];
}

export interface InvoiceDetails extends Invoice {
  invoice_origin?: string;
  invoice_payment_term_id?: [number, string] | false;
  fiscal_position_id?: [number, string] | false;
  invoice_user_id?: [number, string] | false;
  invoice_source_email?: string;
  narration?: string;
  amount_untaxed: number;
  amount_tax: number;
  attachments: Attachment[];
  activities: Activity[];
  messages: Message[];
  journal_id?: [number, string] | false;
}

export type InvoiceDirection = "all" | "incoming" | "outgoing";

export interface JournalEntry {
  ref: string;
  date: string;
  journal_id: number;
  line_ids: Array<{
    debit: number;
    credit: number;
    name: string;
    partner_id?: number;
  }>;
}

export type Account = {
  id: number;
  name: string;
  code: string;
};

// Partner interface based on Odoo's res.partner model
export interface Partner {
  // Basic identification
  id: number;
  name: string;
  display_name?: string;

  // Contact information
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;

  // Address information
  street?: string;
  street2?: string;
  city?: string;
  state_id?: [number, string] | false;
  country_id?: [number, string] | false;
  zip?: string;

  // Partner classification
  is_company: boolean;
  parent_id?: [number, string] | false;
  child_ids?: number[];
  category_id?: number[];

  // Business information
  vat?: string; // Tax ID/VAT number
  company_registry?: string;
  industry_id?: [number, string] | false;

  // Customer/Supplier flags
  customer_rank: number; // > 0 if customer
  supplier_rank: number; // > 0 if supplier

  // Financial information
  property_account_payable_id?: [number, string] | false;
  property_account_receivable_id?: [number, string] | false;
  property_payment_term_id?: [number, string] | false;
  property_supplier_payment_term_id?: [number, string] | false;

  // Additional contact details
  title?: [number, string] | false;
  function?: string; // Job position
  lang?: string; // Language code
  tz?: string; // Timezone

  // Commercial fields
  user_id?: [number, string] | false; // Salesperson
  team_id?: [number, string] | false; // Sales team

  // System fields
  active: boolean;
  create_date?: string;
  write_date?: string;
  create_uid?: [number, string] | false;
  write_uid?: [number, string] | false;

  // Image
  image_1920?: string; // Base64 encoded image
  image_128?: string;
  image_512?: string;

  // Bank accounts (related)
  bank_ids?: number[];

  // Additional fields that might be useful
  comment?: string; // Internal notes
  ref?: string; // Internal reference

  // Credit management
  credit_limit?: number;

  // Partner type (if using custom field)
  partner_type?: "customer" | "supplier" | "both" | "other";
}

// Simplified Partner interface for basic operations (matching your current usage)
export interface PartnerBasic {
  id: number;
  name: string;
  is_company?: boolean;
  customer_rank?: number;
  supplier_rank?: number;
  street?: string;
  email?: string;
  phone?: string;
  vat?: string;
}

// Partner creation data (for createPartner method)
export interface PartnerCreateData {
  name: string;
  is_company?: boolean;
  customer_rank?: number;
  supplier_rank?: number;
  property_account_receivable_id?: number;
  property_account_payable_id?: number;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  country_id?: number;
  state_id?: number;
  email?: string;
  phone?: string;
  mobile?: string;
  vat?: string;
  website?: string;
  category_id?: number[];
  parent_id?: number;
  title?: number;
  function?: string;
  lang?: string;
  comment?: string;
  ref?: string;
}

// Bank account interface based on Odoo's res.partner.bank model
export interface BankAccount {
  // Basic identification
  id: number;
  acc_number: string; // Account number/IBAN

  // Bank information
  bank_name?: string;
  bank_bic?: string; // Bank Identifier Code (SWIFT)

  // Account details
  acc_type?: "iban" | "bank" | "other"; // Account type
  acc_holder_name?: string; // Account holder name

  // Relations
  partner_id: [number, string] | false; // Owner of the account
  company_id?: [number, string] | false;
  currency_id?: [number, string] | false;

  // System fields
  active?: boolean;
  create_date?: string;
  write_date?: string;
  create_uid?: [number, string] | false;
  write_uid?: [number, string] | false;

  // Additional fields
  sequence?: number;
  allow_out_payment?: boolean;
}

// Bank account creation data (for createBankAccount method)
export interface BankAccountCreateData {
  acc_number: string;
  partner_id: number;
  acc_type?: "iban" | "bank" | "other";
  acc_holder_name?: string;
  bank_name?: string;
  bank_bic?: string;
  currency_id?: number;
  company_id?: number;
  active?: boolean;
  sequence?: number;
  allow_out_payment?: boolean;
}

// Journal interface based on Odoo's account.journal model
export interface Journal {
  // Basic identification
  id: number;
  name: string;
  code: string; // Short code for the journal

  // Journal type - defines the purpose and behavior
  type: "sale" | "purchase" | "cash" | "bank" | "general" | "situation";

  // Account configuration
  default_account_id?: [number, string] | false; // Default account for entries
  suspense_account_id?: [number, string] | false; // Suspense account
  profit_account_id?: [number, string] | false; // Profit account
  loss_account_id?: [number, string] | false; // Loss account

  // Bank-specific fields (for bank journals)
  bank_account_id?: [number, string] | false; // Related bank account
  bank_statements_source?: "undefined" | "file_import" | "online_sync";

  // Company and currency
  company_id?: [number, string] | false;
  currency_id?: [number, string] | false;

  // Sequence configuration
  sequence_id?: [number, string] | false;
  refund_sequence?: boolean;

  // Payment configuration
  inbound_payment_method_line_ids?: number[];
  outbound_payment_method_line_ids?: number[];

  // Additional settings
  active?: boolean;
  show_on_dashboard?: boolean;
  color?: number; // Color for dashboard display

  // Restrictions
  restrict_mode_hash_table?: boolean;

  // System fields
  create_date?: string;
  write_date?: string;
  create_uid?: [number, string] | false;
  write_uid?: [number, string] | false;
}

// Simplified Journal interface for basic operations (matching current usage)
export interface JournalBasic {
  id: number;
  name: string;
  type: "sale" | "purchase" | "cash" | "bank" | "general" | "situation";
  code: string;
}

// Journal creation data (for createJournal method)
export interface JournalCreateData {
  name: string;
  code: string;
  type: "sale" | "purchase" | "cash" | "bank" | "general" | "situation";
  company_id?: number;
  currency_id?: number;
  default_account_id?: number;
  bank_account_id?: number;
  active?: boolean;
  show_on_dashboard?: boolean;
  color?: number;
}

export type OdooConfig = {
  url: string;
  database: string;
  username: string;
  password: string;
};

export class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;
  private dryRun: boolean;

  constructor(config: OdooConfig, dryRun: boolean = false) {
    this.config = config;
    this.dryRun = dryRun;
  }

  private async callRPC(
    endpoint: string,
    method: string,
    params: unknown[]
  ): Promise<unknown> {
    // Use jsonrpc endpoint instead of xmlrpc
    const url = `${this.config.url}/jsonrpc`;

    const requestBody = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: endpoint,
        method: method,
        args: params,
      },
      id: 1,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`Odoo error: ${JSON.stringify(result.error)}`);
    }

    return result.result;
  }

  async authenticate(): Promise<boolean> {
    try {
      // Use 'login' method instead of 'authenticate' for JSON-RPC
      const result = await this.callRPC("common", "login", [
        this.config.database,
        this.config.username,
        this.config.password,
      ]);

      this.uid = result as number;
      return !!this.uid;
    } catch (error) {
      console.error("Authentication failed:", error);
      return false;
    }
  }

  async getLatestTransactions(
    journalId: number,
    limit: number = 10
  ): Promise<JournalTransaction[]> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "search_read",
        [[["journal_id", "=", journalId]]],
        {
          fields: [
            "id",
            "name",
            "date",
            "ref",
            "debit",
            "credit",
            "account_id",
            "journal_id",
            "partner_id",
            "name",
          ],
          order: "date desc, id desc",
          limit: limit,
        },
      ]);

      return (result as Record<string, unknown>[]).map(
        (item: Record<string, unknown>) => ({
          id: item.id as number,
          name: item.name as string,
          date: item.date as string,
          ref: (item.ref as string) || "",
          amount: (item.debit as number) - (item.credit as number),
          debit: item.debit as number,
          credit: item.credit as number,
          account_id: item.account_id as [number, string],
          journal_id: item.journal_id as [number, string],
          partner_id: item.partner_id as [number, string] | false,
          description: item.name as string,
        })
      );
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      throw error;
    }
  }

  async getJournals(): Promise<JournalBasic[]> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.journal",
        "search_read",
        [[]],
        {
          fields: ["id", "name", "type", "code"],
          order: "name",
        },
      ]);

      return (result as Record<string, unknown>[]).map(
        (item: Record<string, unknown>) => ({
          id: item.id as number,
          name: item.name as string,
          type: item.type as
            | "sale"
            | "purchase"
            | "cash"
            | "bank"
            | "general"
            | "situation",
          code: item.code as string,
        })
      );
    } catch (error) {
      console.error("Failed to fetch journals:", error);
      throw error;
    }
  }

  async getLatestInvoices(
    limit: number = 10,
    direction: InvoiceDirection = "all",
    since?: string,
    until?: string
  ): Promise<Invoice[]> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Helper function to parse date string
    const parseDate = (dateStr: string): string => {
      if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
        // Format: YYYYMMDD -> YYYY-MM-DD
        return `${dateStr.substring(0, 4)}-${dateStr.substring(
          4,
          6
        )}-${dateStr.substring(6, 8)}`;
      }
      // Assume it's already in YYYY-MM-DD format
      return dateStr;
    };

    // Build the move_type filter based on direction
    let moveTypes: string[];
    switch (direction) {
      case "incoming":
        moveTypes = ["in_invoice", "in_refund"];
        break;
      case "outgoing":
        moveTypes = ["out_invoice", "out_refund"];
        break;
      case "all":
      default:
        moveTypes = ["out_invoice", "in_invoice", "out_refund", "in_refund"];
        break;
    }

    // Build domain filters
    const domain: unknown[] = [["move_type", "in", moveTypes]];

    // Add date filters if provided (both are inclusive)
    // since: includes the entire day from 00:00:00
    if (since) {
      domain.push(["date", ">=", parseDate(since)]);
    }

    // until: includes the entire day until 23:59:59
    if (until) {
      domain.push(["date", "<=", parseDate(until)]);
    }

    try {
      // First, get the invoices
      const invoices = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [domain],
        {
          fields: [
            "id",
            "name",
            "ref",
            "date",
            "invoice_date",
            "invoice_date_due",
            "state",
            "payment_state",
            "move_type",
            "partner_id",
            "amount_total",
            "amount_residual",
            "currency_id",
            "partner_bank_id",
            "invoice_line_ids",
          ],
          order: "date desc, id desc",
          limit: limit,
        },
      ]);

      const invoiceList = invoices as Record<string, unknown>[];

      // Collect all line IDs from all invoices
      const allLineIds: number[] = [];
      invoiceList.forEach((inv) => {
        const lineIds = inv.invoice_line_ids as number[] | undefined;
        if (lineIds && Array.isArray(lineIds)) {
          allLineIds.push(...lineIds);
        }
      });

      // Fetch all invoice lines in one query
      let invoiceLines: Record<number, InvoiceLine> = {};
      if (allLineIds.length > 0) {
        const linesResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.move.line",
          "search_read",
          [[["id", "in", allLineIds]]],
          {
            fields: [
              "id",
              "name",
              "quantity",
              "price_unit",
              "price_subtotal",
              "price_total",
              "product_id",
              "account_id",
              "tax_ids",
              "discount",
            ],
          },
        ]);

        invoiceLines = (linesResult as Record<string, unknown>[]).reduce<
          Record<number, InvoiceLine>
        >((acc, line) => {
          acc[line.id as number] = {
            id: line.id as number,
            name: line.name as string,
            quantity: line.quantity as number,
            price_unit: line.price_unit as number,
            price_subtotal: line.price_subtotal as number,
            price_total: line.price_total as number,
            product_id: line.product_id as [number, string] | false,
            account_id: line.account_id as [number, string] | false,
            tax_ids: line.tax_ids as number[] | undefined,
            discount: line.discount as number | undefined,
          };
          return acc;
        }, {});
      }

      // Get unique partner_bank_ids to fetch bank account numbers
      const bankIds = invoiceList
        .map((inv) => inv.partner_bank_id)
        .filter((id) => id && Array.isArray(id))
        .map((id) => (id as [number, string])[0]);

      const uniqueBankIds = [...new Set(bankIds)];

      // Fetch bank account details if there are any
      let bankAccounts: Record<number, string> = {};
      if (uniqueBankIds.length > 0) {
        const bankAccountsResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "search_read",
          [[["id", "in", uniqueBankIds]]],
          {
            fields: ["id", "acc_number"],
          },
        ]);

        bankAccounts = (bankAccountsResult as Record<string, unknown>[]).reduce<
          Record<number, string>
        >((acc, bank) => {
          acc[bank.id as number] = bank.acc_number as string;
          return acc;
        }, {});
      }

      // Fetch all attachments for all invoices
      const allInvoiceIds = invoiceList.map((inv) => inv.id as number);

      const pdfAttachments: Record<number, string> = {};
      const allAttachments: Record<number, Attachment[]> = {};

      if (allInvoiceIds.length > 0) {
        const attachmentsResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "ir.attachment",
          "search_read",
          [
            [
              ["res_model", "=", "account.move"],
              ["res_id", "in", allInvoiceIds],
            ],
          ],
          {
            fields: [
              "id",
              "res_id",
              "name",
              "mimetype",
              "file_size",
              "create_date",
            ],
            order: "res_id, id desc",
          },
        ]);

        const attachmentsList = attachmentsResult as Record<string, unknown>[];

        // Build map of all attachments per invoice
        attachmentsList.forEach((attachment) => {
          const resId = attachment.res_id as number;
          const attachmentId = attachment.id as number;
          const mimetype = attachment.mimetype as string;

          const attachmentObj: Attachment = {
            id: attachmentId,
            name: attachment.name as string,
            mimetype: mimetype,
            file_size: attachment.file_size as number | undefined,
            url: `${this.config.url}/web/content/${attachmentId}`,
            create_date: attachment.create_date as string | undefined,
          };

          if (!allAttachments[resId]) {
            allAttachments[resId] = [];
          }
          allAttachments[resId].push(attachmentObj);

          // Track first PDF attachment for incoming invoices (for pdf_url backwards compatibility)
          if (mimetype === "application/pdf" && !pdfAttachments[resId]) {
            pdfAttachments[resId] = attachmentObj.url;
          }
        });
      }

      // Map the results to Invoice interface
      return invoiceList.map((item: Record<string, unknown>) => {
        const partnerBankId = item.partner_bank_id as [number, string] | false;
        const moveType = item.move_type as string;
        const invoiceId = item.id as number;

        // Only include bank account number for supplier invoices (in_invoice, in_refund)
        // For customer invoices (out_invoice, out_refund), partner_bank_id is the company's account
        const isSupplierInvoice =
          moveType === "in_invoice" || moveType === "in_refund";
        const bankAccountNumber =
          isSupplierInvoice && partnerBankId && Array.isArray(partnerBankId)
            ? bankAccounts[partnerBankId[0]]
            : undefined;

        // Generate PDF URL for the invoice
        // For incoming invoices (supplier bills), use the attached PDF
        // For outgoing invoices (customer invoices), use the generated report
        const pdfUrl = isSupplierInvoice
          ? pdfAttachments[invoiceId] ||
            `${this.config.url}/report/pdf/account.report_invoice/${invoiceId}`
          : `${this.config.url}/report/pdf/account.report_invoice/${invoiceId}`;

        // Get line items for this invoice
        const lineIds = (item.invoice_line_ids as number[]) || [];
        const lines: InvoiceLine[] = lineIds
          .map((lineId) => invoiceLines[lineId])
          .filter((line) => line !== undefined);

        // Get attachments for this invoice
        const invoiceAttachments = allAttachments[invoiceId] || [];

        return {
          id: invoiceId,
          name: item.name as string,
          ref: (item.ref as string) || "",
          date: item.date as string,
          invoice_date: item.invoice_date as string | undefined,
          invoice_date_due: item.invoice_date_due as string | undefined,
          state: item.state as "draft" | "posted" | "cancel",
          payment_state: item.payment_state as
            | "not_paid"
            | "in_payment"
            | "paid"
            | "partial"
            | "reversed"
            | "invoicing_legacy"
            | undefined,
          move_type: item.move_type as
            | "out_invoice"
            | "in_invoice"
            | "out_refund"
            | "in_refund"
            | "entry",
          partner_id: item.partner_id as [number, string] | false,
          partner_name: Array.isArray(item.partner_id)
            ? (item.partner_id as [number, string])[1]
            : undefined,
          amount_total: item.amount_total as number,
          amount_residual: item.amount_residual as number,
          currency_id: item.currency_id as [number, string] | false,
          partner_bank_id: partnerBankId,
          bank_account_number: bankAccountNumber,
          pdf_url: pdfUrl,
          invoice_line_ids: lines,
          attachment_ids:
            invoiceAttachments.length > 0 ? invoiceAttachments : undefined,
        };
      });
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      throw error;
    }
  }

  async getInvoiceDetails(invoiceId: number): Promise<InvoiceDetails> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // Fetch the invoice details
      const invoiceResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [[["id", "=", invoiceId]]],
        {
          fields: [
            "id",
            "name",
            "ref",
            "date",
            "invoice_date",
            "invoice_date_due",
            "state",
            "payment_state",
            "move_type",
            "partner_id",
            "amount_total",
            "amount_residual",
            "amount_untaxed",
            "amount_tax",
            "currency_id",
            "partner_bank_id",
            "invoice_line_ids",
            "invoice_origin",
            "invoice_payment_term_id",
            "fiscal_position_id",
            "invoice_user_id",
            "invoice_source_email",
            "narration",
            "journal_id",
          ],
        },
      ]);

      const invoiceList = invoiceResult as Record<string, unknown>[];
      if (invoiceList.length === 0) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoice = invoiceList[0];

      // Fetch invoice line items
      const lineIds = (invoice.invoice_line_ids as number[]) || [];
      let invoiceLines: InvoiceLine[] = [];

      if (lineIds.length > 0) {
        const linesResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.move.line",
          "search_read",
          [[["id", "in", lineIds]]],
          {
            fields: [
              "id",
              "name",
              "quantity",
              "price_unit",
              "price_subtotal",
              "price_total",
              "product_id",
              "account_id",
              "tax_ids",
              "discount",
            ],
          },
        ]);

        invoiceLines = (linesResult as Record<string, unknown>[]).map(
          (line) => ({
            id: line.id as number,
            name: line.name as string,
            quantity: line.quantity as number,
            price_unit: line.price_unit as number,
            price_subtotal: line.price_subtotal as number,
            price_total: line.price_total as number,
            product_id: line.product_id as [number, string] | false,
            account_id: line.account_id as [number, string] | false,
            tax_ids: line.tax_ids as number[] | undefined,
            discount: line.discount as number | undefined,
          })
        );
      }

      // Fetch bank account if present
      const partnerBankId = invoice.partner_bank_id as [number, string] | false;
      let bankAccountNumber: string | undefined;

      if (partnerBankId && Array.isArray(partnerBankId)) {
        const bankResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "search_read",
          [[["id", "=", partnerBankId[0]]]],
          {
            fields: ["acc_number"],
          },
        ]);

        const bankList = bankResult as Record<string, unknown>[];
        if (bankList.length > 0) {
          bankAccountNumber = bankList[0].acc_number as string;
        }
      }

      // Fetch all attachments
      const attachmentsResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "ir.attachment",
        "search_read",
        [
          [
            ["res_model", "=", "account.move"],
            ["res_id", "=", invoiceId],
          ],
        ],
        {
          fields: ["id", "name", "mimetype", "file_size", "create_date"],
          order: "create_date desc",
        },
      ]);

      const attachments: Attachment[] = (
        attachmentsResult as Record<string, unknown>[]
      ).map((att) => ({
        id: att.id as number,
        name: att.name as string,
        mimetype: att.mimetype as string,
        file_size: att.file_size as number | undefined,
        url: `${this.config.url}/web/content/${att.id}`,
        create_date: att.create_date as string | undefined,
      }));

      // Fetch activities
      const activitiesResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "mail.activity",
        "search_read",
        [
          [
            ["res_model", "=", "account.move"],
            ["res_id", "=", invoiceId],
          ],
        ],
        {
          fields: [
            "id",
            "activity_type_id",
            "date_deadline",
            "summary",
            "note",
            "user_id",
            "state",
            "create_date",
          ],
          order: "date_deadline asc",
        },
      ]);

      const activities: Activity[] = (
        activitiesResult as Record<string, unknown>[]
      ).map((act) => ({
        id: act.id as number,
        activity_type_id: act.activity_type_id as [number, string] | false,
        date_deadline: act.date_deadline as string,
        summary: act.summary as string | undefined,
        note: act.note as string | undefined,
        user_id: act.user_id as [number, string] | false,
        state: act.state as "overdue" | "today" | "planned" | "done",
        create_date: act.create_date as string | undefined,
      }));

      // Fetch messages/chatter
      const messagesResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "mail.message",
        "search_read",
        [
          [
            ["model", "=", "account.move"],
            ["res_id", "=", invoiceId],
          ],
        ],
        {
          fields: [
            "id",
            "body",
            "author_id",
            "date",
            "message_type",
            "subtype_id",
          ],
          order: "date desc",
          limit: 50,
        },
      ]);

      const messages: Message[] = (
        messagesResult as Record<string, unknown>[]
      ).map((msg) => ({
        id: msg.id as number,
        body: msg.body as string,
        author_id: msg.author_id as [number, string] | false,
        date: msg.date as string,
        message_type: msg.message_type as "email" | "comment" | "notification",
        subtype_id: msg.subtype_id as [number, string] | false,
      }));

      // Determine PDF URL
      const moveType = invoice.move_type as string;
      const isSupplierInvoice =
        moveType === "in_invoice" || moveType === "in_refund";

      const pdfAttachment = attachments.find(
        (att) => att.mimetype === "application/pdf"
      );
      const pdfUrl =
        isSupplierInvoice && pdfAttachment
          ? pdfAttachment.url
          : `${this.config.url}/report/pdf/account.report_invoice/${invoiceId}`;

      // Only include bank account for supplier invoices
      const finalBankAccountNumber = isSupplierInvoice
        ? bankAccountNumber
        : undefined;

      return {
        id: invoiceId,
        name: invoice.name as string,
        ref: (invoice.ref as string) || "",
        date: invoice.date as string,
        invoice_date: invoice.invoice_date as string | undefined,
        invoice_date_due: invoice.invoice_date_due as string | undefined,
        state: invoice.state as "draft" | "posted" | "cancel",
        payment_state: invoice.payment_state as
          | "not_paid"
          | "in_payment"
          | "paid"
          | "partial"
          | "reversed"
          | "invoicing_legacy"
          | undefined,
        move_type: invoice.move_type as
          | "out_invoice"
          | "in_invoice"
          | "out_refund"
          | "in_refund"
          | "entry",
        partner_id: invoice.partner_id as [number, string] | false,
        partner_name: Array.isArray(invoice.partner_id)
          ? (invoice.partner_id as [number, string])[1]
          : undefined,
        amount_total: invoice.amount_total as number,
        amount_residual: invoice.amount_residual as number,
        amount_untaxed: invoice.amount_untaxed as number,
        amount_tax: invoice.amount_tax as number,
        currency_id: invoice.currency_id as [number, string] | false,
        partner_bank_id: partnerBankId,
        bank_account_number: finalBankAccountNumber,
        pdf_url: pdfUrl,
        invoice_line_ids: invoiceLines,
        invoice_origin: invoice.invoice_origin as string | undefined,
        invoice_payment_term_id: invoice.invoice_payment_term_id as
          | [number, string]
          | false
          | undefined,
        fiscal_position_id: invoice.fiscal_position_id as
          | [number, string]
          | false
          | undefined,
        invoice_user_id: invoice.invoice_user_id as
          | [number, string]
          | false
          | undefined,
        invoice_source_email: invoice.invoice_source_email as
          | string
          | undefined,
        narration: invoice.narration as string | undefined,
        journal_id: invoice.journal_id as [number, string] | false | undefined,
        attachments: attachments,
        activities: activities,
        messages: messages,
      };
    } catch (error) {
      console.error("Failed to fetch invoice details:", error);
      throw error;
    }
  }

  async checkJournalEntryExists(ref: string): Promise<boolean> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [[["ref", "=", ref]]],
        {
          fields: ["id", "name", "ref", "date", "journal_id", "line_ids"],
        },
      ]);

      console.log("Check journal entry exists:", result);

      return (result as unknown[]).length > 0;
    } catch (error) {
      console.error("Failed to check for existing journal entry:", error);
      // If we can't check, assume it exists to be safe
      return true;
    }
  }

  async createJournalEntry(entry: JournalEntry): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would create journal entry: ${entry.ref} with ${entry.line_ids.length} lines`
      );
      return 999999; // Return fake ID for dry run
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "create",
        [
          {
            ref: entry.ref,
            date: entry.date,
            journal_id: entry.journal_id,
            line_ids: entry.line_ids.map((line) => [
              0,
              0,
              {
                debit: line.debit,
                credit: line.credit,
                name: line.name,
                partner_id: line.partner_id,
              },
            ]),
          },
        ],
      ]);

      return result as number;
    } catch (error) {
      console.error("Failed to create journal entry:", error);
      throw error;
    }
  }

  async getAccountIdByName(accountName: string): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.account",
        "search_read",
        [[["name", "ilike", accountName]]],
        {
          fields: ["id", "name", "code"],
          limit: 1,
        },
      ]);

      return (result as Record<string, unknown>[]).length > 0
        ? ((result as Record<string, unknown>[])[0].id as number)
        : null;
    } catch (error) {
      console.error("Failed to find account:", error);
      return null;
    }
  }

  async getPartnerIdByBankIdentifier(
    identifier: BankAccountIdentifier
  ): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const identifierString =
      identifier.iban || `${identifier.bic}:${identifier.accountNumber}`;

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "search_read",
        [[["acc_number", "ilike", identifierString]]],
        {
          fields: ["id", "partner_id"],
          limit: 1,
        },
      ]);

      return (result as Record<string, unknown>[]).length > 0
        ? ((result as Record<string, unknown>[])[0].partner_id as number)
        : null;
    } catch (error) {
      console.error("Failed to find partner:", error);
      return null;
    }
  }
  async getPartnerIdByName(partnerName: string): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner",
        "search_read",
        [[["name", "ilike", partnerName]]],
        {
          fields: ["id", "name"],
          limit: 1,
        },
      ]);

      return (result as Record<string, unknown>[]).length > 0
        ? ((result as Record<string, unknown>[])[0].id as number)
        : null;
    } catch (error) {
      console.error("Failed to find partner:", error);
      return null;
    }
  }

  async postJournalEntry(moveId: number): Promise<boolean> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(`[DRY RUN] Would post journal entry: ${moveId}`);
      return true;
    }

    try {
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "action_post",
        [[moveId]],
      ]);

      return true;
    } catch (error) {
      console.error("Failed to post journal entry:", error);
      return false;
    }
  }

  async getAccounts(): Promise<Array<Account>> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.account",
        "search_read",
        [[]],
        {
          fields: ["id", "name", "code", "account_type"],
          order: "code",
        },
      ]);

      return (result as Record<string, unknown>[])
        .filter(
          (item: Record<string, unknown>) =>
            ![
              "view",
              "asset_fixed",
              "liability_non_current",
              "equity",
              "liability_current",
              "asset_current",
              "expense",
              "expense_other",
            ].includes(item.account_type as string)
        )
        .map((item: Record<string, unknown>) => ({
          id: item.id as number,
          name: item.name as string,
          code: item.code as string,
          type: item.account_type as string,
        }));
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
      throw error;
    }
  }

  async findBankAccountByIdentifier(
    bankAccountIdentifier: BankAccountIdentifier
  ): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const identifierString =
      bankAccountIdentifier.iban ||
      `${bankAccountIdentifier.bic}:${bankAccountIdentifier.accountNumber}`;

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank", // Bank account model
        "search_read",
        [[["acc_number", "=", identifierString]]], // Search by IBAN
        {
          fields: ["id", "acc_number", "partner_id"],
        },
      ]);

      if ((result as Record<string, unknown>[]).length > 0) {
        return (result as Record<string, unknown>[])[0].id as number;
      }
      return null;
    } catch (error) {
      console.error(
        `Failed to find bank account for IBAN ${identifierString}:`,
        error
      );
      return null;
    }
  }

  async createPartner(
    partnerName: string,
    address?: string,
    receivableAccountId?: number,
    payableAccountId?: number
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would create partner: ${partnerName}${
          address ? ` (${address})` : ""
        }`
      );
      return 999999; // Return fake ID for dry run
    }

    try {
      const partnerData: PartnerCreateData = {
        name: partnerName,
        is_company: false, // Default to individual, can be overridden
        customer_rank: 1, // Mark as customer
        supplier_rank: 0, // Not a supplier by default
      };

      if (address) {
        partnerData.street = address;
      }

      if (receivableAccountId) {
        partnerData.property_account_receivable_id = receivableAccountId;
      }

      if (payableAccountId) {
        partnerData.property_account_payable_id = payableAccountId;
      }

      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner",
        "create",
        [partnerData],
      ]);

      console.log(`Created new partner: ${partnerName} (ID: ${result})`);
      return result as number;
    } catch (error) {
      console.error(`Failed to create partner ${partnerName}:`, error);
      throw error;
    }
  }

  async createBankAccount(
    iban: string,
    partnerId: number,
    accountName?: string
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would create bank account: ${iban} for partner ${partnerId}${
          accountName ? ` (${accountName})` : ""
        }`
      );
      return 888888; // Return fake ID for dry run
    }

    try {
      const bankData: BankAccountCreateData = {
        acc_number: iban,
        partner_id: partnerId,
        acc_type: "iban", // Specify account type as IBAN
      };

      if (accountName) {
        bankData.acc_holder_name = accountName;
      }

      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "create",
        [bankData],
      ]);

      console.log(`Created new bank account for IBAN: ${iban} (ID: ${result})`);
      return result as number;
    } catch (error) {
      console.error(`Failed to create bank account for IBAN ${iban}:`, error);
      throw error;
    }
  }
  // Enhanced method that finds or creates bank account with partner
  async findOrCreateBankAccount(
    bankAccountIdentifier: BankAccountIdentifier,
    partnerName: string,
    partnerAddress?: string
  ): Promise<number> {
    const identifierString =
      bankAccountIdentifier.iban ||
      `${bankAccountIdentifier.bic}:${bankAccountIdentifier.accountNumber}`;
    let bankAccountId = await this.findBankAccountByIdentifier(
      bankAccountIdentifier
    );

    if (bankAccountId) {
      return bankAccountId;
    }

    // If not found, we need to create both partner and bank account
    console.log(
      `IBAN ${identifierString} not found. Creating new partner and bank account...`
    );

    // Find or create partner
    let partnerId = await this.getPartnerIdByName(partnerName);
    if (!partnerId) {
      partnerId = await this.createPartner(partnerName, partnerAddress);
    }

    // Create bank account
    bankAccountId = await this.createBankAccount(
      identifierString,
      partnerId,
      partnerName
    );

    return bankAccountId;
  }
}
