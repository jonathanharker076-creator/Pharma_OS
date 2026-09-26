import { queryOne, query, execute, executeTransaction } from "../db.js";
import { getSession } from "../session.js";

export function loadCompany() {
    return queryOne("SELECT * FROM company WHERE id = 1");
}

export function isCompanyConfigured() {
    const row = queryOne("SELECT id FROM company WHERE id = 1");
    return row !== null;
}

export function loadConfig(key) {
    const row = queryOne("SELECT value FROM configuration WHERE key = ?", [key]);
    return row ? row.value : null;
}

export function loadAllConfig() {
    return query("SELECT key, value FROM configuration ORDER BY key");
}

export async function setConfig(key, value, userId = null) {
    const existing = loadConfig(key);
    const now = new Date().toISOString();

    if (existing === null) {
        await execute(
            "INSERT INTO configuration (key, value, updated_at) VALUES (?, ?, ?)",
            [key, String(value), now]
        );
        await writeAudit("configuration", 0, "INSERT", null, { key, value }, userId);
        await enqueueSync("configuration", 0, "INSERT", { key, value });
    } else {
        await execute(
            "UPDATE configuration SET value = ?, updated_at = ? WHERE key = ?",
            [String(value), now, key]
        );
        await writeAudit(
            "configuration",
            0,
            "UPDATE",
            { key, value: existing },
            { key, value },
            userId
        );
        await enqueueSync("configuration", 0, "UPDATE", { key, value });
    }
}

export function validateGstin(gstin) {
    if (!gstin) return true;
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return pattern.test(gstin);
}

export function validateCompanyPayload(payload) {
    const errors = [];

    if (!payload.legal_name || payload.legal_name.trim() === "") {
        errors.push("Legal name is required.");
    }

    if (!payload.drug_license_no || payload.drug_license_no.trim() === "") {
        errors.push("Drug license number is required.");
    }

    if (payload.tax_regime === "gst") {
        if (payload.gstin && !validateGstin(payload.gstin)) {
            errors.push("GSTIN format is invalid.");
        }
    }

    const month = Number(payload.fiscal_year_start_month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        errors.push("Fiscal year start month must be between 1 and 12.");
    }

    if (payload.invoice_prefix && payload.invoice_prefix.length > 10) {
        errors.push("Invoice prefix must be 10 characters or fewer.");
    }

    return errors;
}

export async function saveCompany(payload, userId = null) {
    const errors = validateCompanyPayload(payload);
    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const existing = loadCompany();
    const now = new Date().toISOString();

    if (!existing) {
        const statements = [
            {
                sql: `INSERT INTO company (
                    id, legal_name, trade_name, gstin, drug_license_no,
                    address_line1, address_line2, city, state, pincode,
                    phone, email, tax_regime, fiscal_year_start_month,
                    invoice_prefix, created_at, updated_at
                ) VALUES (
                    1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )`,
                params: [
                    payload.legal_name.trim(),
                    payload.trade_name ? payload.trade_name.trim() : null,
                    payload.gstin ? payload.gstin.trim().toUpperCase() : null,
                    payload.drug_license_no.trim(),
                    payload.address_line1 || null,
                    payload.address_line2 || null,
                    payload.city || null,
                    payload.state || null,
                    payload.pincode || null,
                    payload.phone || null,
                    payload.email || null,
                    payload.tax_regime || "none",
                    Number(payload.fiscal_year_start_month) || 4,
                    payload.invoice_prefix || "INV",
                    now,
                    now
                ]
            },
            {
                sql: `INSERT OR REPLACE INTO configuration (key, value, updated_at)
                      VALUES ('company_configured', 'true', ?)`,
                params: [now]
            },
            {
                sql: `INSERT OR IGNORE INTO configuration (key, value, updated_at)
                      VALUES ('invoice_sequence', '0', ?)`,
                params: [now]
            },
            {
                sql: `INSERT OR IGNORE INTO configuration (key, value, updated_at)
                      VALUES ('purchase_sequence', '0', ?)`,
                params: [now]
            },
            {
                sql: `INSERT OR IGNORE INTO configuration (key, value, updated_at)
                      VALUES ('sales_return_sequence', '0', ?)`,
                params: [now]
            },
            {
                sql: `INSERT OR IGNORE INTO configuration (key, value, updated_at)
                      VALUES ('purchase_return_sequence', '0', ?)`,
                params: [now]
            }
        ];

        await executeTransaction(statements);
        await writeAudit("company", 1, "INSERT", null, payload, userId);
        await enqueueSync("company", 1, "INSERT", payload);
        return { ok: true, created: true };
    }

    const statements = [
        {
            sql: `UPDATE company SET
                    legal_name = ?,
                    trade_name = ?,
                    gstin = ?,
                    drug_license_no = ?,
                    address_line1 = ?,
                    address_line2 = ?,
                    city = ?,
                    state = ?,
                    pincode = ?,
                    phone = ?,
                    email = ?,
                    tax_regime = ?,
                    fiscal_year_start_month = ?,
                    invoice_prefix = ?,
                    updated_at = ?
                  WHERE id = 1`,
            params: [
                payload.legal_name.trim(),
                payload.trade_name ? payload.trade_name.trim() : null,
                payload.gstin ? payload.gstin.trim().toUpperCase() : null,
                payload.drug_license_no.trim(),
                payload.address_line1 || null,
                payload.address_line2 || null,
                payload.city || null,
                payload.state || null,
                payload.pincode || null,
                payload.phone || null,
                payload.email || null,
                payload.tax_regime || "none",
                Number(payload.fiscal_year_start_month) || 4,
                payload.invoice_prefix || "INV",
                now
            ]
        }
    ];

    await executeTransaction(statements);
    await writeAudit("company", 1, "UPDATE", existing, payload, userId);
    await enqueueSync("company", 1, "UPDATE", payload);
    return { ok: true, created: false };
}

async function writeAudit(tableName, recordId, action, oldValues, newValues, userId) {
    const session = getSession();
    const effectiveUserId = userId !== null ? userId : session ? session.user_id : null;
    await execute(
        `INSERT INTO audit_log
            (table_name, record_id, action, old_values, new_values, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            tableName,
            recordId,
            action,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            effectiveUserId,
            new Date().toISOString()
        ]
    );
}

async function enqueueSync(tableName, recordId, operation, payload) {
    await execute(
        `INSERT INTO sync_queue
            (table_name, record_id, operation, payload, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [
            tableName,
            recordId,
            operation,
            JSON.stringify(payload),
            new Date().toISOString()
        ]
    );
}
