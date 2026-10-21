/**
 * Stroke icon set (24px grid, 1.75 stroke).
 */
const PATHS = {
	dashboard: (
		<>
			<rect x="3" y="3" width="7" height="9" rx="1.5" />
			<rect x="14" y="3" width="7" height="5" rx="1.5" />
			<rect x="14" y="12" width="7" height="9" rx="1.5" />
			<rect x="3" y="16" width="7" height="5" rx="1.5" />
		</>
	),
	plus: (
		<>
			<path d="M12 5v14M5 12h14" />
		</>
	),
	upload: (
		<>
			<path d="M12 15V3M7 8l5-5 5 5" />
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		</>
	),
	download: (
		<>
			<path d="M12 3v12M7 10l5 5 5-5" />
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		</>
	),
	list: (
		<>
			<path d="M8 6h13M8 12h13M8 18h13" />
			<circle cx="3.5" cy="6" r="1" />
			<circle cx="3.5" cy="12" r="1" />
			<circle cx="3.5" cy="18" r="1" />
		</>
	),
	file: (
		<>
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<path d="M14 3v5h5M9 13h6M9 17h4" />
		</>
	),
	table: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M3 10h18M3 15h18M9 10v10" />
		</>
	),
	users: (
		<>
			<circle cx="9" cy="8" r="3.5" />
			<path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
			<path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
		</>
	),
	user: (
		<>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</>
	),
	building: (
		<>
			<rect x="4" y="3" width="16" height="18" rx="1.5" />
			<path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
		</>
	),
	form: (
		<>
			<rect x="4" y="3" width="16" height="18" rx="2" />
			<path d="M8 8h8M8 12h8M8 16h5" />
		</>
	),
	settings: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
		</>
	),
	logout: (
		<>
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
		</>
	),
	check: (
		<>
			<path d="M20 6 9 17l-5-5" />
		</>
	),
	x: (
		<>
			<path d="M18 6 6 18M6 6l12 12" />
		</>
	),
	alert: (
		<>
			<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
			<path d="M12 9v4M12 17h.01" />
		</>
	),
	info: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 16v-4M12 8h.01" />
		</>
	),
	checkCircle: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="m8 12 3 3 5-6" />
		</>
	),
	xCircle: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="m15 9-6 6M9 9l6 6" />
		</>
	),
	clock: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</>
	),
	chevronDown: (
		<>
			<path d="m6 9 6 6 6-6" />
		</>
	),
	chevronRight: (
		<>
			<path d="m9 6 6 6-6 6" />
		</>
	),
	chevronLeft: (
		<>
			<path d="m15 6-6 6 6 6" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.5-3.5" />
		</>
	),
	refresh: (
		<>
			<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8" />
			<path d="M21 3v5h-5M3 21v-5h5" />
		</>
	),
	trash: (
		<>
			<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
		</>
	),
	edit: (
		<>
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
		</>
	),
	copy: (
		<>
			<rect x="9" y="9" width="12" height="12" rx="2" />
			<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
		</>
	),
	eye: (
		<>
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	eyeOff: (
		<>
			<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
			<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
		</>
	),
	grip: (
		<>
			<circle cx="9" cy="6" r="1" />
			<circle cx="15" cy="6" r="1" />
			<circle cx="9" cy="12" r="1" />
			<circle cx="15" cy="12" r="1" />
			<circle cx="9" cy="18" r="1" />
			<circle cx="15" cy="18" r="1" />
		</>
	),
	mail: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="2" />
			<path d="m3 7 9 6 9-6" />
		</>
	),
	lock: (
		<>
			<rect x="4" y="11" width="16" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		</>
	),
	cloud: (
		<>
			<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12 3.5 3.5 0 0 0 6.5 19z" />
		</>
	),
	arrowRight: (
		<>
			<path d="M5 12h14M13 6l6 6-6 6" />
		</>
	),
	arrowLeft: (
		<>
			<path d="M19 12H5M11 6l-6 6 6 6" />
		</>
	),
	menu: (
		<>
			<path d="M3 6h18M3 12h18M3 18h18" />
		</>
	),
	external: (
		<>
			<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
		</>
	),
	filter: (
		<>
			<path d="M3 5h18l-7 8v6l-4 2v-8z" />
		</>
	),
	calendar: (
		<>
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path d="M3 10h18M8 3v4M16 3v4" />
		</>
	),
	text: (
		<>
			<path d="M4 7V5h16v2M9 19h6M12 5v14" />
		</>
	),
	hash: (
		<>
			<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
		</>
	),
	phone: (
		<>
			<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
		</>
	),
	at: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
		</>
	),
	select: (
		<>
			<rect x="3" y="6" width="18" height="12" rx="2" />
			<path d="m14 11 2 2 2-2" />
			<path d="M7 12h4" />
		</>
	),
	radio: (
		<>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="3.5" />
		</>
	),
	checkSquare: (
		<>
			<rect x="3" y="3" width="18" height="18" rx="3" />
			<path d="m8 12 3 3 5-6" />
		</>
	),
	checks: (
		<>
			<path d="m2 12 4 4 8-8M10 16l2 2 10-10" />
		</>
	),
	textarea: (
		<>
			<path d="M4 6h16M4 10h16M4 14h16M4 18h10" />
		</>
	),
	link: (
		<>
			<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
			<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
		</>
	),
	heading: (
		<>
			<path d="M6 4v16M18 4v16M6 12h12" />
		</>
	),
	divider: (
		<>
			<path d="M3 12h18" />
			<path d="M8 7h8M8 17h8" opacity=".4" />
		</>
	),
	zap: (
		<>
			<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
		</>
	),
	undo: (
		<>
			<path d="M9 14 4 9l5-5" />
			<path d="M4 9h11a5 5 0 0 1 0 10h-3" />
		</>
	),
	redo: (
		<>
			<path d="m15 14 5-5-5-5" />
			<path d="M20 9H9a5 5 0 0 0 0 10h3" />
		</>
	),
	send: (
		<>
			<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
		</>
	),
	sparkle: (
		<>
			<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
		</>
	),
	columns: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M12 4v16" />
		</>
	),
	more: (
		<>
			<circle cx="12" cy="5" r="1" />
			<circle cx="12" cy="12" r="1" />
			<circle cx="12" cy="19" r="1" />
		</>
	),
	shield: (
		<>
			<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
		</>
	),
	palette: (
		<>
			<circle cx="13.5" cy="6.5" r="1" />
			<circle cx="17.5" cy="10.5" r="1" />
			<circle cx="8.5" cy="7.5" r="1" />
			<circle cx="6.5" cy="12.5" r="1" />
			<path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2a5.6 5.6 0 0 0 5.4-5.6C22 6 17.5 2 12 2z" />
		</>
	),
	plug: (
		<>
			<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4" />
		</>
	),
	inbox: (
		<>
			<path d="M22 12h-6l-2 3h-4l-2-3H2" />
			<path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
		</>
	),
};

export default function Icon( { name, size = 18, className = '', ...rest } ) {
	return (
		<svg
			className={ `cs-icon ${ className }` }
			width={ size }
			height={ size }
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{ ...rest }
		>
			{ PATHS[ name ] || PATHS.info }
		</svg>
	);
}
