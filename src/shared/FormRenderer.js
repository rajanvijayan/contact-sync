import { __, sprintf } from '@wordpress/i18n';
import { visibility } from './conditions';
import { Checkbox, Field, Input, Radio, Select, Textarea, cx } from './ui';

const INPUT_TYPES = [
	'text',
	'email',
	'phone',
	'number',
	'textarea',
	'select',
	'radio',
	'checkboxes',
	'checkbox',
	'date',
	'url',
	'hidden',
];

export const isInputField = ( field ) => INPUT_TYPES.includes( field.type );

/**
 * Initial values from field defaults.
 *
 * @param {Object} schema Form schema.
 * @return {Object} Values.
 */
export function initialValues( schema ) {
	const values = {};
	( schema?.fields || [] ).filter( isInputField ).forEach( ( field ) => {
		if ( field.type === 'checkboxes' ) {
			if ( Array.isArray( field.default ) ) {
				values[ field.key ] = field.default;
			} else {
				values[ field.key ] = field.default ? [ field.default ] : [];
			}
		} else if ( field.type === 'checkbox' ) {
			values[ field.key ] = [ '1', 'yes', 'true', 'checked' ].includes(
				String( field.default ).toLowerCase()
			)
				? '1'
				: '';
		} else {
			values[ field.key ] = field.default ?? '';
		}
	} );
	return values;
}

/**
 * Quick browser-side checks for instant feedback. The server re-validates everything.
 *
 * @param {Object} schema Schema.
 * @param {Object} values Values.
 * @return {Object} Field key => message.
 */
export function validateClient( schema, values ) {
	const errors = {};
	const visible = visibility( schema.fields, values );
	schema.fields.filter( isInputField ).forEach( ( field ) => {
		if ( ! visible[ field.key ] || field.type === 'hidden' ) {
			return;
		}
		const value = values[ field.key ];
		const empty = Array.isArray( value )
			? value.length === 0
			: ! String( value ?? '' ).trim();
		const label = field.label || field.key;
		const rules = field.validation || {};
		if ( empty ) {
			if ( field.required ) {
				errors[ field.key ] = sprintf(
					/* translators: %s: field label */
					__( '%s is required.', 'contact-sync' ),
					label
				);
			}
			return;
		}
		if (
			field.type === 'email' &&
			! /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test( value.trim() )
		) {
			errors[ field.key ] = __(
				'Enter a valid email address.',
				'contact-sync'
			);
		} else if (
			field.type === 'phone' &&
			! /^\+?[0-9().\-\s]{5,25}(\s*(x|ext\.?)\s*[0-9]{1,6})?$/i.test(
				value.trim()
			)
		) {
			errors[ field.key ] = __(
				'Enter a valid phone number.',
				'contact-sync'
			);
		} else if ( field.type === 'number' ) {
			const n = Number( String( value ).replace( /[,\s]/g, '' ) );
			if ( Number.isNaN( n ) ) {
				errors[ field.key ] = __( 'Enter a number.', 'contact-sync' );
			} else if ( rules.min !== undefined && n < rules.min ) {
				errors[ field.key ] = sprintf(
					/* translators: %s: minimum */
					__( 'Must be at least %s.', 'contact-sync' ),
					rules.min
				);
			} else if ( rules.max !== undefined && n > rules.max ) {
				errors[ field.key ] = sprintf(
					/* translators: %s: maximum */
					__( 'Must be at most %s.', 'contact-sync' ),
					rules.max
				);
			}
		} else if ( typeof value === 'string' ) {
			if ( rules.minLength && value.length < rules.minLength ) {
				errors[ field.key ] = sprintf(
					/* translators: %d: characters */
					__( 'Must be at least %d characters.', 'contact-sync' ),
					rules.minLength
				);
			} else if ( rules.maxLength && value.length > rules.maxLength ) {
				errors[ field.key ] = sprintf(
					/* translators: %d: characters */
					__( 'Must be %d characters or fewer.', 'contact-sync' ),
					rules.maxLength
				);
			} else if ( rules.pattern ) {
				try {
					if (
						! new RegExp( `^(?:${ rules.pattern })$`, 'u' ).test(
							value
						)
					) {
						errors[ field.key ] =
							rules.patternMessage ||
							__(
								'Value is not in the expected format.',
								'contact-sync'
							);
					}
				} catch ( e ) {
					// Invalid patterns are rejected when the form is saved; ignore here.
				}
			}
		}
	} );
	return errors;
}

function Control( { field, value, onChange, invalid, disabled, id } ) {
	const common = {
		id,
		name: field.key,
		disabled,
		invalid,
		placeholder: field.placeholder || undefined,
	};

	switch ( field.type ) {
		case 'textarea':
			return (
				<Textarea
					{ ...common }
					rows={ 4 }
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'select':
			return (
				<Select
					{ ...common }
					value={ value ?? '' }
					placeholder={
						field.placeholder || __( 'Select…', 'contact-sync' )
					}
					options={ field.options || [] }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'radio':
			return (
				<div
					className="cs-choice-group"
					role="radiogroup"
					aria-labelledby={ `${ id }-label` }
				>
					{ ( field.options || [] ).map( ( option ) => (
						<Radio
							key={ option.value }
							name={ `${ id }-${ field.key }` }
							value={ option.value }
							label={ option.label }
							checked={ value === option.value }
							disabled={ disabled }
							onChange={ () => onChange( option.value ) }
						/>
					) ) }
				</div>
			);
		case 'checkboxes': {
			const list = Array.isArray( value ) ? value : [];
			return (
				<div className="cs-choice-group">
					{ ( field.options || [] ).map( ( option ) => (
						<Checkbox
							key={ option.value }
							label={ option.label }
							checked={ list.includes( option.value ) }
							disabled={ disabled }
							onChange={ ( checked ) =>
								onChange(
									checked
										? [ ...list, option.value ]
										: list.filter(
												( v ) => v !== option.value
										  )
								)
							}
						/>
					) ) }
				</div>
			);
		}
		case 'checkbox':
			return (
				<Checkbox
					id={ id }
					label={ field.placeholder || field.label }
					checked={ value === '1' }
					disabled={ disabled }
					onChange={ ( checked ) => onChange( checked ? '1' : '' ) }
				/>
			);
		case 'email':
			return (
				<Input
					{ ...common }
					type="email"
					icon="mail"
					autoComplete="off"
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'phone':
			return (
				<Input
					{ ...common }
					type="tel"
					icon="phone"
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'url':
			return (
				<Input
					{ ...common }
					type="url"
					icon="link"
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'number':
			return (
				<Input
					{ ...common }
					type="number"
					inputMode="decimal"
					min={ field.validation?.min }
					max={ field.validation?.max }
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		case 'date':
			return (
				<Input
					{ ...common }
					type="date"
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
		default:
			return (
				<Input
					{ ...common }
					type="text"
					value={ value ?? '' }
					onChange={ ( e ) => onChange( e.target.value ) }
				/>
			);
	}
}

/**
 * Render a form schema.
 *
 * @param {Object}   props
 * @param {Object}   props.schema     Schema.
 * @param {Object}   props.values     Values.
 * @param {Function} props.onChange   (key, value) => void.
 * @param {Object}   props.errors     Field errors.
 * @param {boolean}  props.disabled   Disable inputs.
 * @param {boolean}  props.showHidden Show hidden fields (builder preview).
 * @param {string}   props.idPrefix   Prefix for element IDs.
 */
export default function FormRenderer( {
	schema,
	values,
	onChange,
	errors = {},
	disabled,
	showHidden = false,
	idPrefix = 'cs',
} ) {
	const visible = visibility( schema.fields, values );

	return (
		<div className="cs-form-grid">
			{ schema.fields.map( ( field ) => {
				if ( ! visible[ field.key ] ) {
					return null;
				}
				if ( field.type === 'section' ) {
					return (
						<div key={ field.id } className="cs-form-section">
							<h3 className="cs-form-section__title">
								{ field.label }
							</h3>
							{ field.description && (
								<p className="cs-form-section__desc">
									{ field.description }
								</p>
							) }
						</div>
					);
				}
				if ( field.type === 'divider' ) {
					return <hr key={ field.id } className="cs-form-divider" />;
				}
				if ( field.type === 'hidden' ) {
					return showHidden ? (
						<div
							key={ field.id }
							className="cs-form-cell cs-form-cell--full cs-form-hidden-note"
						>
							{ sprintf(
								/* translators: 1: field label, 2: default value */
								__(
									'Hidden field “%1$s” = %2$s',
									'contact-sync'
								),
								field.label || field.key,
								field.default || '—'
							) }
						</div>
					) : null;
				}
				const id = `${ idPrefix }-${ field.key }`;
				return (
					<div
						key={ field.id }
						className={ cx(
							'cs-form-cell',
							field.width === 'half'
								? 'cs-form-cell--half'
								: 'cs-form-cell--full'
						) }
					>
						<Field
							label={
								field.type === 'checkbox'
									? undefined
									: field.label
							}
							htmlFor={ id }
							required={ field.required }
							help={ field.help }
							error={ errors[ field.key ] }
						>
							<Control
								id={ id }
								field={ field }
								value={ values[ field.key ] }
								invalid={ !! errors[ field.key ] }
								disabled={ disabled }
								onChange={ ( value ) =>
									onChange( field.key, value )
								}
							/>
						</Field>
					</div>
				);
			} ) }
		</div>
	);
}
