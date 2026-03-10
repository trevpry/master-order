import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import EncounterForm from '../components/EncounterForm';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  Star,
  Shield,
  Heart,
  Users,
  Activity,
  CheckCircle,
  ChevronRight,
  Zap,
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

export default function EncounterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [encounter, setEncounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadEncounter();
  }, [id]);

  const loadEncounter = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/encounters/${id}`);
      if (!res.ok) throw new Error('Encounter not found');
      setEncounter(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (updated) => {
    setEncounter(updated);
    setShowEditForm(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this encounter?')) return;
    const res = await fetch(`${API_BASE}/encounters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (encounter?.connectionId) {
        navigate(`/dating/connections/${encounter.connectionId}`);
      } else if (encounter?.dateId) {
        navigate(`/dating/dates/${encounter.dateId}`);
      } else {
        navigate('/dating');
      }
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  if (error || !encounter) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-red-600 mb-4">{error || 'Not found'}</p>
      <Button onClick={() => navigate('/dating')}>Back to Dashboard</Button>
    </div>
  );

  const backTo = encounter.connectionId
    ? { path: `/dating/connections/${encounter.connectionId}`, label: encounter.connection?.guyName || 'Connection' }
    : encounter.dateId
    ? { path: `/dating/dates/${encounter.dateId}`, label: 'Date' }
    : { path: '/dating', label: 'Dating' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            to={backTo.path}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {backTo.label}
          </Link>
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
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 shadow-inner">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{encounter.type}</h1>
                {encounter.protection && <Badge color="green">Protected</Badge>}
                {encounter.tested && <Badge color="blue">Tested</Badge>}
              </div>
              <div className="flex items-center gap-3 text-purple-100 text-sm mb-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(encounter.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-purple-300">·</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(encounter.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {encounter.location && (
                  <>
                    <span className="text-purple-300">·</span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {encounter.location}
                    </span>
                  </>
                )}
                {encounter.duration && (
                  <>
                    <span className="text-purple-300">·</span>
                    <span>{encounter.duration} min</span>
                  </>
                )}
              </div>
              {/* Connection link */}
              {encounter.connection && (
                <Link
                  to={`/dating/connections/${encounter.connectionId}`}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  {encounter.connection.guyName}
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
              <InfoRow icon={Activity} label="Type" value={encounter.type} />
              <InfoRow icon={MapPin} label="Location" value={encounter.location} />
              <InfoRow icon={Clock} label="Duration" value={encounter.duration ? `${encounter.duration} min` : null} />
            </Section>

            {/* Notes */}
            {encounter.notes && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Notes</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{encounter.notes}</p>
                </div>
              </div>
            )}

            {/* Linked date */}
            {encounter.date && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Part of Date</h3>
                </div>
                <div className="p-4">
                  <Link
                    to={`/dating/dates/${encounter.dateId}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                        {encounter.date.activity || encounter.date.location || 'Date'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(encounter.date.dateTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Ratings */}
            {(encounter.satisfaction || encounter.performance || encounter.chemistry) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Ratings</h3>
                </div>
                <div className="px-5 py-1">
                  <RatingRow label="Satisfaction" value={encounter.satisfaction} />
                  <RatingRow label="Performance" value={encounter.performance} />
                  <RatingRow label="Chemistry" value={encounter.chemistry} />
                </div>
              </div>
            )}

            {/* Health & Safety */}
            <Section title="Health & Safety">
              <InfoRow icon={Shield} label="Protection Used" value={encounter.protection ? 'Yes' : null} />
              <InfoRow icon={CheckCircle} label="Tested" value={encounter.tested ? 'Yes' : null} />
              <InfoRow
                icon={Calendar}
                label="Test Date"
                value={encounter.testDate ? new Date(encounter.testDate).toLocaleDateString() : null}
              />
            </Section>

            {/* Connection */}
            {encounter.connection && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Connection</h3>
                </div>
                <div className="p-4">
                  <Link
                    to={`/dating/connections/${encounter.connectionId}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {encounter.connection.guyName?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 group-hover:text-purple-600 transition-colors">{encounter.connection.guyName}</p>
                      {encounter.connection.app && (
                        <p className="text-xs text-gray-400">{encounter.connection.app.name}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <EncounterForm
        isOpen={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSave={handleSaved}
        encounter={encounter}
        userId={1}
      />
    </div>
  );
}
