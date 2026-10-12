// "Previous reports" (CLINIC-011): thumbnails of the report photos the attender took,
// and a full-size viewer you can zoom. Nothing here reads the images — the doctor just
// looks at them. The same object URL (see hooks/useReportImages.js) feeds the thumbnail
// and the viewer.
import { useEffect, useState } from 'react'
import { useReportImages } from '../hooks/useReportImages'

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.5

const clamp = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
const isLoaded = (src) => src && src !== 'error'

// Mounted with key={index}, so moving to another photo starts at normal zoom.
function Viewer({ reports, images, index, onIndex, onClose }) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const src = images[reports[index].id]
  const last = reports.length - 1

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < last) onIndex(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, last, onIndex, onClose])

  return (
    <div className="rv-overlay" role="dialog" aria-modal="true" aria-label="Report photo" onClick={onClose}>
      <div className="rv-bar" onClick={(e) => e.stopPropagation()}>
        <span className="rv-count">{index + 1} / {reports.length}</span>
        <div className="rv-tools">
          <button onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">−</button>
          <button onClick={() => setZoom(MIN_ZOOM)} disabled={zoom === MIN_ZOOM}>Reset</button>
          <button onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">+</button>
          <button className="rv-close" onClick={onClose} aria-label="Close" autoFocus>✕</button>
        </div>
      </div>

      <div
        className="rv-stage"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => setZoom((z) => clamp(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))}
      >
        {isLoaded(src) ? (
          <img className="rv-img" src={src} alt={`Previous report ${index + 1}`} style={{ width: `${zoom * 100}%` }} />
        ) : (
          <div className="rv-msg">{src === 'error' ? 'Could not load this photo.' : 'Loading…'}</div>
        )}
      </div>

      {reports.length > 1 ? (
        <div className="rv-nav" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onIndex(index - 1)} disabled={index === 0}>‹ Previous</button>
          <button onClick={() => onIndex(index + 1)} disabled={index === last}>Next ›</button>
        </div>
      ) : null}
    </div>
  )
}

export default function ReportsList({ reports }) {
  const images = useReportImages(reports)
  const [openIndex, setOpenIndex] = useState(null)

  if (!reports.length) return null

  return (
    <section className="reports">
      <h3 className="reports-title">Previous reports <span className="reports-count">{reports.length}</span></h3>
      <div className="reports-grid">
        {reports.map((r, i) => (
          <button key={r.id} className="reports-thumb" onClick={() => setOpenIndex(i)} aria-label={`Open report photo ${i + 1}`}>
            {isLoaded(images[r.id]) ? (
              <img src={images[r.id]} alt={`Previous report ${i + 1}`} />
            ) : (
              <span className="reports-thumb-msg">{images[r.id] === 'error' ? 'Failed' : '…'}</span>
            )}
          </button>
        ))}
      </div>
      {openIndex !== null ? (
        <Viewer
          key={openIndex}
          reports={reports}
          images={images}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </section>
  )
}
