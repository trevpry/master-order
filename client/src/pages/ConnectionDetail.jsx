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
  Heart,
  Star,
  MessageCircle,
  Smartphone,
  ExternalLink,
  Users,
  Activity,
  Eye,
  Zap,
  Shield,
  Globe,
  UserCheck,
  Info,
  Camera,
  Phone,
  Send,
  Plus,
  X
} from 'lucide-react';
import Button from '../components/Button';
import ConnectionForm from '../components/ConnectionForm';
import ConnectionPhotos from '../components/ConnectionPhotos';
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
        className={`w-3.5 h-3.5 ${i < value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
      />
    ))}
  </div>
);

export default function ConnectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Date editing state
  const [editingDate, setEditingDate] = useState(null);
  const [showDateForm, setShowDateForm] = useState(false);

  // Encounter editing state
  const [editingEncounter, setEditingEncounter] = useState(null);
  const [showEncounterForm, setShowEncounterForm] = useState(false);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgForm, setMsgForm] = useState({ content: '', sender: 'me', timestamp: '', platform: '' });
  const [msgSaving, setMsgSaving] = useState(false);
  const [datingApps, setDatingApps] = useState([]);

  useEffect(() => {
    loadConnection();
    loadMessages();
    loadApps();
  }, [id]);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/connections/${id}`);
      if (!res.ok) throw new Error('Connection not found');
      const data = await res.json();
      setConnection(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      setMessagesLoading(true);
      const res = await fetch(`${API_BASE}/connections/${id}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadApps = async () => {
    try {
      const res = await fetch(`${API_BASE}/apps`);
      if (res.ok) setDatingApps(await res.json());
    } catch (err) {
      console.error('Error loading apps:', err);
    }
  };

  const handleAddMessage = async (e) => {
    e.preventDefault();
    setMsgSaving(true);
    try {
      const res = await fetch(`${API_BASE}/connections/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: msgForm.content,
          sender: msgForm.sender,
          timestamp: msgForm.timestamp || new Date().toISOString(),
          platform: msgForm.platform || null
        })
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => [...prev, saved].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        setMsgForm({ content: '', sender: 'me', timestamp: '', platform: '' });
        setShowMsgForm(false);
        // Update displayed count
        setConnection(prev => ({ ...prev, messagesExchanged: (prev.messagesExchanged || 0) + 1 }));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save message');
      }
    } catch (err) {
      console.error('Error saving message:', err);
      alert('Failed to save message');
    } finally {
      setMsgSaving(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    const res = await fetch(`${API_BASE}/messages/${msgId}`, { method: 'DELETE' });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setConnection(prev => ({ ...prev, messagesExchanged: Math.max(0, (prev.messagesExchanged || 1) - 1) }));
    }
  };

  const handleSaved = (updated) => {
    setConnection(updated);
    setShowEditForm(false);
  };

  const handleDateSaved = (saved) => {
    setConnection(prev => ({
      ...prev,
      dates: prev.dates
        ? prev.dates.map(d => d.id === saved.id ? saved : d)
        : prev.dates
    }));
    setShowDateForm(false);
    setEditingDate(null);
  };

  const handleDeleteDate = async (dateId) => {
    if (!window.confirm('Delete this date?')) return;
    const res = await fetch(`${API_BASE}/dates/${dateId}`, { method: 'DELETE' });
    if (res.ok) {
      setConnection(prev => ({ ...prev, dates: prev.dates.filter(d => d.id !== dateId) }));
    }
  };

  const handleEncounterSaved = (saved) => {
    setConnection(prev => ({
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
      setConnection(prev => ({ ...prev, encounters: prev.encounters.filter(e => e.id !== encId) }));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete connection with ${connection.guyName}?`)) return;
    const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' });
    if (res.ok) navigate('/dating');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  if (error || !connection) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-red-600 mb-4">{error || 'Not found'}</p>
      <Button onClick={() => navigate('/dating')}>Back to Dashboard</Button>
    </div>
  );

  const statusColor = connection.status === 'ACTIVE' ? 'green' : 'gray';
  const initials = connection.guyName?.slice(0, 2).toUpperCase() || '??';
  const totalDates = connection.dates?.length ?? connection._count?.dates ?? 0;
  const totalEncounters = connection.encounters?.length ?? connection._count?.encounters ?? 0;
  const totalMessages = messages.length > 0 ? messages.length : (connection._count?.messages ?? 0);
  const profilePhoto = connection.connectionPhotos?.find(p => p.isProfile);
  const profilePhotoUrl = profilePhoto
    ? `${config.apiBaseUrl}/uploads/connection-photos/${profilePhoto.filename}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            to="/dating"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
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
        <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
              {profilePhotoUrl ? (
                <button
                  onClick={() => setLightboxUrl(profilePhotoUrl)}
                  className="w-full h-full block"
                >
                  <img
                    src={profilePhotoUrl}
                    alt={connection.guyName}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              ) : (
                <div className="w-full h-full bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{connection.guyName}</h1>
                <Badge color={statusColor === 'green' ? 'green' : 'gray'}>
                  {connection.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-pink-100 text-sm mb-3 flex-wrap">
                <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{connection.app?.name || '—'}</span>
                {connection.age && (
                  <>
                    <span className="text-pink-300">·</span>
                    <span>{connection.age} yrs</span>
                  </>
                )}
                {connection.location && (
                  <>
                    <span className="text-pink-300">·</span>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{connection.location}</span>
                  </>
                )}
                {connection.phoneNumber && (
                  <>
                    <span className="text-pink-300">·</span>
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{connection.phoneNumber}</span>
                  </>
                )}
              </div>
              {/* Quick stats */}
              <div className="flex gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xl font-bold">{totalDates}</p>
                  <p className="text-xs text-pink-200">Dates</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{totalEncounters}</p>
                  <p className="text-xs text-pink-200">Encounters</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{totalMessages}</p>
                  <p className="text-xs text-pink-200">Messages</p>
                </div>
                {connection.responseRate > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold">{connection.responseRate}%</p>
                    <p className="text-xs text-pink-200">Response Rate</p>
                  </div>
                )}
              </div>
            </div>
            {connection.profileUrl && (
              <a
                href={connection.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                title="View Profile"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Photos */}
            <ConnectionPhotos
              connectionId={connection.id}
              initialPhotos={connection.connectionPhotos || []}
              onProfileChanged={(newProfile) => {
                setConnection(prev => ({
                  ...prev,
                  connectionPhotos: newProfile
                    ? prev.connectionPhotos.map(p => ({ ...p, isProfile: p.id === newProfile.id }))
                    : prev.connectionPhotos.map(p => ({ ...p, isProfile: false }))
                }));
              }}
            />
            {/* Bio / Notes */}
            {(connection.bio || connection.notes) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">About</h3>
                </div>
                <div className="p-5 space-y-4">
                  {connection.bio && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Bio</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{connection.bio}</p>
                    </div>
                  )}
                  {connection.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{connection.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Physical */}
            {(connection.height || connection.weight || connection.bodyType || connection.ethnicity ||
              connection.hair || connection.bodyHair) && (
              <Section title="Physical">
                <InfoRow icon={Users} label="Height" value={connection.height} />
                <InfoRow icon={Users} label="Weight" value={connection.weight} />
                <InfoRow icon={Users} label="Body Type" value={connection.bodyType} />
                <InfoRow icon={Users} label="Ethnicity" value={connection.ethnicity} />
                <InfoRow icon={Users} label="Hair" value={connection.hair} />
                <InfoRow icon={Users} label="Body Hair" value={connection.bodyHair} />
              </Section>
            )}

            {/* Identity & Preferences */}
            {(connection.position || connection.tribe || connection.pronouns ||
              connection.genderIdentity || connection.lookingFor || connection.openTo ||
              connection.theyAre || connection.theyAreInto || connection.interests ||
              connection.relationshipStatus || connection.sexPractices || connection.globalPosition) && (
              <Section title="Identity & Preferences">
                <InfoRow icon={UserCheck} label="Position" value={connection.position} />
                <InfoRow icon={UserCheck} label="Global Position" value={connection.globalPosition} />
                <InfoRow icon={UserCheck} label="Tribe" value={connection.tribe} />
                <InfoRow icon={UserCheck} label="Pronouns" value={connection.pronouns} />
                <InfoRow icon={UserCheck} label="Gender Identity" value={connection.genderIdentity} />
                <InfoRow icon={Heart} label="Looking For" value={connection.lookingFor} />
                <InfoRow icon={Heart} label="Open To" value={connection.openTo} />
                <InfoRow icon={Heart} label="They Are" value={connection.theyAre} />
                <InfoRow icon={Heart} label="They Are Into" value={connection.theyAreInto} />
                <InfoRow icon={Info} label="Interests" value={connection.interests} />
                <InfoRow icon={Info} label="Relationship Status" value={connection.relationshipStatus} />
                <InfoRow icon={Info} label="Sex Practices" value={connection.sexPractices} />
              </Section>
            )}

            {/* Dates history */}
            {connection.dates?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Dates</h3>
                  <Badge color="blue">{connection.dates.length}</Badge>
                </div>
                <div className="divide-y divide-gray-50">
                  {connection.dates.slice().sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)).map(date => (
                    <div key={date.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/dating/dates/${date.id}`}
                          className="flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-gray-800 group-hover:text-pink-600 transition-colors">{date.activity || date.location}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(date.dateTime).toLocaleDateString()}
                            </span>
                            {date.location && date.activity && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {date.location}
                              </span>
                            )}
                            {date.duration && (
                              <span className="text-xs text-gray-400">{date.duration} min</span>
                            )}
                          </div>
                          {date.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">{date.notes}</p>
                          )}
                        </Link>
                        <div className="flex items-start gap-1 flex-shrink-0">
                          <div className="flex flex-col items-end gap-1 mr-1">
                            {date.rating && <StarRating value={date.rating} />}
                            <Badge color={
                              date.outcome === 'POSITIVE' ? 'green' :
                              date.outcome === 'NEGATIVE' ? 'red' : 'gray'
                            }>
                              {date.outcome}
                            </Badge>
                          </div>
                          <button
                            onClick={() => { setEditingDate(date); setShowDateForm(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-pink-500 rounded"
                            title="Edit date"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDate(date.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-500 rounded"
                            title="Delete date"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Encounters history */}
            {connection.encounters?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Encounters</h3>
                  <Badge color="pink">{connection.encounters.length}</Badge>
                </div>
                <div className="divide-y divide-gray-50">
                  {connection.encounters.slice().sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)).map(enc => (
                    <div key={enc.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          to={`/dating/encounters/${enc.id}`}
                          className="flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-gray-800 group-hover:text-pink-600 transition-colors">{enc.type}</p>
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
                          {enc.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">{enc.notes}</p>
                          )}
                        </Link>
                        <div className="flex items-start gap-1 flex-shrink-0">
                          <div className="flex flex-col items-end gap-1 mr-1">
                            {enc.satisfaction && <StarRating value={enc.satisfaction} />}
                            <div className="flex gap-1">
                              {enc.protection && <Badge color="green">Protected</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={() => { setEditingEncounter(enc); setShowEncounterForm(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-pink-500 rounded"
                            title="Edit encounter"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEncounter(enc.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-500 rounded"
                            title="Delete encounter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Messages section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Messages
                  {messages.length > 0 && (
                    <span className="bg-pink-100 text-pink-700 text-xs font-semibold rounded-full px-2 py-0.5">{messages.length}</span>
                  )}
                </h3>
                <button
                  onClick={() => setShowMsgForm(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:text-pink-800 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Message
                </button>
              </div>

              {/* Add message form */}
              {showMsgForm && (
                <form onSubmit={handleAddMessage} className="p-5 border-b border-gray-100 bg-pink-50/40 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
                      rows={3}
                      placeholder="What did they say?"
                      value={msgForm.content}
                      onChange={e => setMsgForm(f => ({ ...f, content: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sender</label>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setMsgForm(f => ({ ...f, sender: 'me' }))}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                            msgForm.sender === 'me'
                              ? 'bg-pink-500 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          Me
                        </button>
                        <button
                          type="button"
                          onClick={() => setMsgForm(f => ({ ...f, sender: 'them' }))}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                            msgForm.sender === 'them'
                              ? 'bg-purple-500 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {connection.guyName?.split(' ')[0] || 'Them'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                      <select
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                        value={msgForm.platform}
                        onChange={e => setMsgForm(f => ({ ...f, platform: e.target.value }))}
                      >
                        <option value="">Any / Unknown</option>
                        {datingApps.map(a => (
                          <option key={a.id} value={a.name}>{a.name}</option>
                        ))}
                        <option value="SMS">SMS</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      value={msgForm.timestamp}
                      onChange={e => setMsgForm(f => ({ ...f, timestamp: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Leave blank to use now</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowMsgForm(false); setMsgForm({ content: '', sender: 'me', timestamp: '', platform: '' }); }}
                      className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={msgSaving || !msgForm.content.trim()}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {msgSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {/* Message list */}
              {messagesLoading ? (
                <div className="p-5 text-center text-sm text-gray-400">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No messages logged yet</p>
                </div>
              ) : (
                <div className="p-4 space-y-2 max-h-[480px] overflow-y-auto">
                  {messages.map(msg => {
                    const isMe = msg.sender === 'me';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`relative max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-br-sm'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={`flex items-center gap-2 mt-1 flex-wrap ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}>
                            {msg.platform && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isMe ? 'bg-pink-400/50 text-pink-100' : 'bg-gray-100 text-gray-500'
                              }`}>{msg.platform}</span>
                            )}
                            <span className={`text-xs ${
                              isMe ? 'text-pink-200' : 'text-gray-400'
                            }`}>
                              {new Date(msg.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className={`absolute -top-2 ${
                              isMe ? '-left-2' : '-right-2'
                            } opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow`}
                            title="Delete"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Engagement */}
            <Section title="Engagement">
              <InfoRow icon={Eye} label="Profile Views" value={connection.viewCount > 0 ? connection.viewCount : null} />
              <InfoRow icon={Zap} label="Woofs / Likes" value={connection.woofCount > 0 ? connection.woofCount : null} />
              <InfoRow icon={Camera} label="Private Photos" value={connection.privatePhotos > 0 ? connection.privatePhotos : null} />
              <InfoRow icon={MessageCircle} label="Messages Exchanged" value={connection.messagesExchanged > 0 ? connection.messagesExchanged : null} />
              <InfoRow icon={Activity} label="Response Rate" value={connection.responseRate > 0 ? `${connection.responseRate}%` : null} />
              <InfoRow icon={Clock} label="Avg Response Time" value={connection.avgResponseTime ? `${connection.avgResponseTime} min` : null} />
            </Section>

            {/* Health */}
            {(connection.hivStatus || connection.lastTested || connection.sexualHealth || connection.verification) && (
              <Section title="Health & Safety">
                <InfoRow icon={Shield} label="HIV Status" value={connection.hivStatus} />
                <InfoRow icon={Shield} label="Last Tested" value={connection.lastTested} />
                <InfoRow icon={Shield} label="Sexual Health" value={connection.sexualHealth} />
                <InfoRow icon={UserCheck} label="Verification" value={connection.verification} />
              </Section>
            )}

            {/* Platform info */}
            <Section title="Platform">
              <InfoRow icon={Globe} label="Distance" value={connection.distance} />
              <InfoRow icon={Globe} label="Travel Mode" value={connection.travelMode ? 'Yes' : null} />
              <InfoRow icon={Info} label="Source" value={connection.source} />
              {connection.extractionConfidence != null && (
                <InfoRow icon={Info} label="AI Confidence" value={`${Math.round(connection.extractionConfidence * 100)}%`} />
              )}
            </Section>

            {/* Timeline */}
            <Section title="Timeline">
              <InfoRow icon={Calendar} label="First Contact" value={new Date(connection.firstContact).toLocaleDateString()} />
              <InfoRow icon={Clock} label="Last Contact" value={new Date(connection.lastContact).toLocaleDateString()} />
              <InfoRow icon={Calendar} label="Added" value={new Date(connection.createdAt).toLocaleDateString()} />
            </Section>
          </div>
        </div>
      </div>

      {showEditForm && (
        <ConnectionForm
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          onSave={handleSaved}
          connection={connection}
          userId={1}
        />
      )}

      <DateForm
        isOpen={showDateForm}
        onClose={() => { setShowDateForm(false); setEditingDate(null); }}
        onSave={handleDateSaved}
        date={editingDate}
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
