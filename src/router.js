const routes = new Map();
let currentRoute = null;

export function registerRoute(name, loader) {
    routes.set(name, loader);
}

export async function navigateTo(name, params = {}) {
    const loader = routes.get(name);
    if (!loader) {
        renderNotFound(name);
        return;
    }
    currentRoute = name;
    const container = document.getElementById("content");
    container.innerHTML = "";
    setStatus(`Loading ${name}...`);
    try {
        await loader(container, params);
        setStatus(`Ready: ${name}`);
    } catch (error) {
        container.innerHTML = "";
        const errorBox = document.createElement("div");
        errorBox.className = "message error";
        errorBox.textContent = `Failed to load ${name}: ${error.message}`;
        container.appendChild(errorBox);
        setStatus(`Error loading ${name}`);
    }
}

export function getCurrentRoute() {
    return currentRoute;
}

export function setStatus(message) {
    const status = document.getElementById("status-message");
    if (status) status.textContent = message;
}

function renderNotFound(name) {
    const container = document.getElementById("content");
    container.innerHTML = "";
    const box = document.createElement("div");
    box.className = "message error";
    box.textContent = `Screen not found: ${name}`;
    container.appendChild(box);
    setStatus("Screen not found");
}
