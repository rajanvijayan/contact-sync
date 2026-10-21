import { useCallback, useRef, useState } from '@wordpress/element';

const LIMIT = 100;
const COALESCE_MS = 800;

/**
 * Undo/redo state. Consecutive updates with the same tag (e.g. typing in one input)
 * within a short window are merged into a single history step.
 *
 * @param {any} initial Initial state.
 * @return {Object} History API.
 */
export default function useHistory( initial ) {
	const [ state, setState ] = useState( {
		past: [],
		present: initial,
		future: [],
	} );
	const last = useRef( { tag: null, time: 0 } );

	const set = useCallback( ( updater, tag = null ) => {
		setState( ( current ) => {
			const next =
				typeof updater === 'function'
					? updater( current.present )
					: updater;
			if ( next === current.present ) {
				return current;
			}
			const now = Date.now();
			const merge =
				tag &&
				tag === last.current.tag &&
				now - last.current.time < COALESCE_MS;
			last.current = { tag, time: now };
			return {
				past: merge
					? current.past
					: [ ...current.past, current.present ].slice( -LIMIT ),
				present: next,
				future: [],
			};
		} );
	}, [] );

	const reset = useCallback( ( value ) => {
		last.current = { tag: null, time: 0 };
		setState( { past: [], present: value, future: [] } );
	}, [] );

	/** Replace the present value without creating a history step (e.g. server normalisation). */
	const replace = useCallback(
		( value ) =>
			setState( ( current ) => ( { ...current, present: value } ) ),
		[]
	);

	const undo = useCallback( () => {
		last.current = { tag: null, time: 0 };
		setState( ( current ) =>
			current.past.length
				? {
						past: current.past.slice( 0, -1 ),
						present: current.past[ current.past.length - 1 ],
						future: [ current.present, ...current.future ],
				  }
				: current
		);
	}, [] );

	const redo = useCallback( () => {
		last.current = { tag: null, time: 0 };
		setState( ( current ) =>
			current.future.length
				? {
						past: [ ...current.past, current.present ],
						present: current.future[ 0 ],
						future: current.future.slice( 1 ),
				  }
				: current
		);
	}, [] );

	return {
		value: state.present,
		set,
		reset,
		replace,
		undo,
		redo,
		canUndo: state.past.length > 0,
		canRedo: state.future.length > 0,
	};
}
