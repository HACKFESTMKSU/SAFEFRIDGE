import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Segmented } from '../components/ui/Segmented'
import { useData } from '../context/DataContext'
import {
  fmtRelative,
  severityLabel,
  statusLabel,
} from '../lib/format'
import type { IncidentStatus } from '../types'

export function IncidentsPage() {
  const { incidents, assets } = useData()
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all')

  const rows = useMemo(() => {
    return incidents
      .filter((i) => (filter === 'all' ? true : i.status === filter))
      .slice()
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  }, [incidents, filter])

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Incidents</h2>
          <p>Threshold breaches and device issues. Acknowledge and resolve from the detail view.</p>
        </div>
        <Segmented
          label="Filter incidents by status"
          value={filter}
          onChange={setFilter}
          options={(['all', 'open', 'acknowledged', 'resolved'] as const).map((f) => ({
            value: f,
            label: f === 'all' ? 'All' : statusLabel(f),
          }))}
        />
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th>Asset</th>
                <th>Status</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inc) => {
                const asset = assets.find((a) => a.id === inc.assetId)
                return (
                  <tr key={inc.id}>
                    <td>
                      <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>
                        {severityLabel(inc.severity)}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        to={`/incidents/${inc.id}`}
                      >
                        {inc.title}
                      </Link>
                    </td>
                    <td>{asset?.name ?? inc.assetId}</td>
                    <td>
                      <Badge tone={inc.status === 'resolved' ? 'ok' : 'neutral'}>
                        {statusLabel(inc.status)}
                      </Badge>
                    </td>
                    <td>{fmtRelative(inc.detectedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="empty">No incidents in this filter.</div> : null}
        </div>
      </section>
    </>
  )
}
