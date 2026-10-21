import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../shared/icons';
import { cx } from '../shared/ui';

/**
 * Chip input for lists such as domains.
 *
 * @param {Object}   props
 * @param {string[]} props.value       Items.
 * @param {Function} props.onChange    Change handler.
 * @param {string}   props.placeholder Placeholder.
 * @param {Function} props.normalize   Optional item normaliser.
 * @param {string}   props.id          Input ID.
 */
export function TagInput( {
	value = [],
	onChange,
	placeholder,
	normalize = ( v ) => v.trim(),
	id,
} ) {
	const [ text, setText ] = useState( '' );
	const add = ( raw ) => {
		const items = raw
			.split( /[\s,;]+/ )
			.map( normalize )
			.filter( Boolean )
			.filter( ( item ) => ! value.includes( item ) );
		if ( items.length ) {
			onChange( [ ...value, ...items ] );
		}
		setText( '' );
	};
	return (
		<div className={ cx( 'cs-tags' ) }>
			{ value.map( ( item ) => (
				<span key={ item } className="cs-tag">
					{ item }
					<button
						type="button"
						onClick={ () =>
							onChange( value.filter( ( v ) => v !== item ) )
						}
						aria-label={ __( 'Remove', 'contact-sync' ) }
					>
						<Icon name="x" size={ 12 } />
					</button>
				</span>
			) ) }
			<input
				id={ id }
				value={ text }
				placeholder={ value.length ? '' : placeholder }
				onChange={ ( e ) => setText( e.target.value ) }
				onKeyDown={ ( e ) => {
					if (
						[ 'Enter', ',', ' ', 'Tab' ].includes( e.key ) &&
						text.trim()
					) {
						e.preventDefault();
						add( text );
					} else if (
						e.key === 'Backspace' &&
						! text &&
						value.length
					) {
						onChange( value.slice( 0, -1 ) );
					}
				} }
				onBlur={ () => text.trim() && add( text ) }
				onPaste={ ( e ) => {
					e.preventDefault();
					add( e.clipboardData.getData( 'text' ) );
				} }
			/>
		</div>
	);
}

export const normalizeDomain = ( raw ) =>
	raw
		.trim()
		.toLowerCase()
		.replace( /^[a-z]+:\/\//, '' )
		.replace( /[/?#].*$/, '' )
		.replace( /^@/, '' )
		.replace( /^www\./, '' );
