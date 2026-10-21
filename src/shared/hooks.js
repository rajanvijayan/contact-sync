import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { get } from './api';

/**
 * Debounce a value.
 *
 * @param {any}    value Value.
 * @param {number} delay Delay in ms.
 * @return {any} Debounced value.
 */
export function useDebounced( value, delay = 300 ) {
	const [ debounced, setDebounced ] = useState( value );
	useEffect( () => {
		const timer = setTimeout( () => setDebounced( value ), delay );
		return () => clearTimeout( timer );
	}, [ value, delay ] );
	return debounced;
}

/**
 * Fetch a GET endpoint and re-fetch when the query changes.
 *
 * @param {string|null} path  Endpoint (null to skip).
 * @param {Object}      query Query params.
 * @return {{data: any, loading: boolean, error: Object|null, reload: Function, setData: Function}} State.
 */
export function useFetch( path, query = {} ) {
	const [ data, setData ] = useState( null );
	const [ loading, setLoading ] = useState( !! path );
	const [ error, setError ] = useState( null );
	const key = JSON.stringify( query );
	const requestId = useRef( 0 );

	const load = useCallback(
		( silent = false ) => {
			if ( ! path ) {
				return Promise.resolve();
			}
			const id = ++requestId.current;
			if ( ! silent ) {
				setLoading( true );
			}
			return get( path, JSON.parse( key ) )
				.then( ( result ) => {
					if ( id === requestId.current ) {
						setData( result );
						setError( null );
					}
				} )
				.catch( ( err ) => {
					if ( id === requestId.current ) {
						setError( err );
					}
				} )
				.finally( () => {
					if ( id === requestId.current ) {
						setLoading( false );
					}
				} );
		},
		[ path, key ]
	);

	useEffect( () => {
		load();
	}, [ load ] );

	return { data, loading, error, reload: load, setData };
}

/**
 * Run a callback on an interval while `active` is true.
 *
 * @param {Function} callback Callback.
 * @param {number}   delay    Interval in ms.
 * @param {boolean}  active   Whether polling is on.
 */
export function useInterval( callback, delay, active = true ) {
	const saved = useRef( callback );
	useEffect( () => {
		saved.current = callback;
	}, [ callback ] );
	useEffect( () => {
		if ( ! active ) {
			return undefined;
		}
		const timer = setInterval( () => saved.current(), delay );
		return () => clearInterval( timer );
	}, [ delay, active ] );
}

/**
 * Close something when clicking outside a ref or pressing Escape.
 *
 * @param {Object}   ref     Element ref.
 * @param {Function} onClose Handler.
 * @param {boolean}  active  Whether listening.
 */
export function useDismiss( ref, onClose, active = true ) {
	useEffect( () => {
		if ( ! active ) {
			return undefined;
		}
		const onDown = ( event ) => {
			if ( ref.current && ! ref.current.contains( event.target ) ) {
				onClose();
			}
		};
		const onKey = ( event ) => event.key === 'Escape' && onClose();
		document.addEventListener( 'mousedown', onDown );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', onDown );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ ref, onClose, active ] );
}
