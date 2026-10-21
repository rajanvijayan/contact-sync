import { useDroppable } from '@dnd-kit/core';
import {
	SortableContext,
	rectSortingStrategy,
	useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import { OPERATORS } from '../../shared/conditions';
import { Badge, IconButton, cx } from '../../shared/ui';
import { FIELD_TYPES } from './fieldTypes';

function MockControl( { field } ) {
	switch ( field.type ) {
		case 'textarea':
			return (
				<div className="cs-mock cs-mock--area">
					{ field.placeholder }
				</div>
			);
		case 'select':
			return (
				<div className="cs-mock">
					<span>
						{ field.placeholder || __( 'Select…', 'contact-sync' ) }
					</span>
					<Icon name="chevronDown" size={ 14 } />
				</div>
			);
		case 'radio':
		case 'checkboxes':
			return (
				<div className="cs-mock-choices">
					{ ( field.options || [] ).slice( 0, 4 ).map( ( option ) => (
						<span key={ option.value } className="cs-mock-choice">
							<span
								className={
									field.type === 'radio'
										? 'cs-mock-dot'
										: 'cs-mock-box'
								}
							/>
							{ option.label }
						</span>
					) ) }
					{ field.options?.length > 4 && (
						<span className="cs-muted">
							+{ field.options.length - 4 }
						</span>
					) }
				</div>
			);
		case 'checkbox':
			return (
				<span className="cs-mock-choice">
					<span className="cs-mock-box" />
					{ field.placeholder || field.label }
				</span>
			);
		case 'hidden':
			return (
				<div className="cs-mock cs-mock--hidden">
					<Icon name="eyeOff" size={ 14 } />
					{ field.default
						? sprintf(
								/* translators: %s: value */ __(
									'Value: %s',
									'contact-sync'
								),
								field.default
						  )
						: __( 'No value set', 'contact-sync' ) }
				</div>
			);
		default:
			return (
				<div className="cs-mock">
					<span>{ field.placeholder }</span>
					{ field.type === 'date' && (
						<Icon name="calendar" size={ 14 } />
					) }
				</div>
			);
	}
}

function conditionSummary( field, fields ) {
	const c = field.conditions;
	if ( ! c?.enabled || ! c.rules.length ) {
		return '';
	}
	const rule = c.rules[ 0 ];
	const source = fields.find( ( f ) => f.key === rule.field );
	const more =
		c.rules.length > 1
			? sprintf(
					/* translators: %d: number of extra rules */ __(
						'+%d more',
						'contact-sync'
					),
					c.rules.length - 1
			  )
			: '';
	return `${
		c.action === 'hide'
			? __( 'Hide if', 'contact-sync' )
			: __( 'Show if', 'contact-sync' )
	} ${ source?.label || rule.field } ${ OPERATORS[ rule.operator ] } ${
		rule.value
	}${ more }`.trim();
}

export function FieldCard( {
	field,
	fields,
	selected,
	onSelect,
	onDuplicate,
	onRemove,
	dragHandle,
	overlay,
} ) {
	const def = FIELD_TYPES[ field.type ] || {};
	const condition = conditionSummary( field, fields || [] );

	if ( field.type === 'divider' ) {
		return (
			<div
				className={ cx(
					'cs-fcard cs-fcard--divider',
					selected && 'is-selected',
					overlay && 'is-overlay'
				) }
				onClick={ onSelect }
				role="presentation"
			>
				{ dragHandle }
				<hr />
				<span className="cs-fcard__type-pill">
					{ __( 'Divider', 'contact-sync' ) }
				</span>
				{ ! overlay && (
					<div className="cs-fcard__tools">
						<IconButton
							icon="trash"
							label={ __( 'Delete', 'contact-sync' ) }
							onClick={ onRemove }
						/>
					</div>
				) }
			</div>
		);
	}

	return (
		<div
			className={ cx(
				'cs-fcard',
				field.type === 'section' && 'cs-fcard--section',
				selected && 'is-selected',
				overlay && 'is-overlay'
			) }
			onClick={ onSelect }
			role="presentation"
		>
			{ dragHandle }
			<div className="cs-fcard__body">
				<div className="cs-fcard__head">
					<span className="cs-fcard__label">
						{ field.label || (
							<em className="cs-muted">
								{ __( 'Untitled', 'contact-sync' ) }
							</em>
						) }
						{ field.required && (
							<span className="cs-field__req">*</span>
						) }
					</span>
					<span className="cs-fcard__badges">
						{ condition && (
							<Badge tone="warning" icon="zap">
								{ __( 'Conditional', 'contact-sync' ) }
							</Badge>
						) }
						{ field.crm?.attribute && (
							<Badge tone="brand" icon="cloud">
								{ field.crm.attribute }
							</Badge>
						) }
					</span>
				</div>
				{ field.type === 'section' ? (
					field.description && (
						<p className="cs-fcard__desc">{ field.description }</p>
					)
				) : (
					<MockControl field={ field } />
				) }
				{ field.help && field.type !== 'section' && (
					<p className="cs-fcard__help">{ field.help }</p>
				) }
				{ condition && (
					<p className="cs-fcard__cond">
						<Icon name="zap" size={ 12 } /> { condition }
					</p>
				) }
			</div>
			<span className="cs-fcard__type-pill">
				<Icon name={ def.icon } size={ 12 } /> { def.label }
			</span>
			{ ! overlay && (
				<div className="cs-fcard__tools">
					<IconButton
						icon="copy"
						label={ __( 'Duplicate', 'contact-sync' ) }
						onClick={ onDuplicate }
					/>
					<IconButton
						icon="trash"
						label={ __( 'Delete', 'contact-sync' ) }
						onClick={ onRemove }
					/>
				</div>
			) }
		</div>
	);
}

function SortableField( props ) {
	const { field } = props;
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: field.id } );
	const style = {
		transform: CSS.Translate.toString( transform ),
		transition,
	};
	const half =
		field.width === 'half' &&
		! [ 'section', 'divider' ].includes( field.type );
	return (
		<div
			ref={ setNodeRef }
			style={ style }
			className={ cx(
				'cs-canvas__cell',
				half ? 'is-half' : 'is-full',
				isDragging && 'is-dragging'
			) }
		>
			<FieldCard
				{ ...props }
				dragHandle={
					<button
						type="button"
						className="cs-fcard__handle"
						aria-label={ __( 'Drag to reorder', 'contact-sync' ) }
						{ ...attributes }
						{ ...listeners }
					>
						<Icon name="grip" size={ 16 } />
					</button>
				}
			/>
		</div>
	);
}

export default function Canvas( {
	fields,
	selectedId,
	onSelect,
	onDuplicate,
	onRemove,
} ) {
	const { setNodeRef, isOver } = useDroppable( { id: 'canvas' } );
	return (
		<div
			ref={ setNodeRef }
			className={ cx( 'cs-canvas', isOver && 'is-over' ) }
		>
			<SortableContext
				items={ fields.map( ( f ) => f.id ) }
				strategy={ rectSortingStrategy }
			>
				<div className="cs-canvas__grid">
					{ fields.map( ( field ) => (
						<SortableField
							key={ field.id }
							field={ field }
							fields={ fields }
							selected={ field.id === selectedId }
							onSelect={ ( e ) => {
								e.stopPropagation();
								onSelect( field.id );
							} }
							onDuplicate={ ( e ) => {
								e.stopPropagation();
								onDuplicate( field.id );
							} }
							onRemove={ ( e ) => {
								e.stopPropagation();
								onRemove( field.id );
							} }
						/>
					) ) }
				</div>
			</SortableContext>
			{ ! fields.length && (
				<div className="cs-canvas__empty">
					<Icon name="plus" size={ 22 } />
					<strong>
						{ __( 'Your form is empty', 'contact-sync' ) }
					</strong>
					<span>
						{ __(
							'Drag fields here from the left, or click a field type to add it.',
							'contact-sync'
						) }
					</span>
				</div>
			) }
		</div>
	);
}
