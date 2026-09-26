const DB_FILENAME = "pharmacy-os.sqlite";
const SCHEMA_VERSION = 1;

let db = null;
let SQL = null;

async function loadSqlJs() {
    if (SQL) return SQL;
    const module = await import(
        "https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js"
    );
    SQL = await module.default({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${file}`
    });
    return SQL;
}

async function openOpfsDatabase() {
    if (!navigator.storage || !navigator.storage.getDirectory) {
        throw new Error(
            "Origin Private File System is not supported in this browser."
        );
    }
    const root = await navigator.storage.getDirectory();
    return await root.getFileHandle(DB_FILENAME, { create: true });
}

async function readFileBytes(fileHandle) {
    const file = await fileHandle.getFile();
    if (file.size === 0) return null;
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
}

async function writeFileBytes(fileHandle, bytes) {
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
}

async function loadSchemaFragment(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load schema fragment: ${path}`);
    }
    return await response.text();
}

async function applySchemaIfNeeded(database) {
    const result = database.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    );
    const hasMigrationsTable = result.length > 0;

    if (!hasMigrationsTable) {
        const baseSchema = await loadSchemaFragment("./src/schema/001_company.sql");
        database.run(baseSchema);
        database.run(
            "INSERT INTO schema_migrations (version) VALUES (?)",
            [SCHEMA_VERSION]
        );
        return;
    }

    const versionResult = database.exec(
        "SELECT MAX(version) AS version FROM schema_migrations"
    );
    const currentVersion =
        versionResult.length > 0 && versionResult[0].values.length > 0
            ? versionResult[0].values[0][0]
            : 0;

    if (currentVersion < SCHEMA_VERSION) {
        // Future migration fragments will be applied here in later modules.
        database.run(
            "INSERT INTO schema_migrations (version) VALUES (?)",
            [SCHEMA_VERSION]
        );
    }
}

export async function initDatabase() {
    const sqlJs = await loadSqlJs();
    const fileHandle = await openOpfsDatabase();
    const existingBytes = await readFileBytes(fileHandle);

    if (existingBytes) {
        db = new sqlJs.Database(existingBytes);
    } else {
        db = new sqlJs.Database();
    }

    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = MEMORY;");

    await applySchemaIfNeeded(db);

    await persistDatabase();

    return {
        db,
        fileHandle
    };
}

export async function persistDatabase() {
    if (!db) return;
    const fileHandle = await openOpfsDatabase();
    const bytes = db.export();
    await writeFileBytes(fileHandle, bytes);
}

export function query(sql, params = []) {
    if (!db) throw new Error("Database not initialized.");
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

export function queryOne(sql, params = []) {
    const rows = query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql, params = []) {
    if (!db) throw new Error("Database not initialized.");
    db.run(sql, params);
    await persistDatabase();
}

export async function executeTransaction(statements) {
    if (!db) throw new Error("Database not initialized.");
    db.run("BEGIN TRANSACTION;");
    try {
        for (const statement of statements) {
            db.run(statement.sql, statement.params || []);
        }
        db.run("COMMIT;");
    } catch (error) {
        db.run("ROLLBACK;");
        throw error;
    }
    await persistDatabase();
}

export async function exportDatabaseBytes() {
    if (!db) throw new Error("Database not initialized.");
    return db.export();
}

export async function replaceDatabaseBytes(bytes) {
    const sqlJs = await loadSqlJs();
    if (db) db.close();
    db = new sqlJs.Database(bytes);
    db.run("PRAGMA foreign_keys = ON;");
    await persistDatabase();
}

export function isInitialized() {
    return db !== null;
}
