import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import {
	Field,
	Input,
	Segmented,
	Select,
	Switch,
	Tabs,
	Textarea,
} from '../../shared/ui';
import config from '../config';
import ConditionEditor from './ConditionEditor';
import OptionsEditor from './OptionsEditor';
import {
	CHOICE_TYPES,
	FIELD_TYPES,
	isLayout,
	slugify,
	uniqueKey,
} from './fieldTypes';

const TEXTUAL = [ 'text', 'textarea', 'email', 'phone', 'url' ];

function CrmMapping( { field, fields, onChange } ) {
	const attributes = config.crmAttributes || [];
	const known = attributes.find(
		( a ) => a.attribute === field.crm?.attribute
	);
	const [ custom, setCustom ] = useState(
		!! field.crm?.attribute && ! known
	);
	const usedBy = fields.filter(
		( f ) =>
			f.id !== field.id &&
			f.crm?.attribute &&
			f.crm.attribute === field.crm?.attribute
	);

	const pick = ( value ) => {
		if ( value === '__custom' ) {
			setCustom( true );
			onChange( { attribute: '', type: 'string' } );
			return;
		}
		setCustom( false );
		const attr = attributes.find( ( a ) => a.attribute === value );
		onChange( { attribute: value, type: attr?.type || 'string' } );
	};

	return (
		<div className="cs-stack">
			<Field
				label={ __( 'Dynamics 365 Lead column', 'contact-sync' ) }
				htmlFor="cs-crm-attr"
				help={ __(
					'Where this answer is stored on the Lead. Unmapped answers are added to the lead description.',
					'contact-sync'
				) }
			>
				<Select
					id="cs-crm-attr"
					value={ custom ? '__custom' : field.crm?.attribute || '' }
					onChange={ ( e ) => pick( e.target.value ) }
					options={ [
						{
							value: '',
							label: __( '— Not mapped —', 'contact-sync' ),
						},
						{
							label: __( 'Standard columns', 'contact-sync' ),
							options: attributes.map( ( a ) => ( {
								value: a.attribute,
								label: `${ a.label } (${ a.attribute })`,
							} ) ),
						},
						{
							label: __( 'Other', 'contact-sync' ),
							options: [
								{
									value: '__custom',
									label: __(
										'Custom column…',
										'contact-sync'
									),
								},
							],
						},
					] }
				/>
			</Field>
			{ custom && (
				<>
					<Field
						label={ __( 'Logical name', 'contact-sync' ) }
						htmlFor="cs-crm-custom"
						help={ __(
							'For example new_productinterest. Find it in Power Apps › Tables › Lead › Columns.',
							'contact-sync'
						) }
					>
						<Input
							id="cs-crm-custom"
							className="cs-mono-input"
							value={ field.crm?.attribute || '' }
							onChange={ ( e ) =>
								onChange( {
									...field.crm,
									attribute: e.target.value
										.toLowerCase()
										.replace( /[^a-z0-9_]/g, '' ),
								} )
							}
						/>
					</Field>
					<Field
						label={ __( 'Column type', 'contact-sync' ) }
						htmlFor="cs-crm-type"
					>
						<Select
							id="cs-crm-type"
							value={ field.crm?.type || 'string' }
							onChange={ ( e ) =>
								onChange( {
									...field.crm,
									type: e.target.value,
								} )
							}
							options={ [
								{
									value: 'string',
									label: __( 'Text', 'contact-sync' ),
								},
								{
									value: 'int',
									label: __(
										'Whole number / Choice (option set value)',
										'contact-sync'
									),
								},
								{
									value: 'decimal',
									label: __(
										'Decimal / Currency',
										'contact-sync'
									),
								},
								{
									value: 'bool',
									label: __( 'Yes / No', 'contact-sync' ),
								},
							] }
						/>
					</Field>
				</>
			) }
			{ CHOICE_TYPES.includes( field.type ) &&
				field.crm?.type === 'int' && (
					<p className="cs-hint">
						<Icon name="info" size={ 14 } />
						{ __(
							'For Choice columns, set each option value to the numeric option set value from Dynamics (e.g. 100000000).',
							'contact-sync'
						) }
					</p>
				) }
			{ usedBy.length > 0 && (
				<p className="cs-hint cs-hint--warn">
					<Icon name="alert" size={ 14 } />
					{ __( 'Also mapped by:', 'contact-sync' ) }{ ' ' }
					{ usedBy.map( ( f ) => f.label || f.key ).join( ', ' ) }.{ ' ' }
					{ __( 'Values will be combined.', 'contact-sync' ) }
				</p>
			) }
		</div>
	);
}

export default function FieldSettings( { field, fields, onChange, isNew } ) {
	const [ tab, setTab ] = useState( 'general' );
	const def = FIELD_TYPES[ field.type ];
	const layout = isLayout( field );
	const set = ( patch, tag ) => onChange( { ...field, ...patch }, tag );
	const setValidation = ( key, value ) => {
		const validation = { ...field.validation };
		if ( value === '' || value === undefined ) {
			delete validation[ key ];
		} else {
			validation[ key ] =
				key === 'pattern' || key === 'patternMessage'
					? value
					: Number( value );
		}
		set( { validation }, `${ field.id }:v:${ key }` );
	};

	const tabs = [
		{ id: 'general', label: __( 'General', 'contact-sync' ) },
		field.type !== 'divider' && {
			id: 'logic',
			label: __( 'Logic', 'contact-sync' ),
			icon: field.conditions?.enabled ? 'zap' : undefined,
		},
		! layout && { id: 'crm', label: __( 'Dynamics', 'contact-sync' ) },
	].filter( Boolean );

	return (
		<div className="cs-settings">
			<div className="cs-settings__head">
				<span className="cs-settings__type">
					<Icon name={ def.icon } size={ 16 } />
					{ def.label }
				</span>
			</div>
			<Tabs
				tabs={ tabs }
				value={ tabs.some( ( t ) => t.id === tab ) ? tab : 'general' }
				onChange={ setTab }
			/>

			{ tab === 'general' && field.type === 'divider' && (
				<p className="cs-muted">
					{ __(
						'A horizontal line that separates groups of fields.',
						'contact-sync'
					) }
				</p>
			) }

			{ tab === 'general' && field.type !== 'divider' && (
				<div className="cs-stack">
					<Field
						label={
							layout
								? __( 'Heading', 'contact-sync' )
								: __( 'Label', 'contact-sync' )
						}
						htmlFor="cs-fs-label"
					>
						<Input
							id="cs-fs-label"
							value={ field.label }
							onChange={ ( e ) => {
								const label = e.target.value;
								const patch = { label };
								if ( isNew ) {
									patch.key = uniqueKey(
										slugify( label ) || field.type,
										fields,
										field.id
									);
								}
								set( patch, `${ field.id }:label` );
							} }
						/>
					</Field>

					{ layout ? (
						<Field
							label={ __( 'Description', 'contact-sync' ) }
							htmlFor="cs-fs-desc"
							optional
						>
							<Textarea
								id="cs-fs-desc"
								rows={ 3 }
								value={ field.description || '' }
								onChange={ ( e ) =>
									set(
										{ description: e.target.value },
										`${ field.id }:desc`
									)
								}
							/>
						</Field>
					) : (
						<>
							{ field.type !== 'hidden' && (
								<Field
									label={
										field.type === 'checkbox'
											? __(
													'Checkbox text',
													'contact-sync'
											  )
											: __(
													'Placeholder',
													'contact-sync'
											  )
									}
									htmlFor="cs-fs-ph"
									optional
								>
									<Input
										id="cs-fs-ph"
										value={ field.placeholder || '' }
										onChange={ ( e ) =>
											set(
												{ placeholder: e.target.value },
												`${ field.id }:ph`
											)
										}
									/>
								</Field>
							) }
							{ CHOICE_TYPES.includes( field.type ) && (
								<Field
									label={ __( 'Options', 'contact-sync' ) }
								>
									<OptionsEditor
										options={ field.options }
										onChange={ ( options ) =>
											set(
												{ options },
												`${ field.id }:options`
											)
										}
									/>
								</Field>
							) }
							{ field.type !== 'hidden' && (
								<Field
									label={ __( 'Help text', 'contact-sync' ) }
									htmlFor="cs-fs-help"
									optional
								>
									<Input
										id="cs-fs-help"
										value={ field.help || '' }
										onChange={ ( e ) =>
											set(
												{ help: e.target.value },
												`${ field.id }:help`
											)
										}
									/>
								</Field>
							) }
							{ ! CHOICE_TYPES.includes( field.type ) &&
								field.type !== 'checkbox' && (
									<Field
										label={
											field.type === 'hidden'
												? __( 'Value', 'contact-sync' )
												: __(
														'Default value',
														'contact-sync'
												  )
										}
										htmlFor="cs-fs-def"
										optional={ field.type !== 'hidden' }
										help={
											field.type === 'hidden'
												? __(
														'Sent with every submission, e.g. a campaign code.',
														'contact-sync'
												  )
												: undefined
										}
									>
										<Input
											id="cs-fs-def"
											value={ field.default || '' }
											onChange={ ( e ) =>
												set(
													{ default: e.target.value },
													`${ field.id }:def`
												)
											}
										/>
									</Field>
								) }
							{ field.type !== 'hidden' && (
								<>
									<Switch
										checked={ field.required }
										onChange={ ( required ) =>
											set( { required } )
										}
										label={ __(
											'Required',
											'contact-sync'
										) }
										description={
											field.conditions?.enabled
												? __(
														'Only enforced while the field is visible.',
														'contact-sync'
												  )
												: undefined
										}
									/>
									<Field
										label={ __( 'Width', 'contact-sync' ) }
									>
										<Segmented
											value={ field.width }
											onChange={ ( width ) =>
												set( { width } )
											}
											options={ [
												{
													value: 'full',
													label: __(
														'Full width',
														'contact-sync'
													),
												},
												{
													value: 'half',
													label: __(
														'Half width',
														'contact-sync'
													),
													icon: 'columns',
												},
											] }
										/>
									</Field>
								</>
							) }

							{ field.type === 'number' && (
								<div className="cs-two-col">
									<Field
										label={ __(
											'Minimum',
											'contact-sync'
										) }
										htmlFor="cs-fs-min"
										optional
									>
										<Input
											id="cs-fs-min"
											type="number"
											value={
												field.validation?.min ?? ''
											}
											onChange={ ( e ) =>
												setValidation(
													'min',
													e.target.value
												)
											}
										/>
									</Field>
									<Field
										label={ __(
											'Maximum',
											'contact-sync'
										) }
										htmlFor="cs-fs-max"
										optional
									>
										<Input
											id="cs-fs-max"
											type="number"
											value={
												field.validation?.max ?? ''
											}
											onChange={ ( e ) =>
												setValidation(
													'max',
													e.target.value
												)
											}
										/>
									</Field>
								</div>
							) }
							{ TEXTUAL.includes( field.type ) && (
								<details className="cs-advanced">
									<summary>
										{ __(
											'Advanced validation',
											'contact-sync'
										) }
									</summary>
									<div className="cs-stack">
										<div className="cs-two-col">
											<Field
												label={ __(
													'Min length',
													'contact-sync'
												) }
												htmlFor="cs-fs-minl"
												optional
											>
												<Input
													id="cs-fs-minl"
													type="number"
													min={ 0 }
													value={
														field.validation
															?.minLength ?? ''
													}
													onChange={ ( e ) =>
														setValidation(
															'minLength',
															e.target.value
														)
													}
												/>
											</Field>
											<Field
												label={ __(
													'Max length',
													'contact-sync'
												) }
												htmlFor="cs-fs-maxl"
												optional
											>
												<Input
													id="cs-fs-maxl"
													type="number"
													min={ 1 }
													value={
														field.validation
															?.maxLength ?? ''
													}
													onChange={ ( e ) =>
														setValidation(
															'maxLength',
															e.target.value
														)
													}
												/>
											</Field>
										</div>
										<Field
											label={ __(
												'Pattern (regular expression)',
												'contact-sync'
											) }
											htmlFor="cs-fs-pat"
											optional
											help={ __(
												'The whole value must match, e.g. [A–Z]{2}[0–9]{4}',
												'contact-sync'
											) }
										>
											<Input
												id="cs-fs-pat"
												className="cs-mono-input"
												value={
													field.validation?.pattern ||
													''
												}
												onChange={ ( e ) =>
													setValidation(
														'pattern',
														e.target.value
													)
												}
											/>
										</Field>
										{ field.validation?.pattern && (
											<Field
												label={ __(
													'Error message',
													'contact-sync'
												) }
												htmlFor="cs-fs-patmsg"
												optional
											>
												<Input
													id="cs-fs-patmsg"
													value={
														field.validation
															?.patternMessage ||
														''
													}
													onChange={ ( e ) =>
														setValidation(
															'patternMessage',
															e.target.value
														)
													}
												/>
											</Field>
										) }
									</div>
								</details>
							) }
						</>
					) }

					<Field
						label={ __( 'Field key', 'contact-sync' ) }
						htmlFor="cs-fs-key"
						help={
							layout
								? __( 'Internal identifier.', 'contact-sync' )
								: __(
										'Used as the CSV column name. Changing it after go-live will break existing spreadsheets.',
										'contact-sync'
								  )
						}
					>
						<Input
							id="cs-fs-key"
							className="cs-mono-input"
							value={ field.key }
							onChange={ ( e ) =>
								set(
									{
										key: e.target.value
											.toLowerCase()
											.replace( /[^a-z0-9_]/g, '_' ),
									},
									`${ field.id }:key`
								)
							}
							onBlur={ () =>
								set( {
									key: uniqueKey(
										slugify( field.key ) || field.type,
										fields,
										field.id
									),
								} )
							}
						/>
					</Field>
				</div>
			) }

			{ tab === 'logic' && (
				<ConditionEditor
					field={ field }
					fields={ fields }
					onChange={ ( conditions ) =>
						set( { conditions }, `${ field.id }:cond` )
					}
				/>
			) }

			{ tab === 'crm' && (
				<CrmMapping
					field={ field }
					fields={ fields }
					onChange={ ( crm ) => set( { crm }, `${ field.id }:crm` ) }
				/>
			) }
		</div>
	);
}
