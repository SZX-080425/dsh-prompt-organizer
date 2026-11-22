/**
 * Local state and output paths for Prompt Organizer.
 * Briefs live under the DSH home so they survive a workspace change; finished
 * documents default to the current workspace so they are easy to open.
 * @module prompt-organizer/storage
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Expand a leading `~` to the user's home directory.
 * @param {string} value - configured path.
 * @returns {string} expanded path.
 */
export function expandHome(value) {
  if (value === '~') return os.homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(os.homedir(), value.slice(2))
  return value
}

/**
 * Resolve the directory that holds briefs and saved state.
 * @param {string} [configured] - `stateDir` config value.
 * @returns {string} absolute directory.
 */
export function resolveStateDir(configured) {
  if (typeof configured === 'string' && configured.trim() !== '') return path.resolve(expandHome(configured.trim()))
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'prompt-organizer')
}

/**
 * Resolve the directory that receives composed documents.
 * @param {string} cwd - the agent's working directory.
 * @param {string} [configured] - `outputDir` config value; absolute or cwd-relative.
 * @returns {string} absolute directory.
 */
export function resolveOutputDir(cwd, configured) {
  if (typeof configured === 'string' && configured.trim() !== '') {
    const expanded = expandHome(configured.trim())
    return path.isAbsolute(expanded) ? expanded : path.join(cwd, expanded)
  }
  return path.join(cwd, 'prompt-organizer')
}

/**
 * Build a sortable, collision-resistant brief id.
 * @param {Date} [date] - timestamp source.
 * @returns {string} id such as `po-20261122-174501-a1b2`.
 */
export function timestampId(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  const suffix = Math.random().toString(36).slice(2, 6)
  return `po-${stamp}-${suffix}`
}

/**
 * A compact date stamp for document filenames.
 * @param {Date} [date] - timestamp source.
 * @returns {string} `YYYYMMDD-HHmm`.
 */
export function fileStamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

/**
 * Write a UTF-8 file, creating parent directories.
 * @param {string} filePath - destination.
 * @param {string} content - file content.
 * @returns {string} the written path.
 */
export function writeTextFile(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf8')
  return filePath
}
