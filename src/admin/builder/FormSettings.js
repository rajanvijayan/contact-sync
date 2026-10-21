import { __ } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import {
	Button,
	Field,
	IconButton,
	Input,
	Select,
	Textarea,
} from '../../shared/ui';
import config from '../config';

export default function FormSettings( { schema, onChange, fields } ) {
	const settings = schema.settings || {};
	const set = ( patch, tag ) =>
		onChange( { ...schema, settings: { ...settings, ...patch } }, tag );
	const statics = settings.staticValues || [];
	const setStatic = ( i, patch ) =>
		set(
			{
				staticValues: statics.map( ( s, j ) =>
					j === i ? { ...s, ...patch } : s
				),
			},
			`static:${ i }`
		);
	const mapped = fields.filter( ( f ) => f.crm?.attribute );
	const required = [ 'lastname', 'subject' ].filter(
		( a ) => ! mapped.some( ( f ) => f.crm.attribute === a )
	);

	return (
		<div className="cs-settings">
			<div className="cs-settings__head">
				<span className="cs-settings__type">
					<Icon name="settings" size={ 16 } />
					{ __( 'Form settings', 'contact-sync' ) }
				</span>
			</div>
			<p className="cs-muted cs-mb-sm">
				{ __(
					'Select a field on the canvas to edit it.',
					'contact-sync'
				) }
			</p>
			<div className="cs-stack">
				<Field
					label={ __( 'Submit button text', 'contact-sync' ) }
					htmlFor="cs-form-submit"
				>
					<Input
						id="cs-form-submit"
						value={ settings.submitLabel || '' }
						onChange={ ( e ) =>
							set( { submitLabel: e.target.value }, 'submit' )
						}
					/>
				</Field>
				<Field
					label={ __( 'Success message', 'contact-sync' ) }
					htmlFor="cs-form-success"
					help={ __(
						'Shown to the rep after a lead is submitted.',
						'contact-sync'
					) }
				>
					<Textarea
						id="cs-form-success"
						rows={ 3 }
						value={ settings.successMessage || '' }
						onChange={ ( e ) =>
							set( { successMessage: e.target.value }, 'success' )
						}
					/>
				</Field>

				<h3 className="cs-section-title">
					{ __( 'Dynamics 365 mapping', 'contact-sync' ) }
				</h3>
				<div className="cs-map-summary">
					{ mapped.length ? (
						mapped.map( ( f ) => (
							<div key={ f.id } className="cs-map-summary__row">
								<span>{ f.label || f.key }</span>
								<Icon name="arrowRight" size={ 12 } />
								<code>{ f.crm.attribute }</code>
							</div>
						) )
					) : (
						<p className="cs-muted">
							{ __( 'No fields mapped yet.', 'contact-sync' ) }
						</p>
					) }
				</div>
				{ required.length > 0 && (
					<p className="cs-hint">
						<Icon name="info" size={ 14 } />
						{ required.includes( 'lastname' ) &&
							__(
								'No field maps to lastname; the company or email is used instead.',
								'contact-sync'
							) }
						{ required.includes( 'subject' ) &&
							__(
								'Topic (subject) is generated from the template in Settings › Sync.',
								'contact-sync'
							) }
					</p>
				) }

				<Field
					label={ __( 'Fixed values', 'contact-sync' ) }
					help={ __(
						'Sent on every lead from this form, e.g. leadsourcecode = 8 (Web).',
						'contact-sync'
					) }
				>
					<div className="cs-statics">
						{ statics.map( ( row, i ) => (
							<div className="cs-statics__row" key={ i }>
								<Select
									value={ row.attribute }
									onChange={ ( e ) => {
										const attr = config.crmAttributes.find(
											( a ) =>
												a.attribute === e.target.value
										);
										setStatic( i, {
											attribute: e.target.value,
											type: attr?.type || row.type,
										} );
									} }
									options={ [
										{
											value: '',
											label: __(
												'Column…',
												'contact-sync'
											),
										},
										...config.crmAttributes.map(
											( a ) => ( {
												value: a.attribute,
												label: a.attribute,
											} )
										),
										...( row.attribute &&
										! config.crmAttributes.some(
											( a ) =>
												a.attribute === row.attribute
										)
											? [
													{
														value: row.attribute,
														label: row.attribute,
													},
											  ]
											: [] ),
									] }
								/>
								<Input
									value={ row.value }
									placeholder={ __(
										'Value',
										'contact-sync'
									) }
									onChange={ ( e ) =>
										setStatic( i, {
											value: e.target.value,
										} )
									}
								/>
								<IconButton
									icon="x"
									label={ __( 'Remove', 'contact-sync' ) }
									onClick={ () =>
										set( {
											staticValues: statics.filter(
												( _, j ) => j !== i
											),
										} )
									}
								/>
							</div>
						) ) }
						<Button
							size="sm"
							icon="plus"
							onClick={ () =>
								set( {
									staticValues: [
										...statics,
										{
											attribute: '',
											value: '',
											type: 'string',
										},
									],
								} )
							}
						>
							{ __( 'Add fixed value', 'contact-sync' ) }
						</Button>
					</div>
				</Field>
			</div>
		</div>
	);
}
