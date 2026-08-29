declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly pid: number;
  readonly platform: string;
  readonly versions: Readonly<Record<string, string | undefined>>;
};

declare module "node:crypto" {
  interface Hash {
    update(value: string | Uint8Array, encoding?: string): Hash;
    digest(encoding: "hex"): string;
  }

  export function createHash(algorithm: "sha256"): Hash;
  export function randomUUID(): string;
}

declare module "node:fs" {
  interface Stats {
    readonly dev: number | bigint;
    readonly ino: number | bigint;
    readonly mode: number;
    readonly size: number;
    readonly mtimeMs: number;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }

  interface MkdirOptions {
    readonly recursive?: boolean;
    readonly mode?: number;
  }

  interface WriteFileOptions {
    readonly encoding?: string;
    readonly flag?: string;
    readonly mode?: number;
  }

  export const constants: Readonly<Record<string, number>>;
  export function closeSync(fileDescriptor: number): void;
  export function existsSync(path: string): boolean;
  export function fchmodSync(fileDescriptor: number, mode: number): void;
  export function fstatSync(fileDescriptor: number): Stats;
  export function fsyncSync(fileDescriptor: number): void;
  export function lstatSync(path: string): Stats;
  export function mkdirSync(path: string, options?: MkdirOptions): string | undefined;
  export function openSync(path: string, flags: string | number, mode?: number): number;
  export function readFileSync(path: string | number): Uint8Array;
  export function readdirSync(path: string): string[];
  export function realpathSync(path: string): string;
  export namespace realpathSync {
    function native(path: string): string;
  }
  export function renameSync(oldPath: string, newPath: string): void;
  export function statSync(path: string): Stats;
  export function unlinkSync(path: string): void;
  export function writeFileSync(
    path: string | number,
    data: string | Uint8Array,
    options?: WriteFileOptions | string,
  ): void;
}

declare module "node:path" {
  interface PathApi {
    readonly sep: string;
    basename(path: string): string;
    dirname(path: string): string;
    isAbsolute(path: string): boolean;
    join(...paths: string[]): string;
    parse(path: string): { readonly root: string };
    relative(from: string, to: string): string;
    resolve(...paths: string[]): string;
  }

  const path: PathApi;
  export default path;
}

declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;

  export interface StatementResultingChanges {
    readonly changes: number | bigint;
    readonly lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    all(...values: SQLInputValue[]): Record<string, unknown>[];
    get(...values: SQLInputValue[]): Record<string, unknown> | undefined;
    run(...values: SQLInputValue[]): StatementResultingChanges;
    setReadBigInts(enabled: boolean): void;
  }

  export interface DatabaseSyncOptions {
    readonly readOnly?: boolean;
    readonly timeout?: number;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    readonly isOpen: boolean;
    readonly isTransaction: boolean;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    serialize(schema?: string): Uint8Array;
  }

  export function backup(sourceDb: DatabaseSync, path: string): Promise<void>;
}

declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}
