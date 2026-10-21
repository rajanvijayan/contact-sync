import { useEffect, useState } from '@wordpress/element';
import config from './config';

const base = ( config.basePath || '/' ).replace( /\/?$/, '/' );

/**
 * Current path relative to the site root, without slashes ("app/new").
 *
 * @return {string} Path.
 */
export function currentPath() {
	let path = window.location.pathname;
	if ( path.startsWith( base ) ) {
		path = path.slice( base.length );
	}
	return path.replace( /^\/+|\/+$/g, '' );
}

export function href( to ) {
	const [ path, search ] = to.split( '?' );
	const clean = path.replace( /^\/+|\/+$/g, '' );
	return (
		base + ( clean ? `${ clean }/` : '' ) + ( search ? `?${ search }` : '' )
	);
}

/**
 * Navigate within the SPA.
 *
 * @param {string}  path    Relative path.
 * @param {boolean} replace Replace history entry.
 */
export function navigate( path, replace = false ) {
	const url = href( path );
	if ( replace ) {
		window.history.replaceState( {}, '', url );
	} else {
		window.history.pushState( {}, '', url );
	}
	window.dispatchEvent( new window.PopStateEvent( 'popstate' ) );
	window.scrollTo( 0, 0 );
}

export function usePath() {
	const [ path, setPath ] = useState( currentPath() );
	useEffect( () => {
		const onPop = () => setPath( currentPath() );
		window.addEventListener( 'popstate', onPop );
		return () => window.removeEventListener( 'popstate', onPop );
	}, [] );
	return path;
}

export function Link( { to, children, className, ...rest } ) {
	return (
		<a
			href={ href( to ) }
			className={ className }
			onClick={ ( event ) => {
				if (
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.button !== 0
				) {
					return;
				}
				event.preventDefault();
				navigate( to );
			} }
			{ ...rest }
		>
			{ children }
		</a>
	);
}

export const query = () => new URLSearchParams( window.location.search );
