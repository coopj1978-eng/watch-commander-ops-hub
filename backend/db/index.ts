import { SQLDatabase } from "encore.dev/storage/sqldb";

export default new SQLDatabase("db", {
  migrations: "./migrations",
});

/**
 * SQLPrimitive — value type accepted by `db.rawQuery` / `db.rawExec` /
 * `db.rawQueryAll` in Encore's SQL adapter.
 *
 * Kept as a local alias because the real `Primitive` type in
 * encore.dev/storage/sqldb/database isn't re-exported from the package's
 * public entry (`encore.dev/storage/sqldb`), and importing the internal
 * path trips the TypeScript module-resolution rules at build time.
 *
 * Use this for `params: SQLPrimitive[]` / `values: SQLPrimitive[]` arrays
 * that you then spread into a rawQuery* call — the unknown[] pattern
 * worked in earlier Encore versions but 1.54 tightened the signature and
 * it now fails typecheck.
 */
export type SQLPrimitive =
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | Date
  | Date[]
  | Buffer
  | Record<string, any>
  | Record<string, any>[]
  | bigint
  | bigint[]
  | null
  | undefined;
