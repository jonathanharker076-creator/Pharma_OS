import {
    loadCompany,
    saveCompany
} from "../modules/company.js";
import { setStatus } from "../router.js";
import { getSession } from "../session.js";

export async function renderCompanySetup(container) {
    const existing = loadCompany();
    const isEdit = existing !== null;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
        <h2>${isEdit ? "Company Setup (Edit)" : "Company Setup"}</h2>
        <div id="company-message"></div>
        <form id="company-form">
            <fieldset>
                <legend>Legal Identity</legend>
                <div class="form-row">
                    <label for="legal_name">Legal Name *</label>
                    <input type="text" id="legal_name" name="legal_name" required>
                </div>
                <div class="form-row">
                    <label for="trade_name">Trade Name</label>
                    <input type="text" id="trade_name" name="trade_name">
                </div>
                <div class="form-grid">
                    <div class="form-row">
                        <label for="gstin">GSTIN</label>
                        <input type="text" id="gstin" name="gstin" maxlength="15">
                    </div>
                    <div class="form-row">
                        <label for="drug_license_no">Drug License Number *</label>
                        <input type="text" id="drug_license_no" name="drug_license_no" required>
                    </div>
                </div>
            </fieldset>

            <fieldset>
                <legend>Address</legend>
                <div class="form-row">
                    <label for="address_line1">Address Line 1</label>
                    <input type="text" id="address_line1" name="address_line1">
                </div>
                <div class="form-row">
                    <label for="address_line2">Address Line 2</label>
                    <input type="text" id="address_line2" name="address_line2">
                </div>
                <div class="form-grid">
                    <div class="form-row">
                        <label for="city">City</label>
                        <input type="text" id="city" name="city">
                    </div>
                    <div class="form-row">
                        <label for="state">State</label>
                        <input type="text" id="state" name="state">
                    </div>
                    <div class="form-row">
                        <label for="pincode">Pincode</label>
                        <input type="text" id="pincode" name="pincode">
                    </div>
                    <div class="form-row">
                        <label for="phone">Phone</label>
                        <input type="tel" id="phone" name="phone">
                    </div>
                </div>
                <div class="form-row">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email">
                </div>
            </fieldset>

            <fieldset>
                <legend>Tax and Fiscal Settings</legend>
                <div class="form-grid">
                    <div class="form-row">
                        <label for="tax_regime">Tax Regime</label>
                        <select id="tax_regime" name="tax_regime">
                            <option value="none">None</option>
                            <option value="gst">GST</option>
                            <option value="vat">VAT</option>
                            <option value="sales_tax">Sales Tax</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label for="fiscal_year_start_month">Fiscal Year Start Month</label>
                        <select id="fiscal_year_start_month" name="fiscal_year_start_month">
                            <option value="1">January</option>
                            <option value="2">February</option>
                            <option value="3">March</option>
                            <option value="4">April</option>
                            <option value="5">May</option>
                            <option value="6">June</option>
                            <option value="7">July</option>
                            <option value="8">August</option>
                            <option value="9">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label for="invoice_prefix">Invoice Prefix</label>
                        <input type="text" id="invoice_prefix" name="invoice_prefix" maxlength="10" value="INV">
                    </div>
                </div>
            </fieldset>

            <div class="button-row">
                <button type="submit">${isEdit ? "Update Company" : "Save Company"}</button>
                <button type="button" class="secondary" id="reset-form">Reset Form</button>
            </div>
        </form>
    `;

    container.appendChild(wrapper);

    const form = document.getElementById("company-form");
    const messageBox = document.getElementById("company-message");

    if (isEdit) {
        setFieldValue("legal_name", existing.legal_name);
        setFieldValue("trade_name", existing.trade_name);
        setFieldValue("gstin", existing.gstin);
        setFieldValue("drug_license_no", existing.drug_license_no);
        setFieldValue("address_line1", existing.address_line1);
        setFieldValue("address_line2", existing.address_line2);
        setFieldValue("city", existing.city);
        setFieldValue("state", existing.state);
        setFieldValue("pincode", existing.pincode);
        setFieldValue("phone", existing.phone);
        setFieldValue("email", existing.email);
        setFieldValue("tax_regime", existing.tax_regime);
        setFieldValue(
            "fiscal_year_start_month",
            String(existing.fiscal_year_start_month)
        );
        setFieldValue("invoice_prefix", existing.invoice_prefix);
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage(messageBox);

        const payload = {
            legal_name: getFieldValue("legal_name"),
            trade_name: getFieldValue("trade_name"),
            gstin: getFieldValue("gstin"),
            drug_license_no: getFieldValue("drug_license_no"),
            address_line1: getFieldValue("address_line1"),
            address_line2: getFieldValue("address_line2"),
            city: getFieldValue("city"),
            state: getFieldValue("state"),
            pincode: getFieldValue("pincode"),
            phone: getFieldValue("phone"),
            email: getFieldValue("email"),
            tax_regime: getFieldValue("tax_regime"),
            fiscal_year_start_month: Number(
                getFieldValue("fiscal_year_start_month")
            ),
            invoice_prefix: getFieldValue("invoice_prefix") || "INV"
        };

        const session = getSession();
        const userId = session ? session.user_id : null;

        setStatus("Saving company setup...");
        const result = await saveCompany(payload, userId);

        if (!result.ok) {
            showMessage(messageBox, result.errors.join(" "), "error");
            setStatus("Save failed.");
            return;
        }

        showMessage(
            messageBox,
            result.created
                ? "Company created successfully."
                : "Company updated successfully.",
            "success"
        );
        setStatus("Company saved.");
        document.querySelector("h2").textContent = "Company Setup (Edit)";
    });

    document.getElementById("reset-form").addEventListener("click", () => {
        form.reset();
        clearMessage(messageBox);
        setStatus("Form reset.");
    });
}

function getFieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value === null || value === undefined ? "" : value;
}

function showMessage(container, text, type) {
    container.innerHTML = "";
    const box = document.createElement("div");
    box.className = `message ${type}`;
    box.textContent = text;
    container.appendChild(box);
}

function clearMessage(container) {
    container.innerHTML = "";
}
