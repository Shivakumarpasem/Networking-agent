import pg from 'pg'
import { readFileSync, existsSync, renameSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const LEGACY_FILE = join(__dirname, 'data', 'contacts.json')

if (!process.env.DATABASE_URL) {
  console.error('\nERROR: DATABASE_URL is not set in .env')
  console.error('Add your PostgreSQL connection string to .env')
  console.error('Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/networking_agent\n')
  process.exit(1)
}

const isLocal =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

// Create the contacts table if it does not exist
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT        PRIMARY KEY,
      data        JSONB       NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // One-time migration: if contacts.json exists, move it into Postgres
  if (existsSync(LEGACY_FILE)) {
    try {
      const raw = readFileSync(LEGACY_FILE, 'utf8').trim()
      if (raw) {
        const contacts = JSON.parse(raw)
        if (Array.isArray(contacts) && contacts.length > 0) {
          for (const contact of contacts) {
            await pool.query(
              `INSERT INTO contacts (id, data, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [contact.id, JSON.stringify(contact)]
            )
          }
          console.log(`Migrated ${contacts.length} contacts from contacts.json to PostgreSQL`)
        }
      }
      // Rename the file so we do not migrate again on next start
      renameSync(LEGACY_FILE, LEGACY_FILE + '.migrated')
    } catch (err) {
      console.warn('Could not migrate contacts.json:', err.message)
    }
  }

  console.log('Database ready')
}

// Return all contacts ordered by creation date
export async function getAllContacts() {
  const result = await pool.query(`
    SELECT data FROM contacts
    ORDER BY (data->>'createdAt') ASC NULLS LAST
  `)
  return result.rows.map(r => r.data)
}

// Replace the full contacts list using upsert + delete in one transaction
export async function saveContacts(contacts) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert every contact in the array
    for (const contact of contacts) {
      await client.query(
        `INSERT INTO contacts (id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
           SET data = $2, updated_at = NOW()`,
        [contact.id, JSON.stringify(contact)]
      )
    }

    // Delete any contacts that were removed from the frontend
    if (contacts.length > 0) {
      const ids = contacts.map(c => c.id)
      await client.query(
        'DELETE FROM contacts WHERE id != ALL($1::text[])',
        [ids]
      )
    } else {
      await client.query('DELETE FROM contacts')
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
