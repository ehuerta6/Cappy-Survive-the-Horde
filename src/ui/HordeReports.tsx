import type { HordeReport } from '../game/types';
export function HordeReports({ reports }: { reports: HordeReport[] }) {
  if (!reports.length) return null;
  return <section className="reports"><h3>Performance reports · measured behavior</h3><div className="report-list">{reports.map(report => <div className="report" key={report.horde}><h3>Horde {report.horde} — {report.survived ? 'HORDE SURVIVED' : 'GAME OVER'}</h3><p>Storage Inspections: <b>{report.inspections}</b><br />Items Retrieved: <b>{report.itemsRetrieved}</b><br />Wood Retrieved: <b>{report.woodRetrieved}</b><br />Base Repairs: <b>{report.repairs}</b><br />Base HP Remaining: <b>{report.health}</b><br />Average inspections / wood retrieval: <b>{report.woodRetrieved ? (report.inspections / report.woodRetrieved).toFixed(2) : '—'}</b></p></div>)}</div></section>;
}
