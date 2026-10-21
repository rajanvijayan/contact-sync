import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

const NS = '/contact-sync/v1';

/**
 * Call a plugin endpoint.
 *
 * Errors are normalised to { message, code, status, errors }, where `errors`
 * holds per-field validation messages when the server returns them.
 *
 * @param {string} path    Path relative to the plugin namespace.
 * @param {Object} options apiFetch options.
 * @return {Promise<any>} Response body.
 */
export async function api( path, options = {} ) {
	try {
		return await apiFetch( { path: NS + path, ...options } );
	} catch ( error ) {
		const normalised = {
			message:
				error?.message ||
				__( 'Something went wrong. Please try again.', 'contact-sync' ),
			code: error?.code || 'unknown',
			status: error?.data?.status || 0,
			errors: error?.data?.errors || {},
		};
		if ( error?.code === 'invalid_json' ) {
			normalised.message = __(
				'The server returned an unexpected response. Please refresh and try again.',
				'contact-sync'
			);
		}
		if (
			error?.code === 'rest_cookie_invalid_nonce' ||
			error?.code === 'rest_not_logged_in'
		) {
			normalised.message = __(
				'Your session has expired. Please refresh the page and sign in again.',
				'contact-sync'
			);
		}
		throw normalised;
	}
}

export const get = ( path, query ) => api( withQuery( path, query ) );
export const post = ( path, data ) => api( path, { method: 'POST', data } );
export const put = ( path, data ) => api( path, { method: 'PUT', data } );
export const del = ( path ) => api( path, { method: 'DELETE' } );

/**
 * Append non-empty query params.
 *
 * @param {string} path  Path.
 * @param {Object} query Params.
 * @return {string} Path with query string.
 */
export function withQuery( path, query = {} ) {
	const params = new URLSearchParams();
	Object.entries( query || {} ).forEach( ( [ key, value ] ) => {
		if ( value !== '' && value !== null && value !== undefined ) {
			params.append( key, value );
		}
	} );
	const qs = params.toString();
	return qs ? `${ path }${ path.includes( '?' ) ? '&' : '?' }${ qs }` : path;
}

/**
 * Trigger a file download from a string.
 *
 * @param {string} filename File name.
 * @param {string} content  Content.
 * @param {string} type     MIME type.
 */
export function downloadFile(
	filename,
	content,
	type = 'text/csv;charset=utf-8'
) {
	const blob = new Blob( [ content ], { type } );
	const url = URL.createObjectURL( blob );
	const link = document.createElement( 'a' );
	link.href = url;
	link.download = filename;
	document.body.appendChild( link );
	link.click();
	link.remove();
	setTimeout( () => URL.revokeObjectURL( url ), 1000 );
}
