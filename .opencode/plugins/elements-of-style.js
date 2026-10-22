// elements-of-style plugin for OpenCode — registers the skills directory.
// Dual-compatible: V1 loads the named export (config hook), V2 loads the
// default export { id, setup } and registers skills via ctx.skill.transform.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const skillsDir = path.resolve(__dirname, '../../skills')

export const ElementsOfStylePlugin = async ({ client, directory }) => {
  return {
    // Inject the plugin's skills path into live config so OpenCode discovers
    // its skills without requiring manual symlinks or config file edits.
    config: async (config) => {
      config.skills = config.skills || {}
      config.skills.paths = config.skills.paths || []
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir)
      }
    },
  }
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, content: raw }
  const frontmatter = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) frontmatter[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return { frontmatter, content: match[2] }
}

async function setup(ctx) {
  // V1 also calls default.setup with a ctx lacking the skill domain; the
  // named export already serves V1, so bail out quietly.
  if (!ctx?.skill || typeof ctx.skill.transform !== 'function') return

  const skills = []
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillPath)) continue
      const { frontmatter, content } = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'))
      skills.push({
        id: entry.name,
        name: frontmatter.name || entry.name,
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        path: skillPath,
        content,
      })
    }
  }

  await ctx.skill.transform((draft) => {
    for (const skill of skills) {
      try {
        draft.add(skill)
      } catch (err) {
        // A throw escaping here hard-disables the whole plugin; skip the skill instead.
        console.error(`[elements-of-style] skill "${skill.id}" rejected by host, skipping:`, err)
      }
    }
  })
}

export default {
  id: 'elements-of-style',
  server: ElementsOfStylePlugin,
  setup,
}
