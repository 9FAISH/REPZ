import { useRef, useState } from 'react'
import {
  exportBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
  BackupError,
  type BackupFile,
} from '../../lib/backup'
import './BackupCard.css'

/** Export/import JSON backup. This phone holds the only copy of the data,
 *  so restore is deliberately two-step and spells out what it replaces. */
export function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const doExport = async () => {
    setBusy(true)
    try {
      downloadBackup(await exportBackup())
      setMessage('Backup saved.')
    } catch (err) {
      console.error('[repz] export failed', err)
      setMessage('Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File) => {
    setMessage(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setPending(null)
      setMessage(err instanceof BackupError ? err.message : 'Could not read that file.')
    }
  }

  const confirmRestore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const counts = await restoreBackup(pending)
      setPending(null)
      setMessage(
        `Restored ${counts.setLogs} sets, ${counts.sessions} sessions, ${counts.weightLog} weigh-ins.`,
      )
    } catch (err) {
      console.error('[repz] restore failed', err)
      setMessage('Restore failed — your existing data is unchanged.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card backup-card">
      <div className="section-label">BACKUP</div>
      <div className="backup-text">
        Everything lives on this phone. Export a JSON copy somewhere safe — it restores your whole
        history on a new device.
      </div>

      <div className="backup-actions">
        <button className="backup-btn" disabled={busy} onClick={() => void doExport()}>
          Export backup
        </button>
        <button className="backup-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="backup-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // let the same file be picked again
            if (f) void onFile(f)
          }}
        />
      </div>

      {pending && (
        <div className="backup-confirm">
          <div className="backup-confirm-text">
            Restore the backup from{' '}
            <b>{new Date(pending.exportedAt).toLocaleDateString()}</b>? This <b>replaces</b> all
            current data on this phone — {pending.data.setLogs?.length ?? 0} sets,{' '}
            {pending.data.weightLog?.length ?? 0} weigh-ins.
          </div>
          <div className="backup-confirm-actions">
            <button className="backup-cancel" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="backup-replace" disabled={busy} onClick={() => void confirmRestore()}>
              Replace everything
            </button>
          </div>
        </div>
      )}

      {message && <div className="backup-message">{message}</div>}
    </section>
  )
}
