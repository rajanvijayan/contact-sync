import { __ } from '@wordpress/i18n';

export const STATUS = {
	queued: { label: __( 'Queued', 'contact-sync' ), tone: 'neutral' },
	syncing: { label: __( 'Syncing', 'contact-sync' ), tone: 'info' },
	synced: { label: __( 'Synced', 'contact-sync' ), tone: 'success' },
	failed: { label: __( 'Failed', 'contact-sync' ), tone: 'danger' },
	duplicate: { label: __( 'Duplicate', 'contact-sync' ), tone: 'warning' },
};

const AWAITING = {
	label: __( 'Awaiting connection', 'contact-sync' ),
	tone: 'neutral',
};

let crmConnected = true;

/**
 * Record whether Dynamics 365 is connected, which changes how pending leads read.
 *
 * @param {boolean} connected Connected.
 */
export function setCrmConnected( connected ) {
	crmConnected = connected !== false;
}

/**
 * Whether Dynamics 365 is connected.
 *
 * @return {boolean} Connected.
 */
export function isCrmConnected() {
	return crmConnected;
}

/**
 * Label and tone for a sync status. Leads can't fail before Dynamics is
 * connected, so queued and failed both read as waiting until it is.
 *
 * @param {string} status Sync status.
 * @return {{label: string, tone: string}} Display meta.
 */
export function statusMeta( status ) {
	if ( ! crmConnected && ( status === 'queued' || status === 'failed' ) ) {
		return AWAITING;
	}
	return STATUS[ status ] || { label: status, tone: 'neutral' };
}

export const REP_STATUS = {
	active: { label: __( 'Active', 'contact-sync' ), tone: 'success' },
	pending: {
		label: __( 'Pending verification', 'contact-sync' ),
		tone: 'warning',
	},
	disabled: { label: __( 'Disabled', 'contact-sync' ), tone: 'neutral' },
};

export const ROLES = {
	cs_rep: __( 'Rep', 'contact-sync' ),
	cs_agency_manager: __( 'Agency manager', 'contact-sync' ),
	administrator: __( 'Administrator', 'contact-sync' ),
};

/**
 * Format an ISO date for display.
 *
 * @param {string}  iso      ISO date.
 * @param {boolean} withTime Include time.
 * @return {string} Formatted date.
 */
export function formatDate( iso, withTime = true ) {
	if ( ! iso ) {
		return '—';
	}
	const date = new Date( iso );
	return date.toLocaleString( undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...( withTime ? { hour: 'numeric', minute: '2-digit' } : {} ),
	} );
}

/**
 * Relative time ("3 min ago").
 *
 * @param {string} iso ISO date.
 * @return {string} Relative time.
 */
export function timeAgo( iso ) {
	if ( ! iso ) {
		return '—';
	}
	const seconds = Math.round(
		( Date.now() - new Date( iso ).getTime() ) / 1000
	);
	const rtf = new Intl.RelativeTimeFormat( undefined, { numeric: 'auto' } );
	const units = [
		[ 60, 'second' ],
		[ 60, 'minute' ],
		[ 24, 'hour' ],
		[ 7, 'day' ],
		[ 4.345, 'week' ],
		[ 12, 'month' ],
		[ Infinity, 'year' ],
	];
	let value = -seconds;
	for ( const [ size, unit ] of units ) {
		if ( Math.abs( value ) < size ) {
			return rtf.format( Math.round( value ), unit );
		}
		value /= size;
	}
	return formatDate( iso, false );
}

export const formatNumber = ( n ) => new Intl.NumberFormat().format( n || 0 );

/**
 * Display value of a submission field.
 *
 * @param {any} value Stored value.
 * @return {string} Display string.
 */
export function displayValue( value ) {
	if ( Array.isArray( value ) ) {
		return value.join( ', ' ) || '—';
	}
	if ( value === '1' ) {
		return __( 'Yes', 'contact-sync' );
	}
	return value === '' || value === null || value === undefined
		? '—'
		: String( value );
}

export const initials = ( name = '' ) =>
	name
		.split( /\s+/ )
		.filter( Boolean )
		.slice( 0, 2 )
		.map( ( part ) => part[ 0 ].toUpperCase() )
		.join( '' ) || '?';
