#!/usr/bin/env node
/**
 * Removes a stale .next/dev/lock left behind by a crashed or orphaned
 * Next.js dev server so `next dev` isn't blocked by its duplicate-detection.
 *
 * Safe by design:
 *  - If the lock is missing, does nothing.
 *  - If the recorded PID is alive AND looks like a real next-server process,
 *    leaves the lock alone (so we never disrupt a legitimately running dev).
 *  - Otherwise, removes the lock (and logs/) so the next boot starts clean.
 */

import fs from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const DEV_DIR = path.join(CWD, ".next", "dev");
const LOCK_PATH = path.join(DEV_DIR, "lock");

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

function pidLooksLikeNextServer(pid) {
  try {
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return /next(-server)?|\/next\/dist\//.test(cmd);
  } catch {
    return false;
  }
}

function removeLock(reason) {
  try {
    fs.rmSync(LOCK_PATH, { force: true });
    console.log(`[predev] removed stale .next/dev/lock (${reason})`);
  } catch (err) {
    console.warn(
      `[predev] could not remove stale lock at ${LOCK_PATH}: ${err.message}`,
    );
  }
}

if (!fs.existsSync(LOCK_PATH)) {
  process.exit(0);
}

let raw;
try {
  raw = fs.readFileSync(LOCK_PATH, "utf8");
} catch (err) {
  removeLock(`unreadable: ${err.message}`);
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  removeLock("unparseable JSON");
  process.exit(0);
}

const pid = Number(parsed?.pid);
if (!pidAlive(pid)) {
  removeLock(`pid ${pid || "?"} not alive`);
  process.exit(0);
}

if (!pidLooksLikeNextServer(pid)) {
  removeLock(`pid ${pid} is not a next-server process`);
  process.exit(0);
}

console.log(
  `[predev] existing dev server detected (pid ${pid}); leaving lock intact`,
);
