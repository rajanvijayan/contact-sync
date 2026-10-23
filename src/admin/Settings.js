import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { get, post, put } from '../shared/api';
import Icon from '../shared/icons';
import { setCrmConnected } from '../shared/format';
import {
	Alert,
	Badge,
	Button,
	Card,
	Field,
	Input,
	PageHeader,
	PasswordInput,
	Segmented,
	Select,
	Spinner,
	Switch,
	Tabs,
	Textarea,
	useUI,
} from '../shared/ui';
import config from './config';

const TABS = [
	{
		id: 'connection',
		label: __( 'Dynamics 365', 'contact-sync' ),
		icon: 'plug',
	},
	{ id: 'sync', label: __( 'Sync', 'contact-sync' ), icon: 'refresh' },
	{
		id: 'branding',
		label: __( 'Branding', 'contact-sync' ),
		icon: 'palette',
	},
	{ id: 'emails', label: __( 'Emails', 'contact-sync' ), icon: 'mail' },
	{ id: 'security', label: __( 'Security', 'contact-sync' ), icon: 'shield' },
	{ id: 'data', label: __( 'Data & logs', 'contact-sync' ), icon: 'list' },
];

function SetupGuide() {
	const steps = [
		__(
			'In the Azure portal open Microsoft Entra ID › App registrations › New registration. Any name, single tenant.',
			'contact-sync'
		),
		__(
			'Copy the Application (client) ID and Directory (tenant) ID from the overview page.',
			'contact-sync'
		),
		__(
			'Under Certificates & secrets create a new client secret and copy its Value.',
			'contact-sync'
		),
		__(
			'In the Power Platform admin center open your environment › Settings › Users + permissions › Application users › New app user. Pick the app and give it a security role that can create Leads (e.g. Salesperson).',
			'contact-sync'
		),
		__(
			'Copy the environment URL (e.g. https://yourorg.crm.dynamics.com) into Organization URL below.',
			'contact-sync'
		),
	];
	return (
		<details className="cs-guide">
			<summary>
				<Icon name="info" size={ 16 } />
				{ __( 'How to get these values', 'contact-sync' ) }
			</summary>
			<ol>
				{ steps.map( ( step ) => (
					<li key={ step }>{ step }</li>
				) ) }
			</ol>
		</details>
	);
}

function pickMedia( onSelect ) {
	if ( ! window.wp?.media ) {
		return;
	}
	const frame = window.wp.media( {
		title: __( 'Choose logo', 'contact-sync' ),
		library: { type: 'image' },
		multiple: false,
	} );
	frame.on( 'select', () =>
		onSelect( frame.state().get( 'selection' ).first().toJSON().url )
	);
	frame.open();
}

export default function Settings() {
	const [ tab, setTab ] = useState(
		() => window.location.hash.split( 'tab=' )[ 1 ] || 'connection'
	);
	const [ settings, setSettings ] = useState( null );
	const [ original, setOriginal ] = useState( '' );
	const [ secret, setSecret ] = useState( '' );
	const [ saving, setSaving ] = useState( false );
	const [ testing, setTesting ] = useState( false );
	const [ test, setTest ] = useState( null );
	const { toast } = useUI();

	useEffect( () => {
		get( '/settings' ).then( ( data ) => {
			setSettings( data );
			setOriginal( JSON.stringify( data ) );
		} );
	}, [] );

	if ( ! settings ) {
		return (
			<div className="cs-boot">
				<Spinner />
			</div>
		);
	}

	const dirty = JSON.stringify( settings ) !== original || secret !== '';
	const set = ( section, key ) => ( value ) =>
		setSettings( ( s ) => ( {
			...s,
			[ section ]: { ...s[ section ], [ key ]: value },
		} ) );
	const text = ( section, key ) => ( e ) =>
		set( section, key )( e.target.value );
	const d = settings.dynamics;

	const save = async () => {
		setSaving( true );
		try {
			const payload = {
				...settings,
				dynamics: { ...settings.dynamics, client_secret: secret },
			};
			const result = await put( '/settings', payload );
			setSettings( result );
			setOriginal( JSON.stringify( result ) );
			setSecret( '' );
			setCrmConnected(
				!! (
					result.dynamics.org_url &&
					result.dynamics.tenant_id &&
					result.dynamics.client_id &&
					result.dynamics.has_secret
				)
			);
			toast( __( 'Settings saved', 'contact-sync' ) );
			if ( result.branding.primary_color ) {
				document
					.getElementById( 'contact-sync-admin' )
					?.style.setProperty(
						'--cs-brand',
						result.branding.primary_color
					);
			}
			return true;
		} catch ( err ) {
			toast( err.message, 'danger' );
			return false;
		} finally {
			setSaving( false );
		}
	};

	const testConnection = async () => {
		setTesting( true );
		setTest( null );
		if ( dirty && ! ( await save() ) ) {
			setTesting( false );
			return;
		}
		try {
			setTest( {
				ok: true,
				...( await post( '/settings/test-connection' ) ),
			} );
		} catch ( err ) {
			setTest( { ok: false, message: err.message } );
		}
		setTesting( false );
	};

	const configured = d.org_url && d.tenant_id && d.client_id && d.has_secret;
	let connState = configured ? 'is-idle' : '';
	if ( test ) {
		connState = test.ok ? 'is-ok' : 'is-bad';
	}

	return (
		<div className="cs-settings-page">
			<PageHeader
				title={ __( 'Settings', 'contact-sync' ) }
				description={ __(
					'Connection, sync behaviour, branding, security, and data retention.',
					'contact-sync'
				) }
			/>
			<Tabs tabs={ TABS } value={ tab } onChange={ setTab } />

			{ tab === 'connection' && (
				<div className="cs-settings-grid">
					<Card
						title={ __(
							'Dynamics 365 connection',
							'contact-sync'
						) }
						description={ __(
							'Leads are created through the Dataverse Web API using an Azure app registration (client credentials).',
							'contact-sync'
						) }
						icon="plug"
					>
						<div className="cs-stack">
							<SetupGuide />
							<Field
								label={ __(
									'Organization URL',
									'contact-sync'
								) }
								htmlFor="cs-d-url"
								required
							>
								<Input
									id="cs-d-url"
									icon="link"
									placeholder="https://yourorg.crm.dynamics.com"
									value={ d.org_url }
									onChange={ text( 'dynamics', 'org_url' ) }
								/>
							</Field>
							<div className="cs-two-col">
								<Field
									label={ __(
										'Directory (tenant) ID',
										'contact-sync'
									) }
									htmlFor="cs-d-tenant"
									required
								>
									<Input
										id="cs-d-tenant"
										className="cs-mono-input"
										placeholder="00000000-0000-0000-0000-000000000000"
										value={ d.tenant_id }
										onChange={ text(
											'dynamics',
											'tenant_id'
										) }
									/>
								</Field>
								<Field
									label={ __(
										'Application (client) ID',
										'contact-sync'
									) }
									htmlFor="cs-d-client"
									required
								>
									<Input
										id="cs-d-client"
										className="cs-mono-input"
										placeholder="00000000-0000-0000-0000-000000000000"
										value={ d.client_id }
										onChange={ text(
											'dynamics',
											'client_id'
										) }
									/>
								</Field>
							</div>
							<Field
								label={ __( 'Client secret', 'contact-sync' ) }
								htmlFor="cs-d-secret"
								required
								help={
									d.has_secret
										? __(
												'A secret is saved and encrypted. Leave blank to keep it, or enter a new one to replace it.',
												'contact-sync'
										  )
										: __(
												'Stored encrypted. It is never shown again after saving.',
												'contact-sync'
										  )
								}
							>
								<PasswordInput
									id="cs-d-secret"
									icon="lock"
									autoComplete="new-password"
									placeholder={
										d.has_secret ? '••••••••••••••••' : ''
									}
									value={ secret }
									onChange={ ( e ) =>
										setSecret( e.target.value )
									}
								/>
							</Field>
							<Field
								label={ __(
									'Web API version',
									'contact-sync'
								) }
								htmlFor="cs-d-ver"
							>
								<Select
									id="cs-d-ver"
									value={ d.api_version }
									onChange={ text(
										'dynamics',
										'api_version'
									) }
									options={ [ '9.2', '9.1', '9.0' ].map(
										( v ) => ( {
											value: v,
											label: `v${ v }`,
										} )
									) }
								/>
							</Field>
						</div>
					</Card>
					<div className="cs-stack">
						<Card
							title={ __( 'Connection status', 'contact-sync' ) }
						>
							<div className="cs-stack">
								<div className="cs-conn">
									<span
										className={ `cs-conn__dot ${ connState }` }
									/>
									<strong>
										{ test?.ok &&
											__( 'Connected', 'contact-sync' ) }
										{ test &&
											! test.ok &&
											__(
												'Connection failed',
												'contact-sync'
											) }
										{ ! test &&
											( configured
												? __(
														'Configured, not tested',
														'contact-sync'
												  )
												: __(
														'Not configured',
														'contact-sync'
												  ) ) }
									</strong>
								</div>
								{ test && ! test.ok && (
									<Alert tone="danger">
										{ test.message }
									</Alert>
								) }
								{ test?.ok && (
									<dl className="cs-dl">
										<div className="cs-dl__row">
											<dt>
												{ __(
													'App user ID',
													'contact-sync'
												) }
											</dt>
											<dd className="cs-mono">
												{ test.user_id }
											</dd>
										</div>
										<div className="cs-dl__row">
											<dt>
												{ __(
													'Organization ID',
													'contact-sync'
												) }
											</dt>
											<dd className="cs-mono">
												{ test.organization_id }
											</dd>
										</div>
									</dl>
								) }
								<Button
									icon="plug"
									onClick={ testConnection }
									loading={ testing }
									disabled={
										! d.org_url ||
										! d.tenant_id ||
										! d.client_id ||
										( ! d.has_secret && ! secret )
									}
									block
								>
									{ dirty
										? __(
												'Save and test connection',
												'contact-sync'
										  )
										: __(
												'Test connection',
												'contact-sync'
										  ) }
								</Button>
							</div>
						</Card>
					</div>
				</div>
			) }

			{ tab === 'sync' && (
				<div className="cs-settings-grid">
					<Card
						title={ __( 'Sync behaviour', 'contact-sync' ) }
						icon="refresh"
					>
						<div className="cs-stack">
							<Switch
								checked={ settings.sync.enabled }
								onChange={ set( 'sync', 'enabled' ) }
								label={ __(
									'Send leads to Dynamics 365',
									'contact-sync'
								) }
								description={ __(
									'Turn off to pause delivery. New leads are stored and sent when you turn it back on.',
									'contact-sync'
								) }
							/>
							<Switch
								checked={ settings.sync.hold_duplicates }
								onChange={ set( 'sync', 'hold_duplicates' ) }
								label={ __(
									'Hold duplicates for review',
									'contact-sync'
								) }
								description={ __(
									'A lead with the same email as an earlier submission (including earlier rows in the same upload) waits on the Submissions page until you approve or reject it.',
									'contact-sync'
								) }
							/>
							<Field
								label={ __(
									'Duplicate handling',
									'contact-sync'
								) }
								help={ __(
									'Checks Dynamics 365 for an open lead with the same email before creating one. Leads you approve from review skip this check.',
									'contact-sync'
								) }
							>
								<Segmented
									value={ settings.sync.duplicate_check }
									onChange={ set(
										'sync',
										'duplicate_check'
									) }
									options={ [
										{
											value: 'off',
											label: __(
												'Always create',
												'contact-sync'
											),
										},
										{
											value: 'skip',
											label: __(
												'Skip duplicates',
												'contact-sync'
											),
										},
									] }
								/>
							</Field>
							<Field
								label={ __( 'Retry attempts', 'contact-sync' ) }
								htmlFor="cs-s-max"
								help={ __(
									'Temporary errors (timeouts, throttling, outages) are retried with increasing delays: 1 min, 5 min, 15 min, 1 h…',
									'contact-sync'
								) }
							>
								<Input
									id="cs-s-max"
									type="number"
									min={ 1 }
									max={ 10 }
									value={ settings.sync.max_attempts }
									onChange={ ( e ) =>
										set(
											'sync',
											'max_attempts'
										)( Number( e.target.value ) )
									}
								/>
							</Field>
							<Field
								label={ __( 'Topic template', 'contact-sync' ) }
								htmlFor="cs-s-subj"
								help={ __(
									'Used for the Lead topic (subject) when no form field maps to it. Placeholders: {agency} {rep} {name} {company} {email}',
									'contact-sync'
								) }
							>
								<Input
									id="cs-s-subj"
									value={ settings.sync.subject_template }
									onChange={ text(
										'sync',
										'subject_template'
									) }
								/>
							</Field>
						</div>
					</Card>
					<Card
						title={ __( 'Attribution', 'contact-sync' ) }
						description={ __(
							'Store who submitted the lead on the Lead record.',
							'contact-sync'
						) }
						icon="users"
					>
						<div className="cs-stack">
							<Field
								label={ __(
									'Agency name column',
									'contact-sync'
								) }
								htmlFor="cs-s-ag"
								optional
								help={ __(
									'Logical name of a text column on Lead, e.g. new_agency.',
									'contact-sync'
								) }
							>
								<Input
									id="cs-s-ag"
									className="cs-mono-input"
									value={ settings.sync.agency_attribute }
									onChange={ text(
										'sync',
										'agency_attribute'
									) }
								/>
							</Field>
							<Field
								label={ __(
									'Rep name column',
									'contact-sync'
								) }
								htmlFor="cs-s-rep"
								optional
							>
								<Input
									id="cs-s-rep"
									className="cs-mono-input"
									value={ settings.sync.rep_attribute }
									onChange={ text( 'sync', 'rep_attribute' ) }
								/>
							</Field>
							<Field
								label={ __(
									'Rep email column',
									'contact-sync'
								) }
								htmlFor="cs-s-repe"
								optional
							>
								<Input
									id="cs-s-repe"
									className="cs-mono-input"
									value={ settings.sync.rep_email_attr }
									onChange={ text(
										'sync',
										'rep_email_attr'
									) }
								/>
							</Field>
							<Switch
								checked={ settings.sync.append_to_notes }
								onChange={ set( 'sync', 'append_to_notes' ) }
								label={ __(
									'Add details to the lead description',
									'contact-sync'
								) }
								description={ __(
									'Appends unmapped answers and “Submitted by … (agency)” so nothing is lost.',
									'contact-sync'
								) }
							/>
							<Button
								icon="send"
								onClick={ async () => {
									try {
										const res = await post(
											'/settings/sync-queued'
										);
										toast(
											sprintf(
												/* translators: %d: count */ __(
													'%d queued leads scheduled',
													'contact-sync'
												),
												res.queued
											)
										);
									} catch ( err ) {
										toast( err.message, 'danger' );
									}
								} }
							>
								{ __(
									'Sync queued leads now',
									'contact-sync'
								) }
							</Button>
						</div>
					</Card>
				</div>
			) }

			{ tab === 'branding' && (
				<div className="cs-settings-grid">
					<Card
						title={ __( 'Portal branding', 'contact-sync' ) }
						icon="palette"
					>
						<div className="cs-stack">
							<Field
								label={ __( 'Product name', 'contact-sync' ) }
								htmlFor="cs-b-name"
							>
								<Input
									id="cs-b-name"
									value={ settings.branding.product_name }
									onChange={ text(
										'branding',
										'product_name'
									) }
								/>
							</Field>
							<Field
								label={ __( 'Tagline', 'contact-sync' ) }
								htmlFor="cs-b-tag"
								help={ __(
									'Shown on the sign-in page.',
									'contact-sync'
								) }
							>
								<Input
									id="cs-b-tag"
									value={ settings.branding.tagline }
									onChange={ text( 'branding', 'tagline' ) }
								/>
							</Field>
							<Field
								label={ __( 'Logo', 'contact-sync' ) }
								htmlFor="cs-b-logo"
								optional
							>
								<div className="cs-row">
									<Input
										id="cs-b-logo"
										className="cs-grow"
										placeholder="https://"
										value={ settings.branding.logo_url }
										onChange={ text(
											'branding',
											'logo_url'
										) }
									/>
									<Button
										onClick={ () =>
											pickMedia(
												set( 'branding', 'logo_url' )
											)
										}
									>
										{ __( 'Choose…', 'contact-sync' ) }
									</Button>
								</div>
							</Field>
							<Field
								label={ __( 'Brand colour', 'contact-sync' ) }
								htmlFor="cs-b-color"
							>
								<div className="cs-color">
									<input
										type="color"
										value={
											settings.branding.primary_color
										}
										onChange={ text(
											'branding',
											'primary_color'
										) }
										aria-label={ __(
											'Pick colour',
											'contact-sync'
										) }
									/>
									<Input
										id="cs-b-color"
										className="cs-mono-input"
										value={
											settings.branding.primary_color
										}
										onChange={ text(
											'branding',
											'primary_color'
										) }
									/>
								</div>
							</Field>
							<Field
								label={ __( 'Support email', 'contact-sync' ) }
								htmlFor="cs-b-support"
								optional
								help={ __(
									'Shown to reps in the portal footer and emails.',
									'contact-sync'
								) }
							>
								<Input
									id="cs-b-support"
									type="email"
									value={ settings.branding.support_email }
									onChange={ text(
										'branding',
										'support_email'
									) }
								/>
							</Field>
						</div>
					</Card>
					<Card title={ __( 'Preview', 'contact-sync' ) }>
						<div
							className="cs-brand-preview"
							style={ {
								'--cs-brand': settings.branding.primary_color,
							} }
						>
							<div className="cs-brand-preview__aside">
								{ settings.branding.logo_url ? (
									<img
										src={ settings.branding.logo_url }
										alt=""
									/>
								) : (
									<strong>
										{ settings.branding.product_name }
									</strong>
								) }
								<p>{ settings.branding.tagline }</p>
							</div>
							<div className="cs-brand-preview__main">
								<span className="cs-brand-preview__line" />
								<span className="cs-brand-preview__line is-short" />
								<span className="cs-brand-preview__btn">
									{ __( 'Sign in', 'contact-sync' ) }
								</span>
							</div>
						</div>
						<p className="cs-hint">
							<Icon name="external" size={ 14 } />
							<a
								href={ config.loginUrl }
								target="_blank"
								rel="noreferrer"
							>
								{ __(
									'Open the sign-in page',
									'contact-sync'
								) }
							</a>
						</p>
					</Card>
				</div>
			) }

			{ tab === 'emails' && (
				<div className="cs-stack">
					<Card
						title={ __( 'Sender', 'contact-sync' ) }
						icon="mail"
						description={ __(
							'Emails are sent with wp_mail(). For reliable delivery use an SMTP plugin.',
							'contact-sync'
						) }
						actions={
							<Button
								size="sm"
								icon="send"
								onClick={ async () => {
									try {
										toast(
											(
												await post(
													'/settings/test-email'
												)
											).message
										);
									} catch ( err ) {
										toast( err.message, 'danger' );
									}
								} }
							>
								{ __( 'Send test email', 'contact-sync' ) }
							</Button>
						}
					>
						<div className="cs-two-col">
							<Field
								label={ __( 'From name', 'contact-sync' ) }
								htmlFor="cs-e-fn"
								optional
							>
								<Input
									id="cs-e-fn"
									value={ settings.emails.from_name }
									onChange={ text( 'emails', 'from_name' ) }
									placeholder={
										settings.branding.product_name
									}
								/>
							</Field>
							<Field
								label={ __( 'From email', 'contact-sync' ) }
								htmlFor="cs-e-fe"
								optional
							>
								<Input
									id="cs-e-fe"
									type="email"
									value={ settings.emails.from_email }
									onChange={ text( 'emails', 'from_email' ) }
									placeholder="no-reply@yourcompany.com"
								/>
							</Field>
						</div>
					</Card>
					{ [
						[
							'verify',
							__( 'Email verification', 'contact-sync' ),
							__( 'Sent after a rep signs up.', 'contact-sync' ),
						],
						[
							'invite',
							__( 'Invitation', 'contact-sync' ),
							__( 'Sent when you invite a rep.', 'contact-sync' ),
						],
						[
							'reset',
							__( 'Password reset', 'contact-sync' ),
							__(
								'Sent from “Forgot password”.',
								'contact-sync'
							),
						],
					].map( ( [ key, title, desc ] ) => (
						<Card key={ key } title={ title } description={ desc }>
							<div className="cs-stack">
								<Field
									label={ __( 'Subject', 'contact-sync' ) }
									htmlFor={ `cs-e-${ key }-s` }
								>
									<Input
										id={ `cs-e-${ key }-s` }
										value={
											settings.emails[
												`${ key }_subject`
											]
										}
										onChange={ text(
											'emails',
											`${ key }_subject`
										) }
									/>
								</Field>
								<Field
									label={ __( 'Message', 'contact-sync' ) }
									htmlFor={ `cs-e-${ key }-b` }
									help={ __(
										'Placeholders: {first_name} {site}. The action button and link are added automatically.',
										'contact-sync'
									) }
								>
									<Textarea
										id={ `cs-e-${ key }-b` }
										rows={ 4 }
										value={
											settings.emails[ `${ key }_body` ]
										}
										onChange={ text(
											'emails',
											`${ key }_body`
										) }
									/>
								</Field>
							</div>
						</Card>
					) ) }
				</div>
			) }

			{ tab === 'security' && (
				<div className="cs-settings-grid">
					<Card
						title={ __( 'Sign-in protection', 'contact-sync' ) }
						icon="shield"
					>
						<div className="cs-stack">
							<div className="cs-two-col">
								<Field
									label={ __(
										'Failed attempts before lockout',
										'contact-sync'
									) }
									htmlFor="cs-sec-att"
								>
									<Input
										id="cs-sec-att"
										type="number"
										min={ 1 }
										value={
											settings.security.login_attempts
										}
										onChange={ ( e ) =>
											set(
												'security',
												'login_attempts'
											)( Number( e.target.value ) )
										}
									/>
								</Field>
								<Field
									label={ __(
										'Lockout (minutes)',
										'contact-sync'
									) }
									htmlFor="cs-sec-lock"
								>
									<Input
										id="cs-sec-lock"
										type="number"
										min={ 1 }
										value={
											settings.security.lockout_minutes
										}
										onChange={ ( e ) =>
											set(
												'security',
												'lockout_minutes'
											)( Number( e.target.value ) )
										}
									/>
								</Field>
							</div>
							<Switch
								checked={ settings.security.match_subdomains }
								onChange={ set(
									'security',
									'match_subdomains'
								) }
								label={ __(
									'Allow subdomains',
									'contact-sync'
								) }
								description={ __(
									'When on, sales.acme.com matches an agency registered with acme.com.',
									'contact-sync'
								) }
							/>
							<p className="cs-hint">
								<Badge tone="success" icon="check">
									{ __( 'Always on', 'contact-sync' ) }
								</Badge>
								{ __(
									'Email verification, rate-limited sign-up, encrypted CRM secret, front-end lockdown, XML-RPC disabled.',
									'contact-sync'
								) }
							</p>
						</div>
					</Card>
					<Card
						title={ __( 'Bulk upload limits', 'contact-sync' ) }
						icon="upload"
					>
						<div className="cs-two-col">
							<Field
								label={ __(
									'Max rows per file',
									'contact-sync'
								) }
								htmlFor="cs-sec-rows"
							>
								<Input
									id="cs-sec-rows"
									type="number"
									min={ 1 }
									value={ settings.security.max_csv_rows }
									onChange={ ( e ) =>
										set(
											'security',
											'max_csv_rows'
										)( Number( e.target.value ) )
									}
								/>
							</Field>
							<Field
								label={ __(
									'Max file size (KB)',
									'contact-sync'
								) }
								htmlFor="cs-sec-kb"
							>
								<Input
									id="cs-sec-kb"
									type="number"
									min={ 16 }
									value={ settings.security.max_csv_kb }
									onChange={ ( e ) =>
										set(
											'security',
											'max_csv_kb'
										)( Number( e.target.value ) )
									}
								/>
							</Field>
						</div>
					</Card>
				</div>
			) }

			{ tab === 'data' && (
				<div className="cs-settings-grid">
					<Card
						title={ __( 'Deleting leads', 'contact-sync' ) }
						icon="trash"
					>
						<div className="cs-stack">
							<Switch
								checked={ settings.data.soft_delete }
								onChange={ set( 'data', 'soft_delete' ) }
								label={ __(
									'Move deleted leads to the trash',
									'contact-sync'
								) }
								description={ __(
									'Deleted leads are hidden everywhere but can be restored from Submissions › Trash. When off, deleting a lead removes it immediately.',
									'contact-sync'
								) }
							/>
							<Field
								label={ __(
									'Empty the trash after (days)',
									'contact-sync'
								) }
								htmlFor="cs-data-trash"
								help={ __(
									'Leads in the trash longer than this are deleted permanently. 0 keeps them until you empty the trash.',
									'contact-sync'
								) }
							>
								<Input
									id="cs-data-trash"
									type="number"
									min={ 0 }
									max={ 3650 }
									value={ settings.data.trash_days }
									onChange={ ( e ) =>
										set(
											'data',
											'trash_days'
										)( Number( e.target.value ) )
									}
								/>
							</Field>
						</div>
					</Card>
					<Card
						title={ __( 'Log retention', 'contact-sync' ) }
						icon="clock"
					>
						<div className="cs-stack">
							<Field
								label={ __(
									'Keep logs for (days)',
									'contact-sync'
								) }
								htmlFor="cs-data-logs"
								help={ __(
									'Applies to the Activity log and to each lead’s sync history. Older entries are removed once a day. 0 keeps them forever.',
									'contact-sync'
								) }
							>
								<Input
									id="cs-data-logs"
									type="number"
									min={ 0 }
									max={ 3650 }
									value={ settings.data.log_days }
									onChange={ ( e ) =>
										set(
											'data',
											'log_days'
										)( Number( e.target.value ) )
									}
								/>
							</Field>
						</div>
					</Card>
				</div>
			) }

			<div className={ `cs-savebar ${ dirty ? 'is-visible' : '' }` }>
				<span>
					<Icon name="info" size={ 16 } />
					{ __( 'You have unsaved changes', 'contact-sync' ) }
				</span>
				<Button
					variant="ghost"
					onClick={ () => {
						setSettings( JSON.parse( original ) );
						setSecret( '' );
					} }
				>
					{ __( 'Discard', 'contact-sync' ) }
				</Button>
				<Button variant="primary" onClick={ save } loading={ saving }>
					{ __( 'Save settings', 'contact-sync' ) }
				</Button>
			</div>
		</div>
	);
}
