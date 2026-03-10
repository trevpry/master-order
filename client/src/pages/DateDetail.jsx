import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DateForm from '../components/DateForm';
import EncounterForm from '../components/EncounterForm';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Star,
  Heart,
  MessageSquare,
  Zap,
  CheckCircle,
  Users,
  Activity,
  Info,
  X,
  ChevronRight,
} from 'lucide-react';
import Button from '../components/Button';
import config from '../config';

const API_BASE = `${config.apiBaseUrl}/api/dating`;

const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    pink: 'bg-pink-100 text-pink-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 mt-0.5 break-words">{String(value)}</p>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{title}</h3>
    </div>
    <div className="px-5 py-1">{children}</div>
  </div>
);

const StarRating = ({ value, max = 5 }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`}
      />
    ))}
  </div>
);

const RatingRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <StarRating value={value} />
        <span className="text-xs text-gray-400 w-4 text-right">{value}</span>
      </div>
    </div>
  );
};

export default function DateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState(null);
  const [showEncounterForm, setShowEncounterForm] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    loadDate();
  }, [id]);

  const loadDate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/dates/${id}`);
      if (!res.ok) throw new Error('Date not found');
      setDate(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (updated) => {
    setDate(updated);
    setShowEditForm(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this date?')) return;
    const res = await fetch(`${API_BASE}/dates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (date?.connectionId) {
        navigate(`/dating/connections/${date.connectionId}`);
      } else {
        navigate('/dating');
      }
    }
  };

  const handleEncounterSaved = (saved) => {
    setDate(prev => ({
      ...prev,
      encounters: prev.encounters
        ? prev.encounters.map(e => e.id === saved.id ? saved : e)
        : prev.encounters
    }));
    setShowEncounterForm(false);
    setEditingEncounter(null);
  };

  const handleDeleteEncounter = async (encId) => {
    if (!window.confirm('Delete this encounter?')) return;
    const res = await fetch(`${API_BASE}/encounters/${encId}`, { method: 'DELETE' });
    if (res.ok) {
      setDate(prev => ({ ...prev, encounters: prev.encounters.filter(e => e.id !== encId) }));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  if (error || !date) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-red-600 mb-4">{error || 'Not found'}</p>
      <Button onClick={() => navigate('/dating')}>Back to Dashboard</Button>
    </div>
  );

  const outcomeColor = date.outcome === 'POSITIVE' ? 'green' : date.outcome === 'NEGATIVE' ? 'red' : 'gray';
  const dateLabel = date.activity || date.location || 'Date';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {date.connectionId ? (
              <Link
                to={`/dating/connections/${date.connectionId}`}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {date.connection?.guyName || 'Connection'}
              </Link>
            ) : (
              <Link
                to="/dating"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Dating
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowEditForm(true)}>
              <Edit className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 shadow-inner">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{dateLabel}</h1>
                <Badge color={outcomeColor}>{date.outcome || 'NEUTRAL'}</Badge>
                {date.secondDate && <Badge color="green">2nd Date ✓</Badge>}
              </div>
              <div className="flex items-center gap-3 text-blue-100 text-sm mb-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(date.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-blue-300">·</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(date.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {date.location && (
                  <>
                    <span className="text-blue-300">·</span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {date.location}
                    </span>
                  </>
                )}
              </div>
              {/* Connection link */}
              {date.connection && (
                <Link
                  to={`/dating/connections/${date.connectionId}`}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  {date.connection.guyName}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Details */}
            <Section title="Details">
              <InfoRow icon={Activity} label="Activity" value={date.activity} />
              <InfoRow icon={MapPin} label="Location" value={date.location} />
              <InfoRow icon={Clock} label="Duration" value={date.duration ? `${date.duration} min` : null} />
              <InfoRow icon={DollarSign} label="Cost" value={date.cost != null ? `$${date.cost}` : null} />
            </Section>

            {/* Notes */}
            {date.notes && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Notes</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{date.notes}</p>
                </div>
              </div>
            )}

            {/* Encounters on this date */}
            {date.encounters?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Encounters</h3>
                  <Badge color="pink">{date.encounters.length}</Badge>
                </div>
                <div className="divide-y divide-gray-50">
                  {date.encounters.map(enc => (
                    <div key={enc.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/dating/encounters/${enc.id}`}
                          className="flex-1 min-w-0 group/link"
                        >
                          <p className="text-sm font-medium text-gray-800 group-hover/link:text-indigo-600 transition-colors">{enc.type}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(enc.dateTime).toLocaleDateString()}
                            </span>
                            {enc.location && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {enc.location}
                              </span>
                            )}
                            {enc.duration && (
                              <span className="text-xs text-gray-400">{enc.duration} min</span>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => { setEditingEncounter(enc); setShowEncounterForm(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-indigo-500 rounded"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEncounter(enc.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-500 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {enc.protection && <Badge color="green">Protected</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Ratings */}
            {(date.rating || date.chemistry || date.conversation || date.attraction) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Ratings</h3>
                </div>
                <div className="px-5 py-1">
                  <RatingRow label="Overall" value={date.rating} />
                  <RatingRow label="Chemistry" value={date.chemistry} />
                  <RatingRow label="Conversation" value={date.conversation} />
                  <RatingRow label="Attraction" value={date.attraction} />
                </div>
              </div>
            )}

            {/* Outcome */}
            <Section title="Outcome">
              <InfoRow icon={CheckCircle} label="Result" value={date.outcome} />
              <InfoRow icon={Heart} label="Second Date?" value={date.secondDate ? 'Yes' : null} />
            </Section>

            {/* Connection */}
            {date.connection && (() => {
              const connProfilePhoto = date.connection.connectionPhotos?.[0];
              const connPhotoUrl = connProfilePhoto
                ? `${config.apiBaseUrl}/uploads/connection-photos/${connProfilePhoto.filename}`
                : null;
              return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Connection</h3>
                  </div>
                  <div className="p-4">
                    {connPhotoUrl && (
                      <div className="mb-3">
                        <button
                          onClick={() => setLightboxUrl(connPhotoUrl)}
                          className="block w-full rounded-xl overflow-hidden aspect-square max-h-48 hover:opacity-90 transition-opacity"
                        >
                          <img src={connPhotoUrl} alt={date.connection.guyName} className="w-full h-full object-cover" />
                        </button>
                      </div>
                    )}
                    <Link
                      to={`/dating/connections/${date.connectionId}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                        {connPhotoUrl ? (
                          <img src={connPhotoUrl} alt={date.connection.guyName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                            {date.connection.guyName?.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">{date.connection.guyName}</p>
                        {date.connection.app && (
                          <p className="text-xs text-gray-400">{date.connection.app.name}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <DateForm
        isOpen={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSave={handleSaved}
        date={date}
        userId={1}
      />

      <EncounterForm
        isOpen={showEncounterForm}
        onClose={() => { setShowEncounterForm(false); setEditingEncounter(null); }}
        onSave={handleEncounterSaved}
        encounter={editingEncounter}
        userId={1}
      />

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
