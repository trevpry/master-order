const LogoIcon = () => (
  <div className="flex items-center justify-center mb-6">
    <svg 
      width="80" 
      height="80" 
      viewBox="0 0 80 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      {/* Character head/face */}
      <circle cx="40" cy="35" r="18" fill="#B8860B" stroke="#8B4513" strokeWidth="2"/>
      
      {/* Hair - blonde spiky style */}
      <path d="M22 25 Q25 10 30 15 Q35 8 40 12 Q45 8 50 15 Q55 10 58 25 Q52 20 40 18 Q28 20 22 25" fill="#FFD700" stroke="#DAA520" strokeWidth="1"/>
      
      {/* Glasses frame */}
      <rect x="30" y="28" width="8" height="8" rx="4" fill="rgba(255,255,255,0.9)" stroke="#333" strokeWidth="2"/>
      <rect x="42" y="28" width="8" height="8" rx="4" fill="rgba(255,255,255,0.9)" stroke="#333" strokeWidth="2"/>
      <line x1="38" y1="32" x2="42" y2="32" stroke="#333" strokeWidth="2"/>
      <line x1="25" y1="32" x2="30" y2="32" stroke="#333" strokeWidth="1.5"/>
      <line x1="50" y1="32" x2="55" y2="32" stroke="#333" strokeWidth="1.5"/>
      
      {/* Eyes behind glasses */}
      <circle cx="34" cy="32" r="2" fill="#8B4513"/>
      <circle cx="46" cy="32" r="2" fill="#8B4513"/>
      <circle cx="34.5" cy="31.5" r="0.5" fill="white"/>
      <circle cx="46.5" cy="31.5" r="0.5" fill="white"/>
      
      {/* Nose */}
      <ellipse cx="40" cy="38" rx="1.5" ry="2" fill="#A0522D"/>
      
      {/* Smile */}
      <path d="M34 42 Q40 48 46 42" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Body/torso */}
      <path d="M25 50 Q25 45 40 45 Q55 45 55 50 L55 70 Q55 75 40 75 Q25 75 25 70 Z" fill="#D2B48C" stroke="#8B4513" strokeWidth="2"/>
      
      {/* Eddie logo badge */}
      <circle cx="40" cy="62" r="8" fill="#4F46E5"/>
      <circle cx="40" cy="62" r="6" fill="#6366F1"/>
      <text x="40" y="67" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" fontFamily="monospace">E</text>
    </svg>
  </div>
);

export default LogoIcon;
