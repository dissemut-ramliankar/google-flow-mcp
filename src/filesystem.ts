import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function canonicalRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return realpath(root);
}

export async function existingFileWithinRoot(root: string, filePath: string, label: string): Promise<string> {
  const resolvedRoot = await canonicalRoot(path.resolve(root));
  const requested = path.resolve(filePath);
  if (!isWithin(resolvedRoot, requested)) throw new Error(`${label} is outside the allowed root.`);
  const resolvedFile = await realpath(requested);
  if (!isWithin(resolvedRoot, resolvedFile)) throw new Error(`${label} escapes the allowed root through a symlink.`);
  if (!(await lstat(resolvedFile)).isFile()) throw new Error(`${label} must be a regular file.`);
  return resolvedFile;
}

export async function directoryWithinRoot(root: string, directoryPath: string, label: string): Promise<string> {
  const configuredRoot = path.resolve(root);
  const resolvedRoot = await canonicalRoot(configuredRoot);
  const requested = path.resolve(directoryPath);
  if (!isWithin(configuredRoot, requested)) throw new Error(`${label} is outside the allowed root.`);
  let current = resolvedRoot;
  const segments = path.relative(configuredRoot, requested).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    const next = path.join(current, segment);
    try {
      const details = await lstat(next);
      if (!details.isDirectory() && !details.isSymbolicLink()) throw new Error(`${label} directory contains a non-directory path.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(next);
    }
    const resolvedNext = await realpath(next);
    if (!isWithin(resolvedRoot, resolvedNext)) throw new Error(`${label} escapes the allowed root through a symlink.`);
    current = resolvedNext;
  }
  return current;
}

export async function newFileWithinRoot(root: string, directoryPath: string, fileName: string, label: string): Promise<string> {
  if (path.basename(fileName) !== fileName || fileName === "." || fileName === "..") throw new Error(`Invalid ${label} file name.`);
  const directory = await directoryWithinRoot(root, directoryPath, label);
  const destination = path.join(directory, fileName);
  try {
    await lstat(destination);
    throw new Error(`${label} destination already exists: ${destination}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return destination;
}
