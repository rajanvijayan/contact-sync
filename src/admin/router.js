import { useEffect, useState } from '@wordpress/element';

const parse = () =>
	window.location.hash.replace( /^#\/?/, '' ).split( '?' )[ 0 ] ||
	'dashboard';

export function useRoute() {
	const [ route, setRoute ] = useState( parse() );
	useEffect( () => {
		const onChange = () => {
			setRoute( parse() );
			window.scrollTo( 0, 0 );
		};
		window.addEventListener( 'hashchange', onChange );
		return () => window.removeEventListener( 'hashchange', onChange );
	}, [] );
	return route;
}

export const go = ( route ) => {
	window.location.hash = `#/${ route }`;
};

export const hashParams = () =>
	new URLSearchParams( window.location.hash.split( '?' )[ 1 ] || '' );
