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
  move_id?: [number, string] | false;
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

export type ExpenseReportStatus =
  | "draft"
  | "submit"
  | "approve"
  | "post"
  | "done"
  | "cancel"
  | string;

export type ExpenseReportPaymentStatus =
  | "not_paid"
  | "in_payment"
  | "paid"
  | "partial"
  | "reversed"
  | "unknown"
  | string;

export interface ExpenseReportExpense {
  id: number;
  date?: string;
  description: string;
  amount: number;
  attachment?: Attachment;
}

export interface ExpenseReport {
  id: number;
  title: string;
  employee_id: [number, string] | false;
  employee_name?: string;
  bank_account_number?: string;
  total_amount: number;
  status: ExpenseReportStatus;
  payment_status?: ExpenseReportPaymentStatus;
  expenses: ExpenseReportExpense[];
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
    account_id?: number;
  }>;
}

export type Account = {
  id: number;
  name: string;
  code: string;
};

// Employee interface for dropdown
export interface Employee {
  id: number;
  name: string;
  bank_account_number?: string;
}

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
        "account.bank.statement.line",
        "search_read",
        [[["statement_id.journal_id", "=", journalId]]],
        {
          fields: [
            "id",
            "date",
            "payment_ref",
            "narration",
            "amount",
            "partner_id",
            "statement_id",
            "journal_id",
          ],
          order: "date desc, id desc",
          limit: limit,
        },
      ]);

      return (result as Record<string, unknown>[]).map(
        (item: Record<string, unknown>) => {
          const statement = item.statement_id as [number, string] | false;
          const journal =
            statement && Array.isArray(statement)
              ? null
              : (item.journal_id as [number, string] | false);

          // Get journal_id from statement if not directly available
          let journalIdField: [number, string];
          if (journal && Array.isArray(journal)) {
            journalIdField = journal;
          } else if (statement && Array.isArray(statement)) {
            // We'd need to fetch the statement to get journal_id, but for now use the provided journalId
            journalIdField = [journalId, ""];
          } else {
            journalIdField = [journalId, ""];
          }

          const amount = (item.amount as number) || 0;
          return {
            id: item.id as number,
            name:
              (item.payment_ref as string) || (item.narration as string) || "",
            date: item.date as string,
            ref: (item.payment_ref as string) || "",
            amount: amount,
            debit: amount > 0 ? amount : 0,
            credit: amount < 0 ? Math.abs(amount) : 0,
            account_id: [0, ""] as [number, string], // Bank statement lines don't have account_id directly
            journal_id: journalIdField,
            partner_id: item.partner_id as [number, string] | false,
            description:
              (item.narration as string) || (item.payment_ref as string) || "",
          };
        }
      );
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      throw error;
    }
  }

  /**
   * Get reconciliation data for bank statement lines, including linked invoice details.
   * Returns txHash → invoice info map for reconciled lines.
   */
  async getReconciledInvoicesByTxHash(): Promise<Map<string, {
    invoiceId: number;
    invoiceName: string;
    partnerName: string;
    amountTotal: number;
    pdfUrl: string | null;
    attachments: Array<{ id: number; name: string; mimetype: string }>;
  }>> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Step 1: Get all reconciled statement lines with their move_id
    const lines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["is_reconciled", "=", true]]],
      { fields: ["id", "unique_import_id", "move_id"], limit: 5000 },
    ]) as Array<{ id: number; unique_import_id: string | false; move_id: [number, string] | false }>;

    // Build txHash → statementLine mapping
    const txHashToLine = new Map<string, { lineId: number; moveId: number }>();
    for (const line of lines) {
      if (!line.unique_import_id || !line.move_id) continue;
      const parts = line.unique_import_id.toLowerCase().split(":");
      if (parts.length >= 3 && parts[2].startsWith("0x")) {
        txHashToLine.set(parts[2], { lineId: line.id, moveId: line.move_id[0] });
      }
    }

    if (txHashToLine.size === 0) return new Map();

    // Step 2: Find reconciled payable/receivable move lines on statement moves
    const stmtMoveIds = [...new Set([...txHashToLine.values()].map(v => v.moveId))];
    const moveLines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move.line",
      "search_read",
      [[
        ["move_id", "in", stmtMoveIds],
        ["account_type", "in", ["asset_receivable", "liability_payable"]],
        ["reconciled", "=", true],
      ]],
      { fields: ["move_id", "full_reconcile_id"] },
    ]) as Array<{ move_id: [number, string]; full_reconcile_id: [number, string] | false }>;

    // Map stmtMoveId → reconcile group ID
    const moveToReconcileId = new Map<number, number>();
    const reconcileIds: number[] = [];
    for (const ml of moveLines) {
      if (ml.full_reconcile_id) {
        moveToReconcileId.set(ml.move_id[0], ml.full_reconcile_id[0]);
        reconcileIds.push(ml.full_reconcile_id[0]);
      }
    }

    if (reconcileIds.length === 0) return new Map();

    // Step 3: Find the counterpart move lines in each reconciliation group
    const counterpartLines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move.line",
      "search_read",
      [[
        ["full_reconcile_id", "in", [...new Set(reconcileIds)]],
        ["move_id", "not in", stmtMoveIds],
      ]],
      { fields: ["move_id", "full_reconcile_id"] },
    ]) as Array<{ move_id: [number, string]; full_reconcile_id: [number, string] }>;

    // Collect candidate move IDs (dedup)
    const candidateMoveIds = [...new Set(counterpartLines.map(cl => cl.move_id[0]))];
    if (candidateMoveIds.length === 0) return new Map();

    // Step 4: Fetch invoice details — filter to actual invoices (in_invoice/out_invoice)
    const invoices = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move",
      "search_read",
      [[
        ["id", "in", candidateMoveIds],
        ["move_type", "in", ["in_invoice", "out_invoice"]],
      ]],
      { fields: ["id", "name", "partner_id", "amount_total"] },
    ]) as Array<{ id: number; name: string; partner_id: [number, string] | false; amount_total: number }>;

    const invoiceIdSet = new Set(invoices.map(inv => inv.id));

    // Map reconcileId → invoiceId (only for actual invoices)
    const reconcileToInvoiceId = new Map<number, number>();
    for (const cl of counterpartLines) {
      if (invoiceIdSet.has(cl.move_id[0])) {
        reconcileToInvoiceId.set(cl.full_reconcile_id[0], cl.move_id[0]);
      }
    }

    const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));

    // Step 5: Fetch attachments for these invoices
    const attachments = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "ir.attachment",
      "search_read",
      [[
        ["res_model", "=", "account.move"],
        ["res_id", "in", [...invoiceIdSet]],
      ]],
      { fields: ["id", "name", "mimetype", "res_id"] },
    ]) as Array<{ id: number; name: string; mimetype: string; res_id: number }>;

    // Group attachments by invoice
    const attachmentsByInvoice = new Map<number, Array<{ id: number; name: string; mimetype: string }>>();
    for (const att of attachments) {
      if (!attachmentsByInvoice.has(att.res_id)) attachmentsByInvoice.set(att.res_id, []);
      attachmentsByInvoice.get(att.res_id)!.push({ id: att.id, name: att.name, mimetype: att.mimetype });
    }

    // Step 6: Build the final txHash → invoice info map
    const result = new Map<string, {
      invoiceId: number;
      invoiceName: string;
      partnerName: string;
      amountTotal: number;
      pdfUrl: string | null;
      attachments: Array<{ id: number; name: string; mimetype: string }>;
    }>();

    for (const [txHash, { moveId }] of txHashToLine) {
      const reconcileId = moveToReconcileId.get(moveId);
      if (!reconcileId) continue;
      const invoiceId = reconcileToInvoiceId.get(reconcileId);
      if (!invoiceId) continue;
      const invoice = invoiceMap.get(invoiceId);
      if (!invoice) continue;

      const invAttachments = attachmentsByInvoice.get(invoiceId) || [];
      const pdfAttachment = invAttachments.find(a => a.mimetype === "application/pdf");

      result.set(txHash, {
        invoiceId: invoice.id,
        invoiceName: invoice.name,
        partnerName: invoice.partner_id ? invoice.partner_id[1] : "",
        amountTotal: invoice.amount_total,
        pdfUrl: pdfAttachment
          ? `${this.config.url}/web/content/${pdfAttachment.id}/${encodeURIComponent(pdfAttachment.name)}`
          : null,
        attachments: invAttachments,
      });
    }

    return result;
  }

  /**
   * Get reconciliation status for bank statement lines.
   * Returns two sets: reconciledImportIds (full unique_import_id) and reconciledTxHashes
   * (extracted tx hashes from unique_import_ids in format chain:address:txHash:logIndex).
   */
  async getReconciledImportIds(): Promise<{ importIds: Set<string>; txHashes: Set<string> }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["is_reconciled", "=", true]]],
      {
        fields: ["unique_import_id"],
        limit: 5000,
      },
    ]) as Array<{ unique_import_id: string | false }>;

    const importIds = new Set<string>();
    const txHashes = new Set<string>();
    for (const line of result) {
      if (line.unique_import_id) {
        const uid = line.unique_import_id.toLowerCase();
        importIds.add(uid);
        // Extract tx hash from format: chain:address:txHash:logIndex
        const parts = uid.split(":");
        if (parts.length >= 3 && parts[2].startsWith("0x")) {
          txHashes.add(parts[2]);
        }
      }
    }
    return { importIds, txHashes };
  }

  /**
   * Find a bank statement line by its transaction hash.
   * The unique_import_id format is chain:address:txHash:logIndex.
   */
  async findStatementLineByTxHash(
    txHash: string
  ): Promise<{ id: number; amount: number; payment_ref: string | false; partner_id: [number, string] | false; is_reconciled: boolean } | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["unique_import_id", "ilike", txHash.toLowerCase()]]],
      {
        fields: ["id", "amount", "payment_ref", "partner_id", "is_reconciled"],
        limit: 1,
      },
    ]) as Array<{
      id: number;
      amount: number;
      payment_ref: string | false;
      partner_id: [number, string] | false;
      is_reconciled: boolean;
    }>;

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Find invoices matching a given amount and type.
   * For received amounts (positive), search customer invoices (out_invoice).
   * For sent amounts (negative), search vendor bills (in_invoice).
   */
  async findMatchingInvoicesByAmount(
    amount: number,
    iban?: string,
    memo?: string
  ): Promise<Array<{
    id: number;
    name: string;
    ref: string | false;
    partner_id: [number, string] | false;
    amount_total: number;
    amount_residual: number;
    payment_state: string;
    date: string;
    invoice_date: string;
  }>> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const resultType = {
      id: 0,
      name: "",
      ref: false as string | false,
      partner_id: false as [number, string] | false,
      amount_total: 0,
      amount_residual: 0,
      payment_state: "",
      date: "",
      invoice_date: "",
    };
    type InvoiceResult = typeof resultType;

    const fields = [
      "id", "name", "ref", "partner_id",
      "amount_total", "amount_residual",
      "payment_state", "date", "invoice_date",
    ];

    // Extract invoice reference from memo (e.g. "CHB/2026/00204")
    const refMatch = memo?.match(/([A-Z][A-Z0-9]*\/2[0-9]{3}\/[0-9]{3,5})/);
    if (refMatch) {
      const ref = refMatch[1];
      const memoResults = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [[
          ["state", "=", "posted"],
          "|",
          ["name", "=", ref],
          ["ref", "=", ref],
        ]],
        { fields, limit: 5, order: "date desc" },
      ]) as InvoiceResult[];

      if (memoResults.length > 0) {
        return memoResults;
      }
    }

    const absAmount = Math.abs(amount);
    // Negative amount = outgoing payment = vendor bill; Positive = incoming = customer invoice
    const moveType = amount < 0 ? "in_invoice" : "out_invoice";

    const baseDomain: unknown[][] = [
      ["state", "=", "posted"],
      ["move_type", "=", moveType],
      ["amount_total", ">=", absAmount - 0.01],
      ["amount_total", "<=", absAmount + 0.01],
    ];

    const searchInvoices = async (domain: unknown[][]) => {
      return await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [domain],
        { fields, limit: 20, order: "date desc" },
      ]) as InvoiceResult[];
    };

    // If IBAN provided, try with partner filter first for more precise matching
    if (iban) {
      const normalizedIban = iban.replace(/\s/g, "");
      try {
        const bankResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "search_read",
          [[["acc_number", "in", [normalizedIban, iban]]]],
          { fields: ["id", "partner_id"] },
        ]) as Array<{ id: number; partner_id: [number, string] | false }>;

        const partnerIds = bankResult
          .filter((b) => b.partner_id)
          .map((b) => (b.partner_id as [number, string])[0]);

        if (partnerIds.length > 0) {
          const withIban = await searchInvoices([
            ...baseDomain,
            ["partner_id", "in", partnerIds],
          ]);
          if (withIban.length > 0) return withIban;
        }
      } catch {
        // Continue without IBAN filter
      }
    }

    // Fall back to amount-only search
    return searchInvoices(baseDomain);
  }

  /**
   * Get payment/reconciliation info for paid invoices.
   * Returns the journal name, date, and move name of the payment that settled each invoice.
   */
  async getInvoicePaymentInfo(
    invoiceIds: number[]
  ): Promise<
    Map<
      number,
      { journalName: string; date: string; moveName: string }
    >
  > {
    if (!this.uid || invoiceIds.length === 0)
      return new Map();

    const result = new Map<
      number,
      { journalName: string; date: string; moveName: string }
    >();

    // Find reconciled payable/receivable lines on these invoices
    const moveLines = (await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move.line",
      "search_read",
      [[
        ["move_id", "in", invoiceIds],
        ["account_type", "in", ["asset_receivable", "liability_payable"]],
        ["reconciled", "=", true],
      ]],
      { fields: ["id", "move_id", "full_reconcile_id"] },
    ])) as Array<{
      id: number;
      move_id: [number, string];
      full_reconcile_id: [number, string] | false;
    }>;

    // Collect reconcile group IDs
    const reconcileIds: number[] = [];
    const invoiceToReconcile = new Map<number, number>();
    for (const ml of moveLines) {
      if (ml.full_reconcile_id) {
        const rid = ml.full_reconcile_id[0];
        reconcileIds.push(rid);
        invoiceToReconcile.set(ml.move_id[0], rid);
      }
    }

    if (reconcileIds.length === 0) return result;

    // Find the counterpart lines in each reconciliation group (the payment lines, not the invoice lines)
    const counterpartLines = (await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move.line",
      "search_read",
      [[
        ["full_reconcile_id", "in", reconcileIds],
        ["move_id", "not in", invoiceIds],
      ]],
      { fields: ["id", "move_id", "journal_id", "date", "full_reconcile_id"] },
    ])) as Array<{
      id: number;
      move_id: [number, string];
      journal_id: [number, string];
      date: string;
      full_reconcile_id: [number, string];
    }>;

    // Build a map from reconcile_id to payment info
    const reconcileToPayment = new Map<
      number,
      { journalName: string; date: string; moveName: string }
    >();
    for (const cl of counterpartLines) {
      reconcileToPayment.set(cl.full_reconcile_id[0], {
        journalName: cl.journal_id[1],
        date: cl.date,
        moveName: cl.move_id[1],
      });
    }

    // Map back to invoice IDs
    for (const [invoiceId, reconcileId] of invoiceToReconcile) {
      const payment = reconcileToPayment.get(reconcileId);
      if (payment) {
        result.set(invoiceId, payment);
      }
    }

    return result;
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
    limit: number = 100,
    direction: InvoiceDirection = "all",
    since?: string,
    until?: string,
    options?: { state?: string; paymentState?: string }
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

    // Add state filter (e.g. "posted" to exclude draft/cancelled)
    if (options?.state) {
      domain.push(["state", "=", options.state]);
    }

    // Add payment_state filter (e.g. "not_paid" to exclude already paid)
    if (options?.paymentState) {
      domain.push(["payment_state", "=", options.paymentState]);
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

  async getExpenseReports(limit: number = 10): Promise<ExpenseReport[]> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const sheetsResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "hr.expense.sheet",
        "search_read",
        [[]],
        {
          fields: [
            "id",
            "name",
            "employee_id",
            "total_amount",
            "state",
            // Depending on Odoo version, payment_state may exist on sheet or not
            "payment_state",
            "account_move_id",
            "expense_line_ids",
          ],
          order: "create_date desc, id desc",
          limit,
        },
      ]);

      const sheetList = sheetsResult as Record<string, unknown>[];
      if (sheetList.length === 0) return [];

      const employeeIds = [
        ...new Set(
          sheetList
            .map((s) => s.employee_id)
            .filter((v) => v && Array.isArray(v))
            .map((v) => (v as [number, string])[0])
        ),
      ];

      // Read employees to get bank account relation (field name varies across Odoo versions)
      type EmployeeInfo = { name?: string; bankId?: number };
      const employeeInfoById: Record<number, EmployeeInfo> = {};
      if (employeeIds.length > 0) {
        const readEmployees = async (
          fields: string[]
        ): Promise<Record<string, unknown>[]> => {
          return (await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "hr.employee",
            "read",
            [[...employeeIds]],
            { fields },
          ])) as Record<string, unknown>[];
        };

        // Try field names across Odoo versions:
        // v19+: primary_bank_account_id, v16-v18: private_bank_account_id, older: bank_account_id
        const bankFieldCandidates = [
          "primary_bank_account_id",
          "private_bank_account_id",
          "bank_account_id",
        ];

        let employees: Record<string, unknown>[] = [];
        for (const field of bankFieldCandidates) {
          try {
            employees = await readEmployees(["id", "name", field]);
            break;
          } catch (_error) {
            continue;
          }
        }
        if (employees.length === 0) {
          employees = await readEmployees(["id", "name"]);
        }

        for (const emp of employees) {
          const id = emp.id as number;
          const name = emp.name as string | undefined;
          const bankId = (() => {
            for (const field of bankFieldCandidates) {
              const val = emp[field] as [number, string] | false | undefined;
              if (val && Array.isArray(val)) return val[0];
            }
            return undefined;
          })();

          employeeInfoById[id] = { name, bankId };
        }
      }

      const bankIds = [
        ...new Set(
          Object.values(employeeInfoById)
            .map((e) => e.bankId)
            .filter((v): v is number => typeof v === "number")
        ),
      ];

      const bankAccountNumberById: Record<number, string> = {};
      if (bankIds.length > 0) {
        const banksResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "read",
          [[...bankIds]],
          { fields: ["id", "acc_number"] },
        ]);

        for (const bank of banksResult as Record<string, unknown>[]) {
          bankAccountNumberById[bank.id as number] = bank.acc_number as string;
        }
      }

      const allExpenseIds: number[] = [];
      for (const sheet of sheetList) {
        const ids = sheet.expense_line_ids as number[] | undefined;
        if (ids && Array.isArray(ids)) {
          allExpenseIds.push(...ids);
        }
      }
      const uniqueExpenseIds = [...new Set(allExpenseIds)];

      // Fetch expenses
      const expensesById: Record<number, Record<string, unknown>> = {};
      if (uniqueExpenseIds.length > 0) {
        const expensesResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "hr.expense",
          "read",
          [[...uniqueExpenseIds]],
          { fields: ["id", "date", "name", "total_amount"] },
        ]);

        for (const exp of expensesResult as Record<string, unknown>[]) {
          expensesById[exp.id as number] = exp;
        }
      }

      // Fetch attachments for expenses (pick latest per expense)
      const attachmentByExpenseId: Record<number, Attachment> = {};
      if (uniqueExpenseIds.length > 0) {
        const attachmentsResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "ir.attachment",
          "search_read",
          [
            [
              ["res_model", "=", "hr.expense"],
              ["res_id", "in", uniqueExpenseIds],
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

        for (const att of attachmentsResult as Record<string, unknown>[]) {
          const expenseId = att.res_id as number;
          if (attachmentByExpenseId[expenseId]) continue;

          const attachmentId = att.id as number;
          attachmentByExpenseId[expenseId] = {
            id: attachmentId,
            name: att.name as string,
            mimetype: att.mimetype as string,
            file_size: att.file_size as number | undefined,
            url: `${this.config.url}/web/content/${attachmentId}`,
            create_date: att.create_date as string | undefined,
          };
        }
      }

      // Payment status fallback via account_move_id if sheet.payment_state missing
      const moveIds = [
        ...new Set(
          sheetList
            .map((s) => s.account_move_id)
            .filter((v) => v && Array.isArray(v))
            .map((v) => (v as [number, string])[0])
        ),
      ];

      const paymentStateByMoveId: Record<number, string> = {};
      if (moveIds.length > 0) {
        try {
          const movesResult = await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "account.move",
            "read",
            [[...moveIds]],
            { fields: ["id", "payment_state"] },
          ]);

          for (const mv of movesResult as Record<string, unknown>[]) {
            const mvId = mv.id as number;
            const ps = mv.payment_state as string | undefined;
            if (ps) paymentStateByMoveId[mvId] = ps;
          }
        } catch (_error) {
          // Ignore if payment_state is not available in the Odoo version
        }
      }

      // Build result
      return sheetList.map((sheet) => {
        const sheetId = sheet.id as number;
        const employee = sheet.employee_id as [number, string] | false;
        const employeeId =
          employee && Array.isArray(employee) ? employee[0] : null;
        const employeeName =
          (employeeId && employeeInfoById[employeeId]?.name) ||
          (employee && Array.isArray(employee) ? employee[1] : undefined);

        const employeeBankId = employeeId
          ? employeeInfoById[employeeId]?.bankId
          : undefined;
        const bankAccountNumber =
          employeeBankId != null
            ? bankAccountNumberById[employeeBankId]
            : undefined;

        const expenseIds = (sheet.expense_line_ids as number[]) || [];
        // With exactOptionalPropertyTypes, avoid setting optional fields to `undefined` explicitly
        const expenses: ExpenseReportExpense[] = [];
        for (const id of expenseIds) {
          const exp = expensesById[id];
          if (!exp) continue;

          const date = exp.date as string | undefined;
          const attachment = attachmentByExpenseId[id];

          const expense: ExpenseReportExpense = {
            id,
            description: (exp.name as string) || "",
            amount: (exp.total_amount as number) || 0,
            ...(attachment ? { attachment } : {}),
            ...(date ? { date } : {}),
          };

          expenses.push(expense);
        }

        const paymentStatusFromSheet = sheet.payment_state as
          | string
          | undefined;
        const accountMove = sheet.account_move_id as
          | [number, string]
          | false
          | undefined;
        const moveId =
          accountMove && Array.isArray(accountMove)
            ? accountMove[0]
            : undefined;
        const paymentStatus =
          paymentStatusFromSheet ||
          (moveId != null ? paymentStateByMoveId[moveId] : undefined);

        return {
          id: sheetId,
          title: (sheet.name as string) || "",
          employee_id: employee,
          employee_name: employeeName,
          bank_account_number: bankAccountNumber,
          total_amount: (sheet.total_amount as number) || 0,
          status: (sheet.state as string) || "unknown",
          payment_status: paymentStatus,
          expenses,
        };
      });
    } catch (error) {
      console.error("Failed to fetch expense reports:", error);
      throw error;
    }
  }

  async getEmployees(): Promise<Employee[]> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // Helper function to read employees with different field names
      const readEmployees = async (
        fields: string[]
      ): Promise<Record<string, unknown>[]> => {
        return (await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "hr.employee",
          "search_read",
          [[["active", "=", true]]],
          { fields, order: "name" },
        ])) as Record<string, unknown>[];
      };

      // Try field names across Odoo versions:
      // v19+: primary_bank_account_id (many2one)
      // v16-v18: private_bank_account_id (many2one)
      // older: bank_account_id (many2one)
      const bankFieldCandidates = [
        "primary_bank_account_id",
        "private_bank_account_id",
        "bank_account_id",
      ];

      let employees: Record<string, unknown>[] = [];
      for (const field of bankFieldCandidates) {
        try {
          employees = await readEmployees(["id", "name", field]);
          break;
        } catch (_error) {
          continue;
        }
      }
      if (employees.length === 0) {
        // Last resort: no bank field available
        employees = await readEmployees(["id", "name"]);
      }

      // Collect bank account IDs
      const bankIds: number[] = [];
      const employeeInfoById: Record<
        number,
        { name: string; bankId?: number }
      > = {};

      for (const emp of employees) {
        const id = emp.id as number;
        const name = emp.name as string;
        // Check all possible field names
        const bankId = (() => {
          for (const field of bankFieldCandidates) {
            const val = emp[field] as [number, string] | false | undefined;
            if (val && Array.isArray(val)) return val[0];
          }
          return undefined;
        })();

        employeeInfoById[id] = { name, bankId };
        if (bankId) {
          bankIds.push(bankId);
        }
      }

      // Fetch bank account numbers
      const bankAccountNumberById: Record<number, string> = {};
      if (bankIds.length > 0) {
        console.log(`🏦 Fetching bank accounts for ${bankIds.length} bank IDs:`, bankIds);
        const banksResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "read",
          [[...new Set(bankIds)]],
          { fields: ["id", "acc_number"] },
        ]);

        console.log(`🏦 Bank accounts fetched:`, banksResult);

        for (const bank of banksResult as Record<string, unknown>[]) {
          bankAccountNumberById[bank.id as number] = bank.acc_number as string;
        }
      } else {
        console.log("⚠️ No bank IDs found for employees");
      }

      // Build result - only include employees with bank accounts
      const allEmployeesData = employees.map((emp) => {
        const id = emp.id as number;
        const info = employeeInfoById[id];
        const bankAccountNumber = info.bankId
          ? bankAccountNumberById[info.bankId]
          : undefined;

        return {
          id,
          name: info.name,
          bank_account_number: bankAccountNumber,
        };
      });

      console.log(`📊 All employees (${allEmployeesData.length}):`, allEmployeesData);

      const employeesWithBankAccounts = allEmployeesData.filter(
        (emp) => emp.bank_account_number
      );

      console.log(
        `✅ Employees with bank accounts (${employeesWithBankAccounts.length}):`,
        employeesWithBankAccounts
      );
      console.log(
        `⚠️ Employees without bank accounts (${allEmployeesData.length - employeesWithBankAccounts.length}):`,
        allEmployeesData.filter((emp) => !emp.bank_account_number)
      );

      // Return all employees, not just those with bank accounts
      return allEmployeesData;
    } catch (error) {
      console.error("Failed to fetch employees:", error);
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
            line_ids: entry.line_ids.map((line) => {
              const lineData: Record<string, unknown> = {
                debit: line.debit,
                credit: line.credit,
                name: line.name,
              };
              if (line.partner_id) lineData.partner_id = line.partner_id;
              if (line.account_id) lineData.account_id = line.account_id;
              return [0, 0, lineData];
            }),
          },
        ],
      ]);

      return result as number;
    } catch (error) {
      console.error("Failed to create journal entry:", error);
      throw error;
    }
  }

  async getAccountIdByCode(code: string): Promise<number | null> {
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
        [[["code", "=", code]]],
        {
          fields: ["id", "name", "code"],
          limit: 1,
        },
      ]);

      return (result as Record<string, unknown>[]).length > 0
        ? ((result as Record<string, unknown>[])[0].id as number)
        : null;
    } catch (error) {
      console.error("Failed to find account by code:", error);
      return null;
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
  /**
   * Find a bank journal linked to a specific bank account address (e.g. Gnosis Safe address).
   */
  async getJournalById(journalId: number): Promise<JournalBasic | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.journal",
        "read",
        [[journalId]],
        { fields: ["id", "name", "type", "code"] },
      ]) as JournalBasic[];

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Failed to get journal by ID:", error);
      return null;
    }
  }

  async getJournalByBankAccount(
    accountAddress: string
  ): Promise<JournalBasic | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // First find the bank account record
      const bankResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "search_read",
        [[["acc_number", "=", accountAddress]]],
        {
          fields: ["id"],
          limit: 1,
        },
      ]);

      const bankRecords = bankResult as Record<string, unknown>[];
      if (bankRecords.length === 0) return null;

      const bankAccountId = bankRecords[0].id as number;

      // Find journal linked to this bank account
      const journalResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.journal",
        "search_read",
        [
          [
            ["type", "=", "bank"],
            ["bank_account_id", "=", bankAccountId],
          ],
        ],
        {
          fields: ["id", "name", "type", "code"],
          limit: 1,
        },
      ]);

      const journals = journalResult as Record<string, unknown>[];
      if (journals.length === 0) return null;

      return {
        id: journals[0].id as number,
        name: journals[0].name as string,
        type: journals[0].type as JournalBasic["type"],
        code: journals[0].code as string,
      };
    } catch (error) {
      console.error("Failed to find journal by bank account:", error);
      return null;
    }
  }

  /**
   * Get the company's default suspense account ID for bank journals.
   */
  async getCompanySuspenseAccountId(): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // First try getting it from the company settings
      const companyResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.company",
        "search_read",
        [[]],
        {
          fields: ["id", "account_journal_suspense_account_id"],
          limit: 1,
        },
      ]);

      const companies = companyResult as Record<string, unknown>[];
      if (companies.length > 0) {
        const suspenseAccount = companies[0].account_journal_suspense_account_id as [number, string] | false;
        if (suspenseAccount) {
          return suspenseAccount[0];
        }
      }

      // Fall back to searching by name/type
      const accountResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.account",
        "search_read",
        [[
          ["name", "ilike", "Bank Suspense"],
          ["account_type", "=", "asset_current"],
        ]],
        {
          fields: ["id", "name", "code"],
          limit: 1,
        },
      ]);

      const accounts = accountResult as Record<string, unknown>[];
      if (accounts.length > 0) {
        return accounts[0].id as number;
      }

      // Try broader search for any suspense account
      const broadResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.account",
        "search_read",
        [[
          ["name", "ilike", "suspense"],
          ["account_type", "=", "asset_current"],
        ]],
        {
          fields: ["id", "name", "code"],
          limit: 1,
        },
      ]);

      const broadAccounts = broadResult as Record<string, unknown>[];
      if (broadAccounts.length > 0) {
        return broadAccounts[0].id as number;
      }

      console.warn("No suspense account found in Odoo");
      return null;
    } catch (error) {
      console.error("Failed to get suspense account:", error);
      return null;
    }
  }

  /**
   * Ensure a journal has a suspense account set. Fixes existing journals
   * that were created without one.
   */
  async ensureJournalSuspenseAccount(journalId: number): Promise<void> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Check if it already has one
    const journalResult = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.journal",
      "read",
      [[journalId]],
      { fields: ["suspense_account_id"] },
    ]);

    const journals = journalResult as Record<string, unknown>[];
    if (journals.length > 0) {
      const existing = journals[0].suspense_account_id as [number, string] | false;
      if (existing) return; // Already set
    }

    const suspenseAccountId = await this.getCompanySuspenseAccountId();
    if (!suspenseAccountId) {
      throw new Error(
        "No suspense account found in Odoo. Please create a 'Bank Suspense Account' (type: Current Assets) in your chart of accounts."
      );
    }

    await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.journal",
      "write",
      [[journalId], { suspense_account_id: suspenseAccountId }],
    ]);

    console.log(`Set suspense account ${suspenseAccountId} on journal ${journalId}`);
  }

  /**
   * Create a bank-type journal linked to a bank account for the given blockchain address.
   */
  async createBankJournal(
    name: string,
    code: string,
    accountAddress: string
  ): Promise<JournalBasic> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would create bank journal: ${name} (${code}) for ${accountAddress}`
      );
      return { id: 999999, name, code, type: "bank" };
    }

    // Find or create the res.partner.bank record
    const existingBank = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "res.partner.bank",
      "search_read",
      [[["acc_number", "=", accountAddress]]],
      {
        fields: ["id", "partner_id"],
        limit: 1,
      },
    ]);

    let bankAccountId: number;
    const existingBanks = existingBank as Record<string, unknown>[];

    if (existingBanks.length > 0) {
      bankAccountId = existingBanks[0].id as number;
    } else {
      // Get company partner ID (current user's company)
      const companyResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.company",
        "search_read",
        [[]],
        {
          fields: ["id", "partner_id"],
          limit: 1,
        },
      ]);
      const companies = companyResult as Record<string, unknown>[];
      const companyPartnerId = companies.length > 0
        ? (companies[0].partner_id as [number, string])[0]
        : 1;

      bankAccountId = (await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "create",
        [
          {
            acc_number: accountAddress,
            partner_id: companyPartnerId,
          },
        ],
      ])) as number;
      console.log(`Created bank account record for ${accountAddress}: ${bankAccountId}`);
    }

    // Get the company's default suspense account
    const suspenseAccountId = await this.getCompanySuspenseAccountId();

    // Create the journal
    const journalData: Record<string, unknown> = {
      name,
      code,
      type: "bank",
      bank_account_id: bankAccountId,
    };

    if (suspenseAccountId) {
      journalData.suspense_account_id = suspenseAccountId;
    }

    const journalId = (await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.journal",
      "create",
      [journalData],
    ])) as number;

    console.log(`Created bank journal "${name}" (ID: ${journalId})${suspenseAccountId ? ` with suspense account ${suspenseAccountId}` : ""}`);

    return { id: journalId, name, code, type: "bank" };
  }

  /**
   * Fetch statement lines for a journal with full metadata (for doctor/diagnostic).
   */
  async getStatementLines(
    journalId: number,
    limit?: number
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const opts: Record<string, unknown> = {
      fields: [
        "id",
        "date",
        "payment_ref",
        "amount",
        "unique_import_id",
        "partner_id",
        "move_id",
        "narration",
        "transaction_details",
        "journal_id",
        "create_date",
        "statement_id",
      ],
      order: "date desc, id desc",
    };
    if (limit && limit > 0) opts.limit = limit;

    return await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["journal_id", "=", journalId]]],
      opts,
    ]) as Array<Record<string, unknown>>;
  }

  /**
   * Count entries for a given journal — both account.move and statement lines.
   */
  async countJournalEntries(journalId: number): Promise<{ moves: number; statementLines: number }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const moveCount = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_count",
        [[["journal_id", "=", journalId]]],
      ]) as number;

      const stmtLineCount = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_count",
        [[["journal_id", "=", journalId]]],
      ]) as number;

      return { moves: moveCount, statementLines: stmtLineCount };
    } catch (error) {
      console.error("Failed to count journal entries:", error);
      return { moves: -1, statementLines: -1 };
    }
  }

  /**
   * Get the current balance of a journal by summing all statement line amounts.
   */
  async getJournalBalance(journalId: number): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const lines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["journal_id", "=", journalId]]],
      { fields: ["amount"] },
    ]) as Array<{ amount: number }>;

    const balance = lines.reduce((sum, l) => sum + l.amount, 0);
    return Math.round(balance * 100) / 100;
  }

  /**
   * Get the latest synced block number from a journal's statement lines.
   * Reads the narration field which stores "block:NNNNN" during sync.
   * Returns 0 if no block info found (triggers full sync).
   */
  async getLatestSyncedBlock(journalId: number, _chain: string): Promise<number> {
    if (!this.uid) return 0;

    try {
      // Get the most recent statement lines, ordered by id desc (most recent first)
      const lines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_read",
        [[
          ["journal_id", "=", journalId],
          ["narration", "like", "block:"],
        ]],
        { fields: ["narration"], order: "id desc", limit: 1 },
      ]) as Array<{ narration: string | false }>;

      if (lines.length === 0) return 0;

      const narration = lines[0].narration;
      if (typeof narration === "string") {
        const match = narration.match(/block:(\d+)/);
        if (match) {
          const block = parseInt(match[1], 10);
          console.log(`Latest synced block on journal ${journalId}: ${block}`);
          return block;
        }
      }

      return 0;
    } catch (error) {
      console.error("Failed to get latest synced block:", error);
      return 0;
    }
  }

  /**
   * Delete ALL entries on a journal (statement lines and their parent moves).
   */
  async emptyJournal(journalId: number): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Step 1: Find all statement lines on this journal
    const stmtLines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["journal_id", "=", journalId]]],
      { fields: ["id", "move_id", "is_reconciled"] },
    ]) as Array<{ id: number; move_id: [number, string] | false; is_reconciled: boolean }>;

    // Step 2: Unreoncile reconciled move lines before we can delete anything
    const reconciledMoveIds = stmtLines
      .filter((l) => l.is_reconciled && l.move_id)
      .map((l) => (l.move_id as [number, string])[0]);

    if (reconciledMoveIds.length > 0) {
      // Get all reconciled move lines from these moves
      const reconciledLines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "search_read",
        [[
          ["move_id", "in", reconciledMoveIds],
          ["reconciled", "=", true],
        ]],
        { fields: ["id"] },
      ]) as Array<{ id: number }>;

      if (reconciledLines.length > 0) {
        const lineIds = reconciledLines.map((l) => l.id);
        console.log(`Unreonciling ${lineIds.length} move lines...`);
        await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.move.line",
          "remove_move_reconcile",
          [lineIds],
        ]);
      }
    }

    // Step 3: Reset all posted moves on this journal to draft (required before deletion)
    const moveResult = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move",
      "search_read",
      [[["journal_id", "=", journalId], ["state", "=", "posted"]]],
      { fields: ["id"] },
    ]) as Array<{ id: number }>;

    if (moveResult.length > 0) {
      const postedIds = moveResult.map((m) => m.id);
      console.log(`Resetting ${postedIds.length} posted moves to draft...`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "button_draft",
        [postedIds],
      ]);
    }

    // Step 4: Delete statement lines (cascade-deletes their associated moves in Odoo 17+)
    const stmtLineIds = stmtLines.map((l) => l.id);
    if (stmtLineIds.length > 0) {
      console.log(`Deleting ${stmtLineIds.length} statement lines...`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "unlink",
        [stmtLineIds],
      ]);
    }

    // Step 5: Delete any remaining moves not linked to statement lines
    const remainingMoves = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.move",
      "search",
      [[["journal_id", "=", journalId]]],
    ]) as number[];

    if (remainingMoves.length > 0) {
      console.log(`Deleting ${remainingMoves.length} remaining moves...`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "unlink",
        [remainingMoves],
      ]);
    }

    const totalDeleted = stmtLineIds.length + remainingMoves.length;

    // Step 7: Delete bank statements (monthly grouping records)
    const stmtRecords = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement",
      "search",
      [[["journal_id", "=", journalId]]],
    ]) as number[];

    if (stmtRecords.length > 0) {
      console.log(`Deleting ${stmtRecords.length} bank statement records...`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement",
        "unlink",
        [stmtRecords],
      ]);
    }

    console.log(`Emptied journal ${journalId}: deleted ${stmtLineIds.length} statement lines, ${remainingMoves.length} orphan moves, ${stmtRecords.length} statements`);
    return totalDeleted;
  }

  /**
   * Batch-fetch all existing transaction keys.
   * unique_import_id is fetched globally (Odoo enforces a global unique constraint),
   * while payment_ref and move ref are scoped to the journal.
   * Returns a Set of known keys.
   */
  async getExistingTransactionKeys(journalId: number): Promise<Set<string>> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const keys = new Set<string>();

    try {
      // Batch 1: Get ALL unique_import_ids globally (Odoo's unique constraint is global, not per-journal)
      const globalUidResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_read",
        [[["unique_import_id", "!=", false]]],
        { fields: ["unique_import_id"] },
      ]) as Array<{ unique_import_id: string | false }>;

      for (const line of globalUidResult) {
        if (typeof line.unique_import_id === "string" && line.unique_import_id) {
          keys.add(line.unique_import_id);
        }
      }

      // Batch 2: Get payment_ref from this journal's statement lines (for legacy dedup)
      const stmtResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_read",
        [[["journal_id", "=", journalId]]],
        { fields: ["payment_ref"] },
      ]) as Array<{ payment_ref: string | false }>;

      for (const line of stmtResult) {
        if (typeof line.payment_ref === "string" && line.payment_ref) {
          keys.add(line.payment_ref);
        }
      }

      // Batch 3: Get all refs from account.move on this journal
      const moveResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [[["journal_id", "=", journalId], ["ref", "!=", false]]],
        { fields: ["ref"] },
      ]) as Array<{ ref: string | false }>;

      for (const move of moveResult) {
        if (typeof move.ref === "string" && move.ref) {
          keys.add(move.ref);
        }
      }

      console.log(`Batch-loaded ${keys.size} existing keys (${globalUidResult.length} global unique_import_ids, ${stmtResult.length} journal statement lines, ${moveResult.length} journal moves)`);
    } catch (error) {
      console.error("Failed to batch-load existing keys:", error);
    }

    return keys;
  }

  async checkTransactionExists(uniqueKey: string, journalId?: number): Promise<boolean> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // Check by unique_import_id (Odoo's built-in dedup field)
      const stmtDomain: unknown[] = [["unique_import_id", "=", uniqueKey]];
      if (journalId) stmtDomain.push(["journal_id", "=", journalId]);

      const stmtCount = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_count",
        [stmtDomain],
      ]);

      if ((stmtCount as number) > 0) {
        console.log(`  → found by unique_import_id on journal ${journalId || "any"}`);
        return true;
      }

      // Also check legacy entries by payment_ref or account.move ref
      const legacyStmtDomain: unknown[] = [["payment_ref", "=", uniqueKey]];
      if (journalId) legacyStmtDomain.push(["journal_id", "=", journalId]);

      const legacyStmtCount = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_count",
        [legacyStmtDomain],
      ]);

      if ((legacyStmtCount as number) > 0) {
        console.log(`  → found by legacy payment_ref on journal ${journalId || "any"}`);
        return true;
      }

      const moveDomain: unknown[] = [["ref", "=", uniqueKey]];
      if (journalId) moveDomain.push(["journal_id", "=", journalId]);

      const moveCount = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_count",
        [moveDomain],
      ]);

      if ((moveCount as number) > 0) {
        console.log(`  → found by legacy move ref on journal ${journalId || "any"}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to check transaction exists:", error);
      return true; // Assume exists to be safe
    }
  }

  /**
   * Delete entries matching the given refs/payment_refs.
   * Searches both account.move (by ref) and account.bank.statement.line (by payment_ref),
   * then deletes the underlying account.move records.
   */
  async deleteJournalEntriesByRefs(refs: string[]): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (refs.length === 0) return 0;

    try {
      const moveIdSet = new Set<number>();

      // 1. Find moves by ref (old-style journal entries)
      const moveResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "search_read",
        [[["ref", "in", refs]]],
        { fields: ["id"] },
      ]);
      for (const m of moveResult as Array<{ id: number }>) {
        moveIdSet.add(m.id);
      }

      // 2. Find statement lines by unique_import_id or payment_ref, get their parent move_id
      const stmtResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_read",
        [["|", ["unique_import_id", "in", refs], ["payment_ref", "in", refs]]],
        { fields: ["id", "move_id"] },
      ]);
      for (const line of stmtResult as Array<{ id: number; move_id: [number, string] | false }>) {
        if (line.move_id) {
          moveIdSet.add(line.move_id[0]);
        }
      }

      if (moveIdSet.size === 0) return 0;

      const moveIds = Array.from(moveIdSet);

      // Read states to know which need to be reset to draft
      const stateResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "read",
        [moveIds],
        { fields: ["id", "state"] },
      ]);
      const postedIds = (stateResult as Array<{ id: number; state: string }>)
        .filter((m) => m.state === "posted")
        .map((m) => m.id);

      // Reset posted entries to draft first
      if (postedIds.length > 0) {
        await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.move",
          "button_draft",
          [postedIds],
        ]);
      }

      // Delete all
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move",
        "unlink",
        [moveIds],
      ]);

      console.log(`Deleted ${moveIds.length} journal entries`);
      return moveIds.length;
    } catch (error) {
      console.error("Failed to delete journal entries:", error);
      throw error;
    }
  }

  /**
   * Create a bank statement for a given journal and period.
   */
  async createBankStatement(
    journalId: number,
    name: string,
    date: string,
    balanceStart?: number
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(`[DRY RUN] Would create bank statement: ${name}`);
      return 999999;
    }

    const vals: Record<string, unknown> = {
      name,
      journal_id: journalId,
      date,
    };
    if (balanceStart !== undefined) {
      vals.balance_start = balanceStart;
    }

    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement",
      "create",
      [vals],
    ]);

    return result as number;
  }

  /**
   * Find or create a bank statement for the given journal and month.
   */
  async findOrCreateBankStatement(
    journalId: number,
    yearMonth: string,
    balanceStart?: number
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const statementName = `EURe ${yearMonth}`;

    // Search for existing statement
    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement",
      "search_read",
      [
        [
          ["journal_id", "=", journalId],
          ["name", "=", statementName],
        ],
      ],
      {
        fields: ["id"],
        limit: 1,
      },
    ]);

    const existing = result as Record<string, unknown>[];
    if (existing.length > 0) {
      return existing[0].id as number;
    }

    // Create new statement with date = last day of month
    // (Odoo uses the statement date as the period end)
    const [year, month] = yearMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const date = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
    return await this.createBankStatement(journalId, statementName, date, balanceStart);
  }

  /**
   * Create a bank statement line (transaction) within a statement.
   */
  async createBankStatementLine(
    statementId: number,
    line: {
      date: string;
      payment_ref: string;
      amount: number;
      partner_id?: number;
      narration?: string;
    }
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would create bank statement line: ${line.payment_ref} amount=${line.amount}`
      );
      return 999999;
    }

    // Get journal_id from the statement
    const stmtResult = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement",
      "read",
      [[statementId]],
      { fields: ["journal_id"] },
    ]);
    const stmtRecords = stmtResult as Record<string, unknown>[];
    const journalId = stmtRecords.length > 0
      ? (stmtRecords[0].journal_id as [number, string])[0]
      : undefined;

    const lineData: Record<string, unknown> = {
      statement_id: statementId,
      date: line.date,
      payment_ref: line.payment_ref,
      amount: line.amount,
    };

    if (journalId) {
      lineData.journal_id = journalId;
    }

    if (line.partner_id) {
      lineData.partner_id = line.partner_id;
    }

    if (line.narration) {
      lineData.narration = line.narration;
    }

    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "create",
      [lineData],
    ]);

    return result as number;
  }

  /**
   * Get the default debit and credit account IDs for a journal.
   */
  async getJournalAccounts(
    journalId: number
  ): Promise<{ debitAccountId: number | null; creditAccountId: number | null }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const result = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.journal",
      "read",
      [[journalId]],
      {
        fields: [
          "default_account_id",
        ],
      },
    ]);

    const journals = result as Record<string, unknown>[];
    if (journals.length === 0) return { debitAccountId: null, creditAccountId: null };

    const defaultAccount = journals[0].default_account_id as [number, string] | false;
    const accountId = defaultAccount ? defaultAccount[0] : null;

    return { debitAccountId: accountId, creditAccountId: accountId };
  }

  /**
   * Sync blockchain token transfers into Odoo bank journal as bank statement lines.
   * Uses account.bank.statement.line model directly so entries appear in the
   * bank reconciliation view. Requires the journal to have a suspense account set.
   * Returns { synced, skipped } counts.
   */
  async syncBlockchainTransactions(
    journalId: number,
    transfers: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      timeStamp: string;
      tokenDecimal?: string;
      logIndex?: string;
      blockNumber?: string;
    }>,
    accountAddress: string,
    chain: string,
    onProgress?: (progress: {
      current: number;
      total: number;
      synced: number;
      skipped: number;
      status: string;
    }) => void,
    forceResync?: boolean,
    dryRun?: boolean
  ): Promise<{ synced: number; skipped: number }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Ensure the journal has a suspense account configured (skip in dry run)
    if (!dryRun) {
      await this.ensureJournalSuspenseAccount(journalId);
    }

    // If force resync, delete existing journal entries for these tx hashes first
    if (forceResync && !dryRun && transfers.length > 0) {
      onProgress?.({
        current: 0,
        total: transfers.length,
        synced: 0,
        skipped: 0,
        status: "Cleaning up old entries for re-sync...",
      });

      // Build unique keys for all transfers (new format: chain:account:hash:logIndex)
      const newKeys = transfers.map((tx) =>
        `${chain}:${accountAddress.toLowerCase()}:${tx.hash}:${tx.logIndex || "0"}`
      );
      // Also clean up old-format keys (chain:hash:logIndex and bare hash)
      const oldKeys = transfers.map((tx) =>
        `${chain}:${tx.hash}:${tx.logIndex || "0"}`
      );
      const bareHashes = transfers.map((tx) => tx.hash);
      const deleted = await this.deleteJournalEntriesByRefs([...newKeys, ...oldKeys, ...bareHashes]);
      console.log(`Force re-sync: deleted ${deleted} old entries`);
    }

    // Sort transfers chronologically: by timestamp, then by logIndex within same tx
    transfers.sort((a, b) => {
      const timeDiff = parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10);
      if (timeDiff !== 0) return timeDiff;
      return parseInt(a.logIndex || "0", 10) - parseInt(b.logIndex || "0", 10);
    });

    // Batch-load all existing keys upfront (2 queries instead of 3 per transfer)
    onProgress?.({
      current: 0,
      total: transfers.length,
      synced: 0,
      skipped: 0,
      status: "Loading existing entries for dedup...",
    });
    const existingKeys = await this.getExistingTransactionKeys(journalId);

    let synced = 0;
    let skipped = 0;
    const total = transfers.length;

    // Cache of monthly statement IDs: "YYYY-MM" -> statementId
    const monthlyStatements = new Map<string, number>();
    // Track running balance per month for setting balance_start on new statements
    let runningBalance = 0;

    // Pre-compute the starting balance from existing statement lines already in Odoo
    // by summing all existing lines on this journal (they are already sorted chronologically)
    const existingBalance = await this.getJournalBalance(journalId);
    runningBalance = existingBalance;

    // Track balance at the start of each new month we encounter
    const monthBalanceStart = new Map<string, number>();

    for (let i = 0; i < transfers.length; i++) {
      const tx = transfers[i];
      // Unique key: chain:account:txHash:logIndex
      // Includes account address so the same transfer can appear on two journals
      // (e.g. internal transfer between two wallets we manage)
      const uniqueKey = `${chain}:${accountAddress.toLowerCase()}:${tx.hash}:${tx.logIndex || "0"}`;

      // Convert value from token units
      const decimals = parseInt(tx.tokenDecimal || "18", 10);
      const rawAmount = parseFloat(tx.value) / Math.pow(10, decimals);
      const amount = Math.round(rawAmount * 100) / 100;

      // Determine direction: negative if outgoing, positive if incoming
      const isOutgoing =
        tx.from.toLowerCase() === accountAddress.toLowerCase();
      const signedAmount = isOutgoing ? -amount : amount;

      const txDate = new Date(parseInt(tx.timeStamp, 10) * 1000);
      const dateStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}-${String(txDate.getDate()).padStart(2, "0")}`;
      const yearMonth = dateStr.slice(0, 7); // "YYYY-MM"

      if (amount === 0) {
        skipped++;
        continue;
      }

      // Fast local dedup check against batch-loaded keys
      if (existingKeys.has(uniqueKey)) {
        skipped++;
        continue;
      }
      if (existingKeys.has(tx.hash)) {
        console.log(`Skipping tx ${tx.hash} (logIndex ${tx.logIndex}): tx hash found as payment_ref or move ref on this journal`);
        skipped++;
        continue;
      }

      // Find or create the monthly statement for this transaction
      if (!monthlyStatements.has(yearMonth)) {
        // Record the balance at the start of this month
        monthBalanceStart.set(yearMonth, runningBalance);
        const statementId = await this.findOrCreateBankStatement(
          journalId,
          yearMonth,
          runningBalance
        );
        monthlyStatements.set(yearMonth, statementId);
      }
      const statementId = monthlyStatements.get(yearMonth)!;

      const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      const label = `EURe ${isOutgoing ? "to" : "from"} ${shortAddr(isOutgoing ? tx.to : tx.from)}`;

      onProgress?.({
        current: i + 1,
        total,
        synced,
        skipped,
        status: `${dryRun ? "[DRY RUN] " : ""}${dryRun ? "Would create" : "Creating"} ${label} (${i + 1}/${total})`,
      });

      if (dryRun) {
        console.log(`[DRY RUN] Would create: ${label} amount=${signedAmount} date=${dateStr} statement=${yearMonth} key=${uniqueKey}`);
        synced++;
        runningBalance += signedAmount;
        continue;
      }

      try {
        // Create statement line within the monthly statement
        // unique_import_id = Odoo's built-in dedup field for bank statement imports
        // payment_ref = readable label shown in UI
        const lineId = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.bank.statement.line",
          "create",
          [{
            statement_id: statementId,
            journal_id: journalId,
            date: dateStr,
            payment_ref: label,
            amount: signedAmount,
            unique_import_id: uniqueKey,
            ...(tx.blockNumber ? { narration: `block:${tx.blockNumber}` } : {}),
          }],
        ]) as number;

        // Set unique key as ref on the underlying account.move (visible as "Reference" in UI)
        const lineData = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.bank.statement.line",
          "read",
          [[lineId]],
          { fields: ["move_id"] },
        ]) as Array<{ move_id: [number, string] | false }>;

        if (lineData[0]?.move_id) {
          await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "account.move",
            "write",
            [[lineData[0].move_id[0]], { ref: uniqueKey }],
          ]);
        }

        console.log(`Created statement line ${lineId} in statement ${yearMonth} for ${uniqueKey}`);
        synced++;
        runningBalance += signedAmount;
      } catch (error) {
        console.error(`Failed to sync tx ${uniqueKey}:`, error);
        throw error;
      }
    }

    // Update balance_end_real on all monthly statements
    let balanceAccumulator = existingBalance;

    // Sort months chronologically to compute cumulative balances
    const sortedMonths = [...monthlyStatements.keys()].sort();
    for (const ym of sortedMonths) {
      const stmtId = monthlyStatements.get(ym)!;
      // Get the sum of all lines in this statement to compute ending balance
      const stmtLines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "search_read",
        [[["statement_id", "=", stmtId]]],
        { fields: ["amount"] },
      ]) as Array<{ amount: number }>;
      const monthTotal = stmtLines.reduce((sum, l) => sum + l.amount, 0);
      const balanceEnd = (monthBalanceStart.get(ym) || balanceAccumulator) + monthTotal;

      // Update balance_end_real on all statements (including current month)
      if (!dryRun) {
        await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "account.bank.statement",
          "write",
          [[stmtId], { balance_end_real: Math.round(balanceEnd * 100) / 100 }],
        ]);
        console.log(`Updated statement ${ym}: balance_end_real=${Math.round(balanceEnd * 100) / 100}`);
      }
      balanceAccumulator = balanceEnd;
    }

    return { synced, skipped };
  }

  /**
   * Enrich existing statement lines with Monerium order metadata.
   * Matches by tx hash, then sets/creates partners based on counterparty IBAN and name.
   * Returns { enriched, skipped } counts.
   */
  async enrichWithMoneriumData(
    journalId: number,
    // deno-lint-ignore no-explicit-any
    ordersByTxHash: Map<string, any>,
    onProgress?: (progress: {
      current: number;
      total: number;
      enriched: number;
      skipped: number;
      status: string;
    }) => void,
    dryRun?: boolean,
    forceReconcile: boolean = true
  ): Promise<{ enriched: number; skipped: number; newPartners: number; matchedPartners: number; reconciled: number }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Fetch all statement lines on this journal, including move_id to get the ref
    const lines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [[["journal_id", "=", journalId]]],
      { fields: ["id", "payment_ref", "partner_id", "narration", "amount", "unique_import_id", "transaction_details", "is_reconciled"] },
    ]) as Array<{
      id: number;
      payment_ref: string;
      partner_id: [number, string] | false;
      narration: string | false;
      amount: number;
      unique_import_id: string | false;
      transaction_details: string | false;
      is_reconciled: boolean;
    }>;

    const total = lines.length;
    let enriched = 0;
    let skipped = 0;
    let newPartners = 0;
    let matchedPartners = 0;
    let reconciled = 0;

    // Log sample lines for debugging (first 3)
    console.log(`Enrichment: ${total} statement lines on journal ${journalId}. Sample lines:`);
    for (let s = 0; s < Math.min(3, lines.length); s++) {
      const sample = lines[s];
      console.log(`  Line ${sample.id}: payment_ref="${sample.payment_ref}", unique_import_id=${JSON.stringify(sample.unique_import_id)}, partner=${JSON.stringify(sample.partner_id)}, amount=${sample.amount}, narration=${typeof sample.narration === "string" ? sample.narration.slice(0, 80) : sample.narration}`);
    }

    // Cache for partner lookups to avoid repeated searches
    const partnerCache = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract tx hash from unique_import_id, payment_ref, or narration
      // Supports: "chain:hash:logIndex", raw "0x..." hash, or hash embedded in text
      const ref = (typeof line.unique_import_id === "string" && line.unique_import_id)
        || (typeof line.payment_ref === "string" && line.payment_ref)
        || "";

      let txHash = "";
      if (ref) {
        // Extract tx hash from unique_import_id formats:
        //   new: "chain:account:0xhash:logIndex" (parts[2])
        //   old: "chain:0xhash:logIndex" (parts[1])
        //   raw: "0xhash"
        const parts = ref.split(":");
        if (parts.length >= 4 && parts[2].startsWith("0x")) {
          txHash = parts[2]; // new format
        } else if (parts.length >= 2 && parts[1].startsWith("0x")) {
          txHash = parts[1]; // old format
        } else {
          txHash = ref;
        }
      }

      // Try to find a 0x hash in narration if no match yet
      let order = txHash ? ordersByTxHash.get(txHash.toLowerCase()) : undefined;
      if (!order && typeof line.narration === "string") {
        const hashMatch = line.narration.match(/0x[a-fA-F0-9]{64}/);
        if (hashMatch) {
          txHash = hashMatch[0];
          order = ordersByTxHash.get(txHash.toLowerCase());
        }
      }
      // Also try payment_ref as a raw hash even if it didn't look like one
      if (!order && typeof line.payment_ref === "string") {
        const hashMatch = line.payment_ref.match(/0x[a-fA-F0-9]{64}/);
        if (hashMatch) {
          txHash = hashMatch[0];
          order = ordersByTxHash.get(txHash.toLowerCase());
        }
      }

      // Determine on-chain direction from the statement line amount
      const lineAmount = line.amount || 0;
      const isOutgoing = lineAmount < 0;

      // --- Monerium enrichment: partner + metadata ---
      let iban: string | undefined;

      if (order) {
        console.log(
          `Monerium match: line ${line.id} (${isOutgoing ? "OUT" : "IN"} ${lineAmount}) → ` +
          `kind=${order.kind} counterpart=${order.counterpart?.details?.name || order.counterpart?.details?.companyName || "?"} ` +
          `IBAN=${order.counterpart?.identifier?.iban || "none"} memo=${order.memo || "none"}`
        );

        iban = order.counterpart?.identifier?.iban?.replace(/\s/g, "");
        const name =
          order.counterpart?.details?.companyName ||
          order.counterpart?.details?.name ||
          [order.counterpart?.details?.firstName, order.counterpart?.details?.lastName]
            .filter(Boolean)
            .join(" ") ||
          null;

        onProgress?.({
          current: i + 1,
          total,
          enriched,
          skipped,
          status: `Enriching line ${i + 1}/${total}...`,
        });

        // Skip reconciled lines — Odoo won't allow writing to posted journal entries
        const needsEnrichment = !line.partner_id && !line.is_reconciled;

        if (needsEnrichment) {
          if (!name && !iban) {
            // Can't enrich without counterparty info
          } else {
            // Find or create partner
            let partnerId: number | null = null;
            const cacheKey = iban || name || "";

            let isNewPartner = false;
            if (partnerCache.has(cacheKey)) {
              partnerId = partnerCache.get(cacheKey)!;
              matchedPartners++;
            } else {
              if (iban) {
                partnerId = await this.findPartnerByIban(iban);
              }
              if (!partnerId && name) {
                partnerId = await this.getPartnerIdByName(name);
              }

              if (partnerId) {
                matchedPartners++;
                partnerCache.set(cacheKey, partnerId);
              } else if (name) {
                isNewPartner = true;
                newPartners++;
                if (dryRun) {
                  console.log(`[DRY RUN] Would create partner "${name}"${iban ? ` with IBAN ${iban}` : ""}`);
                } else {
                  partnerId = await this.createPartnerWithIban(name, iban || undefined);
                  console.log(`Created partner "${name}"${iban ? ` with IBAN ${iban}` : ""} (ID: ${partnerId})`);
                  partnerCache.set(cacheKey, partnerId);
                }
              }
            }

            if (partnerId || isNewPartner) {
              const updates: Record<string, unknown> = {};
              if (partnerId) updates.partner_id = partnerId;
              if (order.memo) updates.payment_ref = order.memo;
              if (!line.transaction_details) {
                updates.transaction_details = JSON.stringify(order, null, 2);
              }

              if (dryRun) {
                console.log(`[DRY RUN] Would enrich line ${line.id}: partner=${name}, memo=${order.memo || "none"}`);
              } else if (Object.keys(updates).length > 0) {
                try {
                  await this.callRPC("object", "execute_kw", [
                    this.config.database,
                    this.uid,
                    this.config.password,
                    "account.bank.statement.line",
                    "write",
                    [[line.id], updates],
                  ]);
                } catch (error) {
                  console.error(`Failed to enrich line ${line.id}:`, error);
                }
              }
              enriched++;
            } else {
              skipped++;
            }
          }
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }

      // --- Reconciliation: always attempt for unreconciled outgoing lines ---
      // Runs regardless of whether a Monerium order was found.
      // Uses best available data: order.memo > payment_ref, and IBAN from order or partner.
      if (isOutgoing && !line.is_reconciled) {
        const absAmount = Math.abs(lineAmount);
        const memo = (order?.memo) || line.payment_ref || undefined;

        // If no IBAN from Monerium order, try to get it from the line's partner
        if (!iban && line.partner_id) {
          const partnerId = (line.partner_id as [number, string])[0];
          try {
            const banks = await this.callRPC("object", "execute_kw", [
              this.config.database,
              this.uid,
              this.config.password,
              "res.partner.bank",
              "search_read",
              [[["partner_id", "=", partnerId]]],
              { fields: ["acc_number"], limit: 1 },
            ]) as Array<{ acc_number: string }>;
            if (banks.length > 0) {
              iban = banks[0].acc_number.replace(/\s/g, "");
            }
          } catch {
            // ignore
          }
        }

        const matchingInvoice = await this.findMatchingInvoice(memo, iban, absAmount, forceReconcile);

        if (matchingInvoice) {
          if (dryRun) {
            console.log(`[DRY RUN] Would${matchingInvoice.alreadyPaid ? " force" : ""} reconcile line ${line.id} with invoice ${matchingInvoice.name} (matched by ${matchingInvoice.matchedBy})`);
            reconciled++;
          } else {
            if (matchingInvoice.alreadyPaid) {
              await this.unreconcileInvoice(matchingInvoice.id);
            }
            const ok = await this.reconcileStatementLineWithInvoice(
              line.id,
              matchingInvoice.id,
              false
            );
            if (ok) {
              reconciled++;
              console.log(`${matchingInvoice.alreadyPaid ? "Force r" : "R"}econciled line ${line.id} with invoice ${matchingInvoice.name} (matched by ${matchingInvoice.matchedBy})`);
            }
          }
        }
      }
    }

    return { enriched, skipped, newPartners, matchedPartners, reconciled };
  }

  /**
   * Reconcile unreconciled outgoing statement lines on a journal with matching invoices.
   * Runs independently of Monerium enrichment.
   */
  async reconcileJournalLines(
    journalId: number,
    onProgress?: (progress: {
      current: number;
      total: number;
      reconciled: number;
      status: string;
    }) => void,
    dryRun?: boolean,
    forceReconcile: boolean = true,
    recentDays: number = 0
  ): Promise<{ reconciled: number; total: number }> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // Fetch unreconciled statement lines, optionally limited to recent ones
    const domain: unknown[][] = [
      ["journal_id", "=", journalId],
      ["is_reconciled", "=", false],
    ];
    if (recentDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - recentDays);
      domain.push(["date", ">=", cutoff.toISOString().split("T")[0]]);
    }
    const lines = await this.callRPC("object", "execute_kw", [
      this.config.database,
      this.uid,
      this.config.password,
      "account.bank.statement.line",
      "search_read",
      [domain],
      { fields: ["id", "payment_ref", "partner_id", "amount"] },
    ]) as Array<{
      id: number;
      payment_ref: string | false;
      partner_id: [number, string] | false;
      amount: number;
    }>;

    const total = lines.length;
    let reconciled = 0;

    console.log(`Reconciliation: ${total} unreconciled lines on journal ${journalId}`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const absAmount = Math.abs(line.amount);
      const memo = (typeof line.payment_ref === "string" && line.payment_ref) || undefined;

      // Try to get IBAN from the line's partner
      let iban: string | undefined;
      if (line.partner_id) {
        const partnerId = (line.partner_id as [number, string])[0];
        try {
          const banks = await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "res.partner.bank",
            "search_read",
            [[["partner_id", "=", partnerId]]],
            { fields: ["acc_number"], limit: 1 },
          ]) as Array<{ acc_number: string }>;
          if (banks.length > 0) {
            iban = banks[0].acc_number.replace(/\s/g, "");
          }
        } catch {
          // ignore
        }
      }

      console.log(`Reconcile attempt: line ${line.id} amount=${line.amount} memo="${memo || ""}" iban=${iban || "none"} partner=${line.partner_id ? (line.partner_id as [number, string])[1] : "none"}`);

      const matchingInvoice = await this.findMatchingInvoice(memo, iban, absAmount, forceReconcile);

      if (matchingInvoice) {
        if (dryRun) {
          console.log(`[DRY RUN] Would${matchingInvoice.alreadyPaid ? " force" : ""} reconcile line ${line.id} with invoice ${matchingInvoice.name} (matched by ${matchingInvoice.matchedBy})`);
          reconciled++;
        } else {
          if (matchingInvoice.alreadyPaid) {
            await this.unreconcileInvoice(matchingInvoice.id);
          }
          const ok = await this.reconcileStatementLineWithInvoice(
            line.id,
            matchingInvoice.id,
            false
          );
          if (ok) {
            reconciled++;
            console.log(`${matchingInvoice.alreadyPaid ? "Force r" : "R"}econciled line ${line.id} with invoice ${matchingInvoice.name} (matched by ${matchingInvoice.matchedBy})`);
          } else {
            console.log(`Reconciliation failed for line ${line.id} with invoice ${matchingInvoice.name}`);
          }
        }
      } else {
        console.log(`No matching invoice found for line ${line.id}`);
      }

      onProgress?.({
        current: i + 1,
        total,
        reconciled,
        status: `Reconciling ${i + 1}/${total}...`,
      });
    }

    console.log(`Reconciliation complete: ${reconciled}/${total} lines reconciled${dryRun ? " [DRY RUN]" : ""}`);
    return { reconciled, total };
  }

  /**
   * Find a matching invoice for a bank statement line.
   * Cascades from most selective to least selective, only matching when unambiguous (exactly 1 result):
   *   1. IBAN + reference/label + amount
   *   2. reference/label + amount
   *   3. reference/label only
   *   4. IBAN + amount
   *
   * When forceReconcile is true (default), also matches already-paid invoices (unpaid tried first).
   */
  async findMatchingInvoice(
    memo: string | undefined,
    iban: string | undefined,
    amount: number,
    forceReconcile: boolean = true
  ): Promise<{ id: number; name: string; matchedBy: string; alreadyPaid: boolean } | null> {
    if (!this.uid) return null;

    // --- Preparation: extract reference candidates from memo ---
    const refCandidates: Array<{ value: string; field: "name" | "ref"; source: string }> = [];
    if (memo) {
      // Odoo sequence names: CHB-S/2025/12/0026, CHB/2026/00187, BILL/2026/0042, INV/2026/0042
      const patterns: Array<[RegExp, string]> = [
        [/\b[A-Z][\w-]*\/\d{4}\/\d{2}\/\d+/i, "sequence_name"],  // CHB-S/2025/12/0026 (with month)
        [/\b[A-Z][\w-]*\/\d{4}\/\d+/i, "sequence_name"],          // CHB/2026/00187, BILL/2026/0042, INV/2026/0042
      ];
      for (const [pattern, source] of patterns) {
        const match = memo.match(pattern);
        if (match) {
          refCandidates.push({ value: match[0], field: "name", source });
          refCandidates.push({ value: match[0], field: "ref", source });
        }
      }
      // Vendor ref after " - "
      const refPart = memo.match(/ - (.+)$/);
      if (refPart) {
        const vendorRef = refPart[1].trim();
        if (vendorRef) {
          refCandidates.push({ value: vendorRef, field: "ref", source: "vendor_ref" });
        }
      }
    }

    console.log(`findMatchingInvoice: memo="${memo || ""}" iban="${iban || ""}" amount=${amount} refs=[${refCandidates.map(r => `${r.source}:${r.field}="${r.value}"`).join(", ")}]`);

    // --- Preparation: resolve IBAN to partner IDs (once) ---
    let partnerIds: number[] = [];
    let normalizedIban = "";
    if (iban) {
      normalizedIban = iban.replace(/\s/g, "");
      try {
        const bankResult = await this.callRPC("object", "execute_kw", [
          this.config.database,
          this.uid,
          this.config.password,
          "res.partner.bank",
          "search_read",
          [[["acc_number", "in", [normalizedIban, iban]]]],
          { fields: ["id", "partner_id"] },
        ]) as Array<{ id: number; partner_id: [number, string] | false }>;
        partnerIds = bankResult
          .filter((b) => b.partner_id)
          .map((b) => (b.partner_id as [number, string])[0]);
      } catch (error) {
        console.error(`Failed to resolve IBAN to partners:`, error);
      }
    }

    // Two-pass: unpaid first, then paid (if forceReconcile)
    const paymentFilters: Array<[string, boolean]> = [["!=", false]];
    if (forceReconcile) paymentFilters.push(["=", true]);

    // Helper: search invoices with given filters, return single unambiguous match or null
    const searchInvoice = async (
      filters: Array<[string, string, unknown]>,
      matchedBy: string
    ): Promise<{ id: number; name: string; matchedBy: string; alreadyPaid: boolean } | null> => {
      for (const [payOp, alreadyPaid] of paymentFilters) {
        try {
          const result = await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "account.move",
            "search_read",
            [[
              ...filters,
              ["payment_state", payOp, "paid"],
              ["state", "=", "posted"],
            ]],
            { fields: ["id", "name", "amount_residual", "amount_total"], limit: 2 },
          ]) as Array<{ id: number; name: string; amount_residual: number; amount_total: number }>;

          if (result.length === 1) {
            console.log(`Invoice match by ${matchedBy}: → invoice #${result[0].id} "${result[0].name}"${alreadyPaid ? " (already paid — will force reconcile)" : ""}`);
            return { id: result[0].id, name: result[0].name, matchedBy, alreadyPaid: alreadyPaid as boolean };
          } else if (result.length > 1) {
            console.log(`Invoice match ambiguous for ${matchedBy}: ${result.length} matches, trying next strategy`);
          }
        } catch (error) {
          console.error(`Failed to find invoice by ${matchedBy}:`, error);
        }
      }
      return null;
    };

    const hasIban = partnerIds.length > 0;
    const hasRef = refCandidates.length > 0;

    // --- Strategy 1: IBAN + reference + amount (most selective) ---
    if (hasIban && hasRef && amount > 0) {
      for (const ref of refCandidates) {
        const amountFilters: Array<[string, string, unknown]> = [
          ["partner_id", "in", partnerIds],
          [ref.field, "=", ref.value],
          ["move_type", "in", ["in_invoice", "out_invoice"]],
        ];
        // For paid invoices we check amount_total, for unpaid amount_residual — but with ref+IBAN+amount
        // we just check amount_total since it's the most stable
        const result = await searchInvoice([
          ...amountFilters,
          ["amount_total", ">=", amount - 0.01],
          ["amount_total", "<=", amount + 0.01],
        ], `iban+${ref.source}(${ref.field})+amount`);
        if (result) return result;
      }
    }

    // --- Strategy 2: reference + amount ---
    if (hasRef && amount > 0) {
      for (const ref of refCandidates) {
        const result = await searchInvoice([
          [ref.field, "=", ref.value],
          ["move_type", "in", ["in_invoice", "out_invoice"]],
          ["amount_total", ">=", amount - 0.01],
          ["amount_total", "<=", amount + 0.01],
        ], `${ref.source}(${ref.field})+amount`);
        if (result) return result;
      }
    }

    // --- Strategy 3: reference only ---
    if (hasRef) {
      for (const ref of refCandidates) {
        const result = await searchInvoice([
          [ref.field, "=", ref.value],
        ], `${ref.source}(${ref.field})`);
        if (result) return result;
      }
    }

    // --- Strategy 4: IBAN + amount ---
    if (hasIban && amount > 0) {
      for (const [payOp, alreadyPaid] of paymentFilters) {
        const amountField = alreadyPaid ? "amount_total" : "amount_residual";
        try {
          const result = await this.callRPC("object", "execute_kw", [
            this.config.database,
            this.uid,
            this.config.password,
            "account.move",
            "search_read",
            [[
              ["partner_id", "in", partnerIds],
              ["payment_state", payOp, "paid"],
              ["state", "=", "posted"],
              ["move_type", "in", ["in_invoice", "out_invoice"]],
              [amountField, ">=", amount - 0.01],
              [amountField, "<=", amount + 0.01],
            ]],
            { fields: ["id", "name", "amount_residual", "partner_id"] },
          ]) as Array<{ id: number; name: string; amount_residual: number; partner_id: [number, string] | false }>;

          if (result.length === 1) {
            console.log(`Invoice match by iban+amount: IBAN=${normalizedIban} amount=${amount} → invoice #${result[0].id} "${result[0].name}"${alreadyPaid ? " (already paid — will force reconcile)" : ""}`);
            return { id: result[0].id, name: result[0].name, matchedBy: "iban+amount", alreadyPaid: alreadyPaid as boolean };
          } else if (result.length > 1) {
            console.log(`Invoice match ambiguous: IBAN=${normalizedIban} amount=${amount} → ${result.length} matches, skipping`);
          }
        } catch (error) {
          console.error(`Failed to find invoice by iban+amount:`, error);
        }
      }
    }

    // --- Strategy 5: amount only (least selective — only when exactly 1 match) ---
    // Limited to invoices from the last 60 days to avoid false positives with old invoices
    if (amount > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      const result = await searchInvoice([
        ["move_type", "in", ["in_invoice", "out_invoice"]],
        ["amount_total", ">=", amount - 0.01],
        ["amount_total", "<=", amount + 0.01],
        ["invoice_date", ">=", cutoffStr],
      ], "amount");
      if (result) return result;
    }

    return null;
  }

  /**
   * Unreconcile an already-paid invoice so it can be re-reconciled with a statement line.
   * Removes existing reconciliation from the invoice's payable/receivable move lines.
   */
  async unreconcileInvoice(invoiceId: number): Promise<boolean> {
    if (!this.uid) return false;
    try {
      // Find reconciled move lines on this invoice
      const reconciledLines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "search_read",
        [[
          ["move_id", "=", invoiceId],
          ["account_type", "in", ["asset_receivable", "liability_payable"]],
          ["reconciled", "=", true],
        ]],
        { fields: ["id"] },
      ]) as Array<{ id: number }>;

      if (reconciledLines.length === 0) {
        console.log(`Invoice ${invoiceId} has no reconciled lines to undo`);
        return false;
      }

      const lineIds = reconciledLines.map((l) => l.id);
      console.log(`Unreconciling ${lineIds.length} lines on invoice ${invoiceId}...`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "remove_move_reconcile",
        [lineIds],
      ]);
      return true;
    } catch (error) {
      console.error(`Failed to unreconcile invoice ${invoiceId}:`, error);
      return false;
    }
  }

  /**
   * Reconcile a bank statement line with an invoice.
   * Uses Odoo's reconciliation mechanism to match the statement line
   * with the invoice's outstanding payment line.
   */
  async reconcileStatementLineWithInvoice(
    statementLineId: number,
    invoiceId: number,
    dryRun?: boolean
  ): Promise<boolean> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would reconcile statement line ${statementLineId} with invoice ${invoiceId}`);
      return true;
    }

    try {
      // Get the invoice's receivable/payable move lines (the ones to reconcile against)
      const invoiceLines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "search_read",
        [[
          ["move_id", "=", invoiceId],
          ["account_type", "in", ["asset_receivable", "liability_payable"]],
          ["reconciled", "=", false],
        ]],
        { fields: ["id", "account_id", "balance"] },
      ]) as Array<{ id: number; account_id: [number, string]; balance: number }>;

      if (invoiceLines.length === 0) {
        console.log(`No unreconciled payable/receivable lines for invoice ${invoiceId}`);
        return false;
      }

      console.log(`Reconciling: statement line ${statementLineId} with invoice ${invoiceId}, invoice has ${invoiceLines.length} unreconciled lines: ${JSON.stringify(invoiceLines.map(l => ({ id: l.id, account: l.account_id[1], balance: l.balance })))}`);

      // Get the statement line's journal entry (move)
      const stmtLineData = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.bank.statement.line",
        "read",
        [[statementLineId]],
        { fields: ["move_id"] },
      ]) as Array<{ move_id: [number, string] | false }>;

      if (!stmtLineData[0]?.move_id) {
        console.log(`Statement line ${statementLineId} has no move`);
        return false;
      }

      const stmtMoveId = stmtLineData[0].move_id[0];

      // Find the suspense account lines on the statement's journal entry
      // (the counterpart to the bank account line — this is what we reconcile)
      const suspenseLines = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "search_read",
        [[
          ["move_id", "=", stmtMoveId],
          ["account_type", "not in", ["asset_cash", "liability_credit_card"]],
          ["reconciled", "=", false],
        ]],
        { fields: ["id", "account_id", "balance", "account_type"] },
      ]) as Array<{ id: number; account_id: [number, string]; balance: number; account_type: string }>;

      console.log(`Statement move ${stmtMoveId} suspense lines: ${JSON.stringify(suspenseLines.map(l => ({ id: l.id, account: l.account_id[1], balance: l.balance, type: l.account_type })))}`);

      if (suspenseLines.length === 0) {
        console.log(`No suspense lines to reconcile on statement line ${statementLineId} — already reconciled?`);
        return false;
      }

      // Rewrite the suspense line's account to match the invoice's receivable/payable account
      const targetAccountId = invoiceLines[0].account_id[0];
      const suspenseIds = suspenseLines.map((l) => l.id);
      console.log(`Changing account on lines ${JSON.stringify(suspenseIds)} from ${suspenseLines[0].account_id[1]} to ${invoiceLines[0].account_id[1]} (${targetAccountId})`);

      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "write",
        [suspenseIds, { account_id: targetAccountId }],
      ]);

      // Reconcile: the invoice's receivable/payable lines + the statement's (now matching) lines
      const lineIdsToReconcile = [
        ...invoiceLines.map((l) => l.id),
        ...suspenseIds,
      ];

      console.log(`Calling account.move.line.reconcile on lines: ${JSON.stringify(lineIdsToReconcile)}`);
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.move.line",
        "reconcile",
        [lineIdsToReconcile],
      ]);

      console.log(`Reconciled statement line ${statementLineId} with invoice ${invoiceId} (${invoiceLines.length} invoice lines matched)`);
      return true;
    } catch (error) {
      console.error(`Failed to reconcile statement line ${statementLineId} with invoice ${invoiceId}:`, error);
      return false;
    }
  }

  /**
   * Find a partner by their bank account IBAN.
   */
  async findPartnerByIban(iban: string): Promise<number | null> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const normalizedIban = iban.replace(/\s/g, "");

    try {
      // Search both with and without spaces since Odoo may store either format
      const result = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "search_read",
        [[["acc_number", "in", [normalizedIban, iban]]]],
        { fields: ["id", "partner_id"], limit: 1 },
      ]);

      const records = result as Array<{
        id: number;
        partner_id: [number, string] | false;
      }>;
      return records.length > 0 && records[0].partner_id
        ? records[0].partner_id[0]
        : null;
    } catch (error) {
      console.error("Failed to find partner by IBAN:", error);
      return null;
    }
  }

  /**
   * Create a new partner (company) with optional IBAN bank account.
   */
  async createPartnerWithIban(
    name: string,
    iban?: string
  ): Promise<number> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const partnerId = await this.createPartner(name);

    // Create bank account linked to partner
    if (iban) {
      const normalizedIban = iban.replace(/\s/g, "");
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "res.partner.bank",
        "create",
        [{ acc_number: normalizedIban, partner_id: partnerId }],
      ]);
    }

    return partnerId;
  }

  /**
   * Register a payment on an invoice, linking it to a journal.
   */
  async reconcileInvoicePayment(
    invoiceId: number,
    journalId: number
  ): Promise<boolean> {
    if (!this.uid) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    if (this.dryRun) {
      console.log(
        `[DRY RUN] Would reconcile invoice ${invoiceId} with journal ${journalId}`
      );
      return true;
    }

    try {
      // Use the action_register_payment wizard
      const wizardResult = await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.payment.register",
        "create",
        [
          {
            journal_id: journalId,
          },
        ],
      ]);

      const wizardId = wizardResult as number;

      // Set context with active_model and active_ids to target the invoice
      await this.callRPC("object", "execute_kw", [
        this.config.database,
        this.uid,
        this.config.password,
        "account.payment.register",
        "action_create_payments",
        [[wizardId]],
        {
          context: {
            active_model: "account.move",
            active_ids: [invoiceId],
          },
        },
      ]);

      return true;
    } catch (error) {
      console.error(
        `Failed to reconcile invoice ${invoiceId}:`,
        error
      );
      return false;
    }
  }

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
