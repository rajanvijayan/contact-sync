/**
 * Normalise a header or label for fuzzy matching.
 *
 * @param {string} value Header.
 * @return {string} Normalised.
 */
export const normaliseHeader = ( value ) =>
	String( value || '' )
		.toLowerCase()
		.replace( /^\uFEFF/, '' )
		.replace( /[^a-z0-9]+/g, '' );

/**
 * Suggest a column for each field by key or label.
 *
 * @param {string[]} headers CSV headers.
 * @param {Array}    fields  Input fields.
 * @return {Object} Field key => column index (or -1).
 */
export function autoMap( headers, fields ) {
	const normalised = headers.map( normaliseHeader );
	const used = new Set();
	const mapping = {};
	fields.forEach( ( field ) => {
		const candidates = [ field.key, field.label, field.crm?.attribute ]
			.filter( Boolean )
			.map( normaliseHeader );
		const index = normalised.findIndex(
			( header, i ) => ! used.has( i ) && candidates.includes( header )
		);
		mapping[ field.key ] = index;
		if ( index >= 0 ) {
			used.add( index );
		}
	} );
	return mapping;
}

/**
 * Build row objects keyed by field key from raw CSV rows.
 *
 * @param {Array[]} rows    Data rows (without header).
 * @param {Object}  mapping Field key => column index.
 * @return {Object[]} Mapped rows.
 */
export function applyMapping( rows, mapping ) {
	return rows.map( ( row ) => {
		const out = {};
		Object.entries( mapping ).forEach( ( [ key, index ] ) => {
			if ( index >= 0 ) {
				out[ key ] = ( row[ index ] ?? '' ).toString().trim();
			}
		} );
		return out;
	} );
}

/**
 * Encode rows as CSV.
 *
 * @param {string[]} headers Headers.
 * @param {Array[]}  rows    Rows.
 * @return {string} CSV.
 */
export function toCsv( headers, rows ) {
	const escape = ( value ) => {
		let text = String( value ?? '' );
		if ( /^[=+\-@\t\r]/.test( text ) ) {
			text = `'${ text }`;
		}
		return /[",\n\r]/.test( text )
			? `"${ text.replace( /"/g, '""' ) }"`
			: text;
	};
	return (
		'﻿' +
		[ headers, ...rows ]
			.map( ( row ) => row.map( escape ).join( ',' ) )
			.join( '\r\n' )
	);
}
