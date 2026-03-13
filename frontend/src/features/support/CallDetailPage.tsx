import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVoiceCall } from '@/api/support_phase3';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ringing: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  missed: { bg: 'bg-red-100', text: 'text-red-600' },
  voicemail: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDuration(seconds: number) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400 text-sm">Not analyzed</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? '#6fd943' : score >= 0.4 ? '#ffa21d' : '#ff3a6e';
  const label = score >= 0.6 ? 'Positive' : score >= 0.4 ? 'Neutral' : 'Negative';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label} ({pct}%)
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: call, isLoading } = useVoiceCall(id ?? '');

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const handleSaveNotes = () => {
    // In a real implementation this would PATCH to the API
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-gray-400">Loading call details…</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">Call not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm underline"
          style={{ color: '#51459d' }}
        >
          Go back
        </button>
      </div>
    );
  }

  const ss = STATUS_STYLES[call.status] ?? STATUS_STYLES.completed;
  const dir = call.direction === 'inbound' ? 'Inbound' : 'Outbound';
  const dirColor = call.direction === 'inbound' ? '#3ec9d6' : '#6fd943';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← Back to calls
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {call.customer_name ?? call.customer_phone ?? 'Unknown Caller'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{call.customer_phone ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          <span
            className="px-3 py-1 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: dirColor }}
          >
            {dir}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${ss.bg} ${ss.text}`}>
            {call.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Call Details</h2>
          <MetaRow label="Agent" value={call.agent_name ?? '—'} />
          <MetaRow label="Started" value={formatDate(call.started_at)} />
          <MetaRow label="Answered" value={formatDate(call.answered_at)} />
          <MetaRow label="Ended" value={formatDate(call.ended_at)} />
          <MetaRow label="Duration" value={formatDuration(call.duration_seconds)} />
          <MetaRow label="Wait Time" value={formatDuration(call.wait_seconds)} />
          <MetaRow
            label="Sentiment"
            value={<SentimentBadge score={call.sentiment_score} />}
          />
          {call.ticket_id && (
            <MetaRow
              label="Linked Ticket"
              value={
                <button
                  onClick={() => navigate(`/support/tickets/${call.ticket_id}`)}
                  className="underline text-sm"
                  style={{ color: '#51459d' }}
                >
                  View Ticket
                </button>
              }
            />
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {call.recording_url && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Recording</h2>
              <audio controls src={call.recording_url} className="w-full" />
            </div>
          )}

          {!call.ticket_id && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Link to Ticket</h2>
              <p className="text-xs text-gray-400 mb-3">Create a support ticket from this call or link to an existing one.</p>
              <button
                onClick={() => navigate(`/support/tickets/new?call_id=${call.id}`)}
                className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#51459d' }}
              >
                Create Ticket from Call
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Transcript</h2>
        {call.transcript ? (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
            {call.transcript}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-400 text-sm">
            No transcript available for this call.
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Notes</h2>
          <button
            onClick={handleSaveNotes}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: notesSaved ? '#6fd943' : '#51459d' }}
          >
            {notesSaved ? 'Saved!' : 'Save Notes'}
          </button>
        </div>
        <textarea
          value={notes || call.notes || ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes about this call…"
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        />
      </div>
    </div>
  );
}
