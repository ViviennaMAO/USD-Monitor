import { promises as fs } from 'fs'
import path from 'path'

const OUTPUT_DIR = path.join(process.cwd(), 'pipeline', 'output')

export async function readPipelineJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(OUTPUT_DIR, filename)
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
