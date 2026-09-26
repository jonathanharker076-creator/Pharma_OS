const SESSION_KEY = "pharmacy_os_session";

export function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
    return getSession() !== null;
}
