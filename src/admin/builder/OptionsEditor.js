import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button, IconButton, Input, Textarea } from '../../shared/ui';
import { slugify } from './fieldTypes';

export default function OptionsEditor( { options = [], onChange } ) {
	const [ bulk, setBulk ] = useState( null );
	const update = ( index, patch ) =>
		onChange(
			options.map( ( o, i ) => ( i === index ? { ...o, ...patch } : o ) )
		);
	const move = ( index, dir ) => {
		const next = [ ...options ];
		const [ item ] = next.splice( index, 1 );
		next.splice( index + dir, 0, item );
		onChange( next );
	};

	if ( bulk !== null ) {
		return (
			<div className="cs-stack cs-stack--sm">
				<Textarea
					rows={ 8 }
					value={ bulk }
					onChange={ ( e ) => setBulk( e.target.value ) }
					placeholder={ __(
						'One option per line. Use "Label | value" to set a custom value.',
						'contact-sync'
					) }
				/>
				<div className="cs-row">
					<Button size="sm" onClick={ () => setBulk( null ) }>
						{ __( 'Cancel', 'contact-sync' ) }
					</Button>
					<Button
						size="sm"
						variant="primary"
						onClick={ () => {
							onChange(
								bulk
									.split( '\n' )
									.map( ( line ) => line.trim() )
									.filter( Boolean )
									.map( ( line ) => {
										const [ label, value ] = line
											.split( '|' )
											.map( ( s ) => s.trim() );
										return {
											label,
											value:
												value ||
												slugify( label ) ||
												label,
										};
									} )
							);
							setBulk( null );
						} }
					>
						{ __( 'Apply', 'contact-sync' ) }
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="cs-options">
			<div className="cs-options__head">
				<span>{ __( 'Label', 'contact-sync' ) }</span>
				<span>{ __( 'Value', 'contact-sync' ) }</span>
			</div>
			{ options.map( ( option, index ) => (
				<div className="cs-options__row" key={ index }>
					<Input
						value={ option.label }
						onChange={ ( e ) => {
							const label = e.target.value;
							const auto =
								! option.value ||
								option.value === slugify( option.label );
							update(
								index,
								auto
									? { label, value: slugify( label ) }
									: { label }
							);
						} }
						aria-label={ __( 'Option label', 'contact-sync' ) }
					/>
					<Input
						className="cs-options__value"
						value={ option.value }
						onChange={ ( e ) =>
							update( index, { value: e.target.value } )
						}
						aria-label={ __( 'Option value', 'contact-sync' ) }
					/>
					<div className="cs-options__tools">
						<IconButton
							icon="chevronDown"
							label={ __( 'Move down', 'contact-sync' ) }
							disabled={ index === options.length - 1 }
							onClick={ () => move( index, 1 ) }
						/>
						<IconButton
							icon="x"
							label={ __( 'Remove option', 'contact-sync' ) }
							disabled={ options.length <= 1 }
							onClick={ () =>
								onChange(
									options.filter( ( _, i ) => i !== index )
								)
							}
						/>
					</div>
				</div>
			) ) }
			<div className="cs-row">
				<Button
					size="sm"
					icon="plus"
					onClick={ () => {
						const n = options.length + 1;
						onChange( [
							...options,
							{ label: `Option ${ n }`, value: `option_${ n }` },
						] );
					} }
				>
					{ __( 'Add option', 'contact-sync' ) }
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={ () =>
						setBulk(
							options
								.map( ( o ) =>
									o.value === slugify( o.label )
										? o.label
										: `${ o.label } | ${ o.value }`
								)
								.join( '\n' )
						)
					}
				>
					{ __( 'Bulk edit', 'contact-sync' ) }
				</Button>
			</div>
		</div>
	);
}
