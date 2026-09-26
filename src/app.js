import { initDatabase, queryOne } from "./db.js";
import { registerRoute, navigateTo, setStatus } from "./router.js";
import { isLoggedIn, clearSession } from "./session.js";
import { renderCompanySetup } from "./screens/company_setup.js";

const NAV_ITEMS = [
    { label: "Company Setup", route: "company_setup" }
];

function renderNav() {
    const nav = document.getElementById("main-nav");
    nav.innerHTML = "";
    for (const item of NAV_ITEMS) {
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = item.label;
        link.addEventListener("click", (event) => {
            event.preventDefault();
            navigateTo(item.route);
        });
        nav.appendChild(link);
    }
}

function renderSessionInfo() {
    const info = document.getElementById("session-info");
    info.textContent = isLoggedIn() ? "" : "";
}

function determineStartRoute() {
    const company = queryOne("SELECT id FROM company WHERE id = 1");
    if (!company) return "company_setup";
    return "company_setup";
}

async function bootstrap() {
    setStatus("Initializing database...");
    try {
        await initDatabase();
    } catch (error) {
        setStatus("Database initialization failed.");
        const container = document.getElementById("content");
        container.innerHTML = "";
        const box = document.createElement("div");
        box.className = "message error";
        box.textContent = `Database initialization failed: ${error.message}`;
        container.appendChild(box);
        return;
    }

    registerRoute("company_setup", renderCompanySetup);

    renderNav();
    renderSessionInfo();

    if ("serviceWorker" in navigator) {
        try {
            await navigator.serviceWorker.register("./service-worker.js");
        } catch (error) {
            setStatus("Service worker registration failed (non-fatal).");
        }
    }

    const startRoute = determineStartRoute();
    await navigateTo(startRoute);
}

window.addEventListener("DOMContentLoaded", bootstrap);
