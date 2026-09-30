import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd());
const typesPath = path.join(rootDir, "src", "integrations", "supabase", "types.ts");
const outPath = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20240101000000_init_schema.sql",
);

const source = fs.readFileSync(typesPath, "utf8");

function extractConstantsEnumsBlock(src) {
  const match = src.match(
    /export const Constants = \{\s*public:\s*\{\s*Enums:\s*\{([\s\S]*?)\}\s*,\s*\}\s*,\s*\}\s*as const/s,
  );
  if (!match) {
    throw new Error("Tidak menemukan Constants.public.Enums pada types.ts");
  }
  return match[1];
}

function parseEnumArrays(block) {
  const enums = new Map();
  let i = 0;
  while (i < block.length) {
    const keyMatch = block.slice(i).match(/^\s*([a-zA-Z0-9_]+)\s*:\s*\[/);
    if (!keyMatch) {
      i += 1;
      continue;
    }
    const key = keyMatch[1];
    i += keyMatch[0].length;
    let depth = 1;
    let buf = "";
    while (i < block.length && depth > 0) {
      const ch = block[i];
      if (ch === "[") depth += 1;
      if (ch === "]") depth -= 1;
      if (depth > 0) buf += ch;
      i += 1;
    }
    const values = buf
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^"|"$/g, ""));
    enums.set(key, values);
  }
  return enums;
}

function parseTables(src) {
  const tables = [];
  const tableRe =
    /^\s{6}([a-zA-Z0-9_]+):\s*\{\s*\n\s{8}Row:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Insert:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Update:\s*\{\n([\s\S]*?)\n\s{8}\}\n\s{8}Relationships:\s*([\s\S]*?)\n\s{6}\}\n/mg;
  let m;
  while ((m = tableRe.exec(src)) !== null) {
    const [, name, rowBlock, insertBlock, updateBlock, relBlock] = m;
    const relationships = relBlock.trim().startsWith("[")
      ? relBlock.trim()
      : "[]";
    tables.push({
      name,
      rowBlock,
      insertBlock,
      updateBlock,
      relationships,
    });
  }
  if (tables.length === 0) {
    throw new Error("Tidak menemukan definisi Tables pada types.ts");
  }
  return tables;
}

function parseRowColumns(rowBlock) {
  const cols = [];
  for (const line of rowBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const mm = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
    if (!mm) continue;
    const [, col, typeExpr] = mm;
    cols.push({ col, typeExpr: typeExpr.trim() });
  }
  return cols;
}

function detectOptionalInsertCols(insertBlock) {
  const optional = new Set();
  for (const line of insertBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const mm = trimmed.match(/^([a-zA-Z0-9_]+)\?:/);
    if (mm) optional.add(mm[1]);
  }
  return optional;
}

function parseRelationships(relBlock) {
  const rels = [];
  const block = relBlock.trim();
  if (!block.startsWith("[")) return rels;
  const itemRe =
    /\{\s*foreignKeyName:\s*"([^"]+)"[\s\S]*?columns:\s*\[([^\]]*)\][\s\S]*?referencedRelation:\s*"([^"]+)"[\s\S]*?referencedColumns:\s*\[([^\]]*)\][\s\S]*?\}/g;
  let m;
  while ((m = itemRe.exec(block)) !== null) {
    const [, fkName, colsRaw, refRel, refColsRaw] = m;
    const cols = colsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^"|"$/g, ""));
    const refCols = refColsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^"|"$/g, ""));
    rels.push({ fkName, cols, refRel, refCols });
  }
  return rels;
}

function toSqlIdentifier(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

function resolveSqlType(colName, typeExpr) {
  const isNullable = /\|\s*null\b/.test(typeExpr);
  const core = typeExpr.replace(/\s*\|\s*null\b/g, "").trim();

  let sqlType;

  const enumMatch = core.match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/);
  if (enumMatch) {
    sqlType = `public.${toSqlIdentifier(enumMatch[1])}`;
    return { sqlType, isNullable };
  }

  if (/\bJson\b/.test(core)) {
    return { sqlType: "jsonb", isNullable };
  }

  if (/\bboolean\b/.test(core)) {
    return { sqlType: "boolean", isNullable };
  }

  if (/\bnumber\b/.test(core)) {
    return { sqlType: "integer", isNullable };
  }

  if (/\bstring\[\]\b/.test(core)) {
    const isUuidArray = /_ids$/.test(colName) || /_id$/.test(colName);
    return { sqlType: `${isUuidArray ? "uuid" : "text"}[]`, isNullable };
  }

  if (/\bstring\b/.test(core)) {
    const isUuid =
      colName === "id" ||
      /_id$/.test(colName) ||
      /_by$/.test(colName) ||
      ["user_id", "parent_id", "child_id"].includes(colName);
    if (isUuid) return { sqlType: "uuid", isNullable };

    if (/_at$/.test(colName) || ["created_at", "updated_at"].includes(colName)) {
      return { sqlType: "timestamptz", isNullable };
    }

    return { sqlType: "text", isNullable };
  }

  return { sqlType: "text", isNullable };
}

function buildSql(enums, tables) {
  const lines = [];

  lines.push("create extension if not exists pgcrypto;");
  lines.push("");

  for (const [enumName, values] of enums.entries()) {
    const quotedVals = values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ");
    lines.push(
      `do $$ begin create type public.${toSqlIdentifier(enumName)} as enum (${quotedVals}); exception when duplicate_object then null; end $$;`,
    );
  }
  lines.push("");

  for (const t of tables) {
    const cols = parseRowColumns(t.rowBlock);
    const optionalInsert = detectOptionalInsertCols(t.insertBlock);

    const colLines = [];
    let hasId = false;

    for (const c of cols) {
      const { sqlType, isNullable } = resolveSqlType(c.col, c.typeExpr);
      const notNull = isNullable ? "" : " not null";
      let def = "";
      if (c.col === "id") {
        hasId = true;
        if (optionalInsert.has("id")) {
          def = " default gen_random_uuid()";
        }
      }
      if (c.col === "created_at" && optionalInsert.has("created_at")) {
        def = " default now()";
      }
      if (c.col === "updated_at" && optionalInsert.has("updated_at")) {
        def = " default now()";
      }

      colLines.push(
        `${toSqlIdentifier(c.col)} ${sqlType}${def}${notNull}`,
      );
    }

    if (hasId) {
      colLines.push(`primary key (${toSqlIdentifier("id")})`);
    }

    lines.push(`create table if not exists public.${toSqlIdentifier(t.name)} (`);
    lines.push(`  ${colLines.join(",\n  ")}`);
    lines.push(");");
    lines.push("");
  }

  for (const t of tables) {
    const rels = parseRelationships(t.relationships);
    for (const r of rels) {
      const cols = r.cols.map(toSqlIdentifier).join(", ");
      const refCols = r.refCols.map(toSqlIdentifier).join(", ");
      lines.push(
        `do $$ begin alter table public.${toSqlIdentifier(
          t.name,
        )} add constraint ${toSqlIdentifier(
          r.fkName,
        )} foreign key (${cols}) references public.${toSqlIdentifier(
          r.refRel,
        )} (${refCols}); exception when duplicate_object then null; end $$;`,
      );
    }
  }

  lines.push("");
  lines.push(
    `create or replace function public.has_role(_user_id uuid, _role public.${toSqlIdentifier(
      "app_role",
    )}) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;`,
  );
  lines.push("");

  return lines.join("\n");
}

const enumsBlock = extractConstantsEnumsBlock(source);
const enums = parseEnumArrays(enumsBlock);
const tables = parseTables(source);
const sql = buildSql(enums, tables);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sql, "utf8");

process.stdout.write(`Generated ${path.relative(rootDir, outPath)}\n`);
