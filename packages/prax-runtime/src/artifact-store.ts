import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  ARTIFACT_FILES,
  DesignSessionSchema,
  type ArtifactKey,
  type DesignMode,
  type DesignSession,
} from "./contracts.js";

const IndexEntrySchema = z.object({
  session_file: z.string().min(1),
  project_root: z.string().min(1),
  updated_at: z.string().datetime(),
});

const SessionIndexSchema = z.object({
  version: z.literal("0.1"),
  sessions: z.record(z.string(), IndexEntrySchema).default({}),
});

type SessionIndex = z.infer<typeof SessionIndexSchema>;

export class PraxRuntimeError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PraxRuntimeError";
  }
}

export interface ArtifactWrite {
  key: ArtifactKey;
  value: unknown;
}

export interface SessionStoreOptions {
  stateRoot?: string;
  now?: () => Date;
  idGenerator?: () => string;
}

function serializeYaml(value: unknown): string {
  return stringify(value, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}

async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch {
      // The temp path may not have been created. Preserve the original error.
    }
    throw error;
  }
}

function defaultSessionId(now: Date): string {
  const timestamp = now
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
  return `ds_${timestamp}_${randomUUID().slice(0, 8)}`;
}

export function defaultPraxStateRoot(): string {
  return resolve(process.env.PRAX_STATE_ROOT ?? join(homedir(), ".prax"));
}

export class FileSessionStore {
  public readonly stateRoot: string;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private queue: Promise<void> = Promise.resolve();

  public constructor(options: SessionStoreOptions = {}) {
    this.stateRoot = resolve(options.stateRoot ?? defaultPraxStateRoot());
    this.now = options.now ?? (() => new Date());
    this.idGenerator =
      options.idGenerator ?? (() => defaultSessionId(this.now()));
  }

  public nowIso(): string {
    return this.now().toISOString();
  }

  public async createSession(input: {
    projectRoot: string;
    requirement: string;
    mode: DesignMode;
    projectId?: string;
  }): Promise<DesignSession> {
    return this.withLock(async () => {
      const projectRoot = resolve(input.projectRoot);
      let projectStats;
      try {
        projectStats = await stat(projectRoot);
      } catch {
        throw new PraxRuntimeError(
          "PROJECT_ROOT_NOT_FOUND",
          `Project root does not exist: ${projectRoot}`,
        );
      }
      if (!projectStats.isDirectory()) {
        throw new PraxRuntimeError(
          "PROJECT_ROOT_NOT_DIRECTORY",
          `Project root is not a directory: ${projectRoot}`,
        );
      }

      const id = this.idGenerator();
      const index = await this.readIndex();
      if (index.sessions[id] !== undefined) {
        throw new PraxRuntimeError(
          "SESSION_ID_COLLISION",
          `Generated design_session_id already exists: ${id}`,
        );
      }

      const now = this.nowIso();
      const sessionDirectory = this.projectSessionDirectory(projectRoot, id);
      const sessionFile = join(sessionDirectory, ARTIFACT_FILES.session);
      const session: DesignSession = {
        id,
        ...(input.projectId === undefined ? {} : { project_id: input.projectId }),
        project_root: projectRoot,
        mode: input.mode,
        phase: "PRODUCT_FRAMING",
        created_at: now,
        updated_at: now,
        revision: 0,
        requirement_ref: ARTIFACT_FILES.requirement,
        completed_gates: [],
        current_gate: { name: "product_framing" },
        disclosures: [],
        routing_history: [],
        artifacts: {
          requirement: ARTIFACT_FILES.requirement,
          session: ARTIFACT_FILES.session,
        },
        unresolved: [],
        warnings: [],
      };

      await mkdir(sessionDirectory, { recursive: true });
      await writeTextAtomic(
        join(sessionDirectory, ARTIFACT_FILES.requirement),
        `${input.requirement.trim()}\n`,
      );
      await writeTextAtomic(sessionFile, serializeYaml(session));

      index.sessions[id] = {
        session_file: sessionFile,
        project_root: projectRoot,
        updated_at: now,
      };
      await this.writeIndex(index);
      return session;
    });
  }

  public async getSession(sessionId: string): Promise<DesignSession> {
    const index = await this.readIndex();
    const entry = index.sessions[sessionId];
    if (entry === undefined) {
      throw new PraxRuntimeError(
        "SESSION_NOT_FOUND",
        `Unknown design_session_id: ${sessionId}`,
      );
    }
    return this.readSessionFile(entry.session_file);
  }

  public async commit(
    session: DesignSession,
    artifactWrites: readonly ArtifactWrite[] = [],
  ): Promise<DesignSession> {
    return this.withLock(async () => {
      const index = await this.readIndex();
      const entry = index.sessions[session.id];
      if (entry === undefined) {
        throw new PraxRuntimeError(
          "SESSION_NOT_FOUND",
          `Unknown design_session_id: ${session.id}`,
        );
      }

      const persisted = await this.readSessionFile(entry.session_file);
      if (session.revision <= persisted.revision) {
        throw new PraxRuntimeError(
          "STALE_SESSION_REVISION",
          `Refusing revision ${session.revision}; persisted revision is ${persisted.revision}.`,
        );
      }

      const sessionDirectory = dirname(entry.session_file);
      const artifacts = { ...session.artifacts };
      for (const artifact of artifactWrites) {
        const fileName = ARTIFACT_FILES[artifact.key];
        const filePath = join(sessionDirectory, fileName);
        await writeTextAtomic(filePath, serializeYaml(artifact.value));
        artifacts[artifact.key] = fileName;
      }

      const committed = DesignSessionSchema.parse({
        ...session,
        artifacts,
      });
      await writeTextAtomic(entry.session_file, serializeYaml(committed));

      index.sessions[session.id] = {
        ...entry,
        updated_at: committed.updated_at,
      };
      await this.writeIndex(index);
      return committed;
    });
  }

  public async readArtifact<T = unknown>(
    session: DesignSession,
    key: ArtifactKey,
  ): Promise<T | undefined> {
    const relativePath = session.artifacts[key];
    if (relativePath === undefined) {
      return undefined;
    }
    const index = await this.readIndex();
    const entry = index.sessions[session.id];
    if (entry === undefined) {
      throw new PraxRuntimeError(
        "SESSION_NOT_FOUND",
        `Unknown design_session_id: ${session.id}`,
      );
    }
    const text = await readFile(join(dirname(entry.session_file), relativePath), "utf8");
    if (key === "requirement") {
      return text as T;
    }
    return parse(text) as T;
  }

  public async artifactDirectory(sessionId: string): Promise<string> {
    const index = await this.readIndex();
    const entry = index.sessions[sessionId];
    if (entry === undefined) {
      throw new PraxRuntimeError(
        "SESSION_NOT_FOUND",
        `Unknown design_session_id: ${sessionId}`,
      );
    }
    return dirname(entry.session_file);
  }

  private projectSessionDirectory(projectRoot: string, sessionId: string): string {
    return join(projectRoot, ".prax", "design", "sessions", sessionId);
  }

  private indexFile(): string {
    return join(this.stateRoot, "session-index.yaml");
  }

  private async readSessionFile(filePath: string): Promise<DesignSession> {
    try {
      const text = await readFile(filePath, "utf8");
      return DesignSessionSchema.parse(parse(text));
    } catch (error) {
      if (error instanceof PraxRuntimeError) {
        throw error;
      }
      throw new PraxRuntimeError(
        "SESSION_READ_FAILED",
        `Unable to read persisted session at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async readIndex(): Promise<SessionIndex> {
    try {
      const text = await readFile(this.indexFile(), "utf8");
      return SessionIndexSchema.parse(parse(text));
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return { version: "0.1", sessions: {} };
      }
      throw new PraxRuntimeError(
        "SESSION_INDEX_READ_FAILED",
        `Unable to read Prax session index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async writeIndex(index: SessionIndex): Promise<void> {
    const validated = SessionIndexSchema.parse(index);
    await writeTextAtomic(this.indexFile(), serializeYaml(validated));
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.queue;
    let release: () => void = () => undefined;
    this.queue = new Promise<void>((resolveQueue) => {
      release = resolveQueue;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
