// Test support only - never imported by the app.
//
// Builds CREATE TABLE / FOREIGN KEY DDL straight from shared/schema.ts
// (Drizzle's own table metadata), so database integration tests run
// against exactly the tables, NOT NULLs, defaults, unique constraints and
// foreign keys (with their ON DELETE actions) the application code
// declares - no hand-maintained copy that could drift.

import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import { getTableName, is, SQL } from "drizzle-orm";
import * as schema from "@shared/schema";

const dialect = new PgDialect();
const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function literal(value: unknown, sqlType: string): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (/json/i.test(sqlType) || typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  throw new Error(`schemaDdl: unsupported default ${String(value)}`);
}

export interface SchemaDdl {
  tables: string[];
  foreignKeys: string[];
  tableNames: string[];
}

export function buildSchemaDdl(): SchemaDdl {
  const tables: string[] = [];
  const foreignKeys: string[] = [];
  const tableNames: string[] = [];

  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value as PgTable);
    tableNames.push(config.name);
    const lines: string[] = [];

    for (const column of config.columns) {
      const sqlType = column.getSQLType();
      let line = `${quoteIdent(column.name)} ${sqlType}`;
      if (column.primary) line += " PRIMARY KEY";
      if (column.notNull && !column.primary) line += " NOT NULL";
      if (column.hasDefault && column.default !== undefined) {
        const defaultSql = is(column.default, SQL)
          ? dialect.sqlToQuery(column.default as SQL).sql
          : literal(column.default, sqlType);
        line += ` DEFAULT ${defaultSql}`;
      }
      if (column.isUnique) line += " UNIQUE";
      lines.push(line);
    }

    for (const pk of config.primaryKeys) {
      lines.push(`PRIMARY KEY (${pk.columns.map((c) => quoteIdent(c.name)).join(", ")})`);
    }
    for (const unique of config.uniqueConstraints) {
      lines.push(`UNIQUE (${unique.columns.map((c) => quoteIdent(c.name)).join(", ")})`);
    }

    tables.push(`CREATE TABLE ${quoteIdent(config.name)} (\n  ${lines.join(",\n  ")}\n);`);

    for (const fk of config.foreignKeys) {
      const reference = fk.reference();
      const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete.toUpperCase()}` : "";
      const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate.toUpperCase()}` : "";
      foreignKeys.push(
        `ALTER TABLE ${quoteIdent(config.name)} ADD FOREIGN KEY (${reference.columns.map((c) => quoteIdent(c.name)).join(", ")}) ` +
          `REFERENCES ${quoteIdent(getTableName(reference.foreignTable))} (${reference.foreignColumns.map((c) => quoteIdent(c.name)).join(", ")})` +
          `${onDelete}${onUpdate};`
      );
    }
  }

  return { tables, foreignKeys, tableNames };
}
