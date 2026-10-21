import { useDraggable } from '@dnd-kit/core';
import { __ } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import { FIELD_TYPES, GROUPS } from './fieldTypes';

function PaletteItem( { type, onAdd } ) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable( {
		id: `palette:${ type }`,
		data: { from: 'palette', type },
	} );
	const def = FIELD_TYPES[ type ];
	return (
		<button
			ref={ setNodeRef }
			type="button"
			className={ `cs-palette__item ${
				isDragging ? 'is-dragging' : ''
			}` }
			onClick={ () => onAdd( type ) }
			title={ __(
				'Click to add, or drag onto the form',
				'contact-sync'
			) }
			{ ...listeners }
			{ ...attributes }
		>
			<span className="cs-palette__icon">
				<Icon name={ def.icon } size={ 16 } />
			</span>
			{ def.label }
		</button>
	);
}

export default function Palette( { onAdd } ) {
	return (
		<div className="cs-palette">
			<p className="cs-palette__hint">
				{ __( 'Click or drag a field onto the form.', 'contact-sync' ) }
			</p>
			{ GROUPS.map( ( group ) => (
				<div key={ group.id } className="cs-palette__group">
					<h3 className="cs-palette__title">{ group.label }</h3>
					<div className="cs-palette__grid">
						{ Object.keys( FIELD_TYPES )
							.filter(
								( type ) =>
									FIELD_TYPES[ type ].group === group.id
							)
							.map( ( type ) => (
								<PaletteItem
									key={ type }
									type={ type }
									onAdd={ onAdd }
								/>
							) ) }
					</div>
				</div>
			) ) }
		</div>
	);
}
