import { __, sprintf } from '@wordpress/i18n';
import { OPERATORS, VALUELESS_OPERATORS } from '../../shared/conditions';
import Icon from '../../shared/icons';
import {
	Alert,
	Button,
	IconButton,
	Input,
	Select,
	Switch,
} from '../../shared/ui';
import { CHOICE_TYPES, isLayout } from './fieldTypes';

const OPERATORS_FOR = {
	choice: [ 'equals', 'not_equals', 'in', 'empty', 'not_empty' ],
	multi: [ 'contains', 'not_contains', 'in', 'empty', 'not_empty' ],
	checkbox: [ 'not_empty', 'empty' ],
	number: [ 'equals', 'not_equals', 'gt', 'lt', 'empty', 'not_empty' ],
	text: [
		'equals',
		'not_equals',
		'contains',
		'not_contains',
		'in',
		'empty',
		'not_empty',
	],
};

const kind = ( field ) => {
	if ( ! field ) {
		return 'text';
	}
	if ( field.type === 'checkboxes' ) {
		return 'multi';
	}
	if ( CHOICE_TYPES.includes( field.type ) ) {
		return 'choice';
	}
	if ( field.type === 'checkbox' ) {
		return 'checkbox';
	}
	if ( field.type === 'number' ) {
		return 'number';
	}
	return 'text';
};

const operatorLabel = ( op, k ) => {
	if ( k === 'checkbox' ) {
		return op === 'not_empty'
			? __( 'is checked', 'contact-sync' )
			: __( 'is not checked', 'contact-sync' );
	}
	return OPERATORS[ op ];
};

export default function ConditionEditor( { field, fields, onChange } ) {
	const conditions = field.conditions || {
		enabled: false,
		action: 'show',
		match: 'all',
		rules: [],
	};
	const index = fields.findIndex( ( f ) => f.id === field.id );
	// Only fields above this one can drive it, which keeps the logic easy to follow and acyclic.
	const sources = fields
		.slice( 0, index )
		.filter( ( f ) => ! isLayout( f ) && f.type !== 'hidden' );
	const set = ( patch ) => onChange( { ...conditions, ...patch } );
	const setRule = ( i, patch ) =>
		set( {
			rules: conditions.rules.map( ( r, j ) =>
				j === i ? { ...r, ...patch } : r
			),
		} );

	const addRule = () => {
		const source = sources[ sources.length - 1 ];
		const k = kind( source );
		set( {
			enabled: true,
			rules: [
				...conditions.rules,
				{
					field: source.key,
					operator: OPERATORS_FOR[ k ][ 0 ],
					value: source.options?.[ 0 ]?.value || '',
				},
			],
		} );
	};

	if ( ! sources.length ) {
		return (
			<Alert
				tone="info"
				title={ __( 'No fields to depend on yet', 'contact-sync' ) }
			>
				{ __(
					'Conditions can use any field placed above this one. Move this field lower or add a field above it first.',
					'contact-sync'
				) }
			</Alert>
		);
	}

	return (
		<div className="cs-stack">
			<Switch
				checked={ conditions.enabled }
				onChange={ ( on ) =>
					on && ! conditions.rules.length
						? addRule()
						: set( { enabled: on } )
				}
				label={ __( 'Enable conditional logic', 'contact-sync' ) }
				description={
					field.type === 'section'
						? __(
								'Applies to every field in this section.',
								'contact-sync'
						  )
						: __(
								'Show or hide this field based on earlier answers.',
								'contact-sync'
						  )
				}
			/>

			{ conditions.enabled && (
				<div className="cs-logic">
					<div className="cs-logic__sentence">
						<Select
							value={ conditions.action }
							onChange={ ( e ) =>
								set( { action: e.target.value } )
							}
							options={ [
								{
									value: 'show',
									label: __( 'Show', 'contact-sync' ),
								},
								{
									value: 'hide',
									label: __( 'Hide', 'contact-sync' ),
								},
							] }
						/>
						<span>{ __( 'this field if', 'contact-sync' ) }</span>
						<Select
							value={ conditions.match }
							onChange={ ( e ) =>
								set( { match: e.target.value } )
							}
							options={ [
								{
									value: 'all',
									label: __( 'all', 'contact-sync' ),
								},
								{
									value: 'any',
									label: __( 'any', 'contact-sync' ),
								},
							] }
						/>
						<span>{ __( 'of these match:', 'contact-sync' ) }</span>
					</div>

					{ conditions.rules.map( ( rule, i ) => {
						const source = sources.find(
							( f ) => f.key === rule.field
						);
						const k = kind( source );
						const ops = OPERATORS_FOR[ k ];
						const needsValue = ! VALUELESS_OPERATORS.includes(
							rule.operator
						);
						return (
							<div className="cs-logic__rule" key={ i }>
								{ i > 0 && (
									<span className="cs-logic__joiner">
										{ conditions.match === 'any'
											? __( 'or', 'contact-sync' )
											: __( 'and', 'contact-sync' ) }
									</span>
								) }
								<div className="cs-logic__fields">
									<Select
										value={ rule.field }
										onChange={ ( e ) => {
											const next = sources.find(
												( f ) =>
													f.key === e.target.value
											);
											const nk = kind( next );
											setRule( i, {
												field: e.target.value,
												operator: OPERATORS_FOR[
													nk
												].includes( rule.operator )
													? rule.operator
													: OPERATORS_FOR[ nk ][ 0 ],
												value:
													next?.options?.[ 0 ]
														?.value || '',
											} );
										} }
										options={ [
											...( source
												? []
												: [
														{
															value: rule.field,
															label: sprintf(
																/* translators: %s: key */ __(
																	'%s (missing)',
																	'contact-sync'
																),
																rule.field
															),
														},
												  ] ),
											...sources.map( ( f ) => ( {
												value: f.key,
												label: f.label || f.key,
											} ) ),
										] }
									/>
									<Select
										value={ rule.operator }
										onChange={ ( e ) =>
											setRule( i, {
												operator: e.target.value,
											} )
										}
										options={ ops.map( ( op ) => ( {
											value: op,
											label: operatorLabel( op, k ),
										} ) ) }
									/>
									{ needsValue &&
										( source?.options?.length &&
										rule.operator !== 'in' ? (
											<Select
												value={ rule.value }
												onChange={ ( e ) =>
													setRule( i, {
														value: e.target.value,
													} )
												}
												options={ source.options.map(
													( o ) => ( {
														value: o.value,
														label: o.label,
													} )
												) }
											/>
										) : (
											<Input
												value={ rule.value }
												placeholder={
													rule.operator === 'in'
														? __(
																'value1, value2',
																'contact-sync'
														  )
														: __(
																'Value',
																'contact-sync'
														  )
												}
												onChange={ ( e ) =>
													setRule( i, {
														value: e.target.value,
													} )
												}
											/>
										) ) }
								</div>
								<IconButton
									icon="trash"
									label={ __(
										'Remove rule',
										'contact-sync'
									) }
									onClick={ () =>
										set( {
											rules: conditions.rules.filter(
												( _, j ) => j !== i
											),
											enabled:
												conditions.rules.length > 1,
										} )
									}
								/>
							</div>
						);
					} ) }

					<Button size="sm" icon="plus" onClick={ addRule }>
						{ __( 'Add rule', 'contact-sync' ) }
					</Button>
					<p className="cs-logic__tip">
						<Icon name="info" size={ 14 } />
						{ __(
							'Hidden fields are skipped by validation and are not sent to Dynamics 365. Use Preview to try it out.',
							'contact-sync'
						) }
					</p>
				</div>
			) }
		</div>
	);
}
