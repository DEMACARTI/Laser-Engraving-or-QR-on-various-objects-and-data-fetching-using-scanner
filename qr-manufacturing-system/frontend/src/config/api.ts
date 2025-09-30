// Central API base configuration
function normalizeBase(url: string) {
	// Ensure no trailing slash and strip trailing '/api' if present
	let u = url.replace(/\/$/, '');
	if (u.endsWith('/api')) u = u.slice(0, -4);
	return u;
}

const envBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || '').trim();
export const API_BASE = envBase ? normalizeBase(envBase) : 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com';

// Scanning service configuration (now integrated with combined backend)
export const SCANNING_API_BASE = envBase ? normalizeBase(envBase) : (process.env.NODE_ENV === 'development' ? 'http://localhost:5002' : 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com');
