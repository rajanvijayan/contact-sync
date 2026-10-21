import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { del, post, put } from '../shared/api';
import { REP_STATUS, ROLES, formatDate } from '../shared/format';
import { useFetch } from '../shared/hooks';
import {
	Alert,
	Avatar,
	Badge,
	Button,
	Card,
	EmptyState,
	Field,
	IconButton,
	Input,
	Menu,
	Modal,
	PageHeader,
	Pagination,
	Radio,
	SearchInput,
	Segmented,
	Select,
	Table,
	useUI,
} from '../shared/ui';
import { hashParams } from './router';

const PER_PAGE = 20;

function RepModal( { rep, agencies, onClose, onSaved } ) {
	const editing = !! rep;
	const [ form, setForm ] = useState( {
		first_name: rep?.first_name || '',
		last_name: rep?.last_name || '',
		email: rep?.email || '',
		type: rep?.agency ? 'agency' : 'independent',
		agency_id: rep?.agency?.id || agencies[ 0 ]?.id || '',
		role: rep?.role || 'cs_rep',
	} );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );
	const set = ( key, value ) => setForm( { ...form, [ key ]: value } );

	const save = async ( event ) => {
		event.preventDefault();
		setSaving( true );
		setError( null );
		const payload = {
			first_name: form.first_name,
			last_name: form.last_name,
			agency_id: form.type === 'agency' ? Number( form.agency_id ) : 0,
			role: form.role,
		};
		try {
			const saved = editing
				? await put( `/reps/${ rep.id }`, payload )
				: await post( '/reps', { ...payload, email: form.email } );
			onSaved( saved, ! editing );
		} catch ( err ) {
			setError( err );
		}
		setSaving( false );
	};

	return (
		<Modal
			open
			onClose={ onClose }
			icon={ editing ? 'user' : 'mail' }
			title={
				editing
					? __( 'Edit rep', 'contact-sync' )
					: __( 'Invite a rep', 'contact-sync' )
			}
			description={
				editing
					? rep.email
					: __(
							'They will receive an email with a link to set their password.',
							'contact-sync'
					  )
			}
			footer={
				<>
					<Button onClick={ onClose }>
						{ __( 'Cancel', 'contact-sync' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="cs-rep-form"
						loading={ saving }
						disabled={
							! form.first_name || ( ! editing && ! form.email )
						}
					>
						{ editing
							? __( 'Save changes', 'contact-sync' )
							: __( 'Send invitation', 'contact-sync' ) }
					</Button>
				</>
			}
		>
			<form id="cs-rep-form" className="cs-stack" onSubmit={ save }>
				{ error && <Alert tone="danger">{ error.message }</Alert> }
				<div className="cs-two-col">
					<Field
						label={ __( 'First name', 'contact-sync' ) }
						htmlFor="cs-rep-first"
						required
					>
						<Input
							id="cs-rep-first"
							value={ form.first_name }
							onChange={ ( e ) =>
								set( 'first_name', e.target.value )
							}
						/>
					</Field>
					<Field
						label={ __( 'Last name', 'contact-sync' ) }
						htmlFor="cs-rep-last"
					>
						<Input
							id="cs-rep-last"
							value={ form.last_name }
							onChange={ ( e ) =>
								set( 'last_name', e.target.value )
							}
						/>
					</Field>
				</div>
				{ ! editing && (
					<Field
						label={ __( 'Email', 'contact-sync' ) }
						htmlFor="cs-rep-email"
						required
					>
						<Input
							id="cs-rep-email"
							type="email"
							icon="mail"
							value={ form.email }
							onChange={ ( e ) => set( 'email', e.target.value ) }
						/>
					</Field>
				) }
				<Field label={ __( 'Rep type', 'contact-sync' ) }>
					<div className="cs-option-cards">
						<div
							className={ `cs-option-card ${
								form.type === 'independent' ? 'is-active' : ''
							}` }
						>
							<Radio
								name="cs-rep-type"
								checked={ form.type === 'independent' }
								onChange={ () => set( 'type', 'independent' ) }
								label={ __( 'Independent', 'contact-sync' ) }
							/>
							<span>
								{ __(
									'Not tied to an agency.',
									'contact-sync'
								) }
							</span>
						</div>
						<div
							className={ `cs-option-card ${
								form.type === 'agency' ? 'is-active' : ''
							}` }
						>
							<Radio
								name="cs-rep-type"
								checked={ form.type === 'agency' }
								onChange={ () => set( 'type', 'agency' ) }
								label={ __( 'Agency rep', 'contact-sync' ) }
								disabled={ ! agencies.length }
							/>
							<span>
								{ agencies.length
									? __(
											'Leads are attributed to the agency.',
											'contact-sync'
									  )
									: __(
											'Add an agency first.',
											'contact-sync'
									  ) }
							</span>
						</div>
					</div>
				</Field>
				{ form.type === 'agency' && (
					<Field
						label={ __( 'Agency', 'contact-sync' ) }
						htmlFor="cs-rep-agency"
					>
						<Select
							id="cs-rep-agency"
							value={ form.agency_id }
							onChange={ ( e ) =>
								set( 'agency_id', e.target.value )
							}
							options={ agencies.map( ( a ) => ( {
								value: a.id,
								label: a.name,
							} ) ) }
						/>
					</Field>
				) }
				<Field
					label={ __( 'Role', 'contact-sync' ) }
					htmlFor="cs-rep-role"
					help={ __(
						'Agency managers can also see every lead submitted by their agency.',
						'contact-sync'
					) }
				>
					<Select
						id="cs-rep-role"
						value={ form.role }
						onChange={ ( e ) => set( 'role', e.target.value ) }
						options={ [
							{ value: 'cs_rep', label: ROLES.cs_rep },
							{
								value: 'cs_agency_manager',
								label: ROLES.cs_agency_manager,
							},
						] }
					/>
				</Field>
			</form>
		</Modal>
	);
}

export default function Reps() {
	const [ search, setSearch ] = useState( '' );
	const [ agency, setAgency ] = useState(
		hashParams().get( 'agency' ) || ''
	);
	const [ status, setStatus ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ editing, setEditing ] = useState( null );
	const { data: agencies } = useFetch( '/agencies' );
	const { data, loading, reload } = useFetch( '/reps', {
		search,
		agency,
		status,
		page,
		per_page: PER_PAGE,
	} );
	const { toast, confirm } = useUI();

	useEffect( () => setPage( 1 ), [ search, agency, status ] );

	const action = async ( fn, success ) => {
		try {
			await fn();
			toast( success );
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	const remove = async ( rep ) => {
		const ok = await confirm( {
			title: __( 'Delete rep?', 'contact-sync' ),
			message: sprintf(
				/* translators: %s: name */ __(
					'%s will lose access immediately. Their submitted leads are kept.',
					'contact-sync'
				),
				rep.name
			),
			confirmLabel: __( 'Delete', 'contact-sync' ),
			danger: true,
		} );
		if ( ok ) {
			action(
				() => del( `/reps/${ rep.id }` ),
				__( 'Rep deleted', 'contact-sync' )
			);
		}
	};

	return (
		<>
			<PageHeader
				title={ __( 'Reps', 'contact-sync' ) }
				description={ __(
					'Agency reps sign up with their work email; independent reps are invited here.',
					'contact-sync'
				) }
				actions={
					<Button
						variant="primary"
						icon="plus"
						onClick={ () => setEditing( 'new' ) }
						disabled={ ! agencies }
					>
						{ __( 'Invite rep', 'contact-sync' ) }
					</Button>
				}
			/>
			<Card padded={ false }>
				<div className="cs-toolbar">
					<SearchInput
						value={ search }
						onChange={ setSearch }
						placeholder={ __(
							'Search name or email…',
							'contact-sync'
						) }
					/>
					<Select
						value={ agency }
						onChange={ ( e ) => setAgency( e.target.value ) }
						options={ [
							{
								value: '',
								label: __( 'All agencies', 'contact-sync' ),
							},
							{
								value: 'independent',
								label: __( 'Independent reps', 'contact-sync' ),
							},
							...( agencies || [] ).map( ( a ) => ( {
								value: String( a.id ),
								label: a.name,
							} ) ),
						] }
					/>
					<Segmented
						size="sm"
						value={ status }
						onChange={ setStatus }
						options={ [
							{ value: '', label: __( 'All', 'contact-sync' ) },
							{
								value: 'active',
								label: __( 'Active', 'contact-sync' ),
							},
							{
								value: 'pending',
								label: __( 'Pending', 'contact-sync' ),
							},
							{
								value: 'disabled',
								label: __( 'Disabled', 'contact-sync' ),
							},
						] }
					/>
				</div>
				<Table
					rows={ data?.items }
					loading={ loading }
					onRowClick={ ( rep ) => setEditing( rep ) }
					columns={ [
						{
							key: 'rep',
							label: __( 'Rep', 'contact-sync' ),
							render: ( rep ) => (
								<div className="cs-cell-primary">
									<Avatar name={ rep.name } size={ 34 } />
									<div className="cs-cell-primary__text">
										<strong>{ rep.name }</strong>
										<span>{ rep.email }</span>
									</div>
								</div>
							),
						},
						{
							key: 'agency',
							label: __( 'Agency', 'contact-sync' ),
							render: ( rep ) =>
								rep.agency?.name || (
									<Badge>
										{ __( 'Independent', 'contact-sync' ) }
									</Badge>
								),
						},
						{
							key: 'role',
							label: __( 'Role', 'contact-sync' ),
							render: ( rep ) => ROLES[ rep.role ] || rep.role,
						},
						{
							key: 'status',
							label: __( 'Status', 'contact-sync' ),
							render: ( rep ) => {
								const meta =
									REP_STATUS[ rep.status ] ||
									REP_STATUS.active;
								return (
									<Badge tone={ meta.tone } dot>
										{ meta.label }
									</Badge>
								);
							},
						},
						{
							key: 'joined',
							label: __( 'Joined', 'contact-sync' ),
							render: ( rep ) => (
								<div className="cs-cell-primary__text">
									<strong className="cs-weight-normal">
										{ formatDate( rep.registered, false ) }
									</strong>
									<span>
										{ rep.source === 'signup'
											? __(
													'Self sign-up',
													'contact-sync'
											  )
											: __( 'Invited', 'contact-sync' ) }
									</span>
								</div>
							),
						},
						{
							key: 'actions',
							label: '',
							align: 'right',
							width: 60,
							render: ( rep ) => (
								// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
								<div onClick={ ( e ) => e.stopPropagation() }>
									<Menu
										trigger={ ( { toggle } ) => (
											<IconButton
												icon="more"
												label={ __(
													'Actions',
													'contact-sync'
												) }
												onClick={ toggle }
											/>
										) }
										items={ [
											{
												label: __(
													'Edit',
													'contact-sync'
												),
												icon: 'edit',
												onClick: () =>
													setEditing( rep ),
											},
											{
												label:
													rep.status === 'pending'
														? __(
																'Resend verification',
																'contact-sync'
														  )
														: __(
																'Resend invitation',
																'contact-sync'
														  ),
												icon: 'mail',
												onClick: () =>
													action(
														() =>
															post(
																`/reps/${ rep.id }/resend`
															),
														__(
															'Email sent',
															'contact-sync'
														)
													),
											},
											rep.status === 'pending' && {
												label: __(
													'Mark as verified',
													'contact-sync'
												),
												icon: 'checkCircle',
												onClick: () =>
													action(
														() =>
															put(
																`/reps/${ rep.id }`,
																{
																	status: 'active',
																}
															),
														__(
															'Rep activated',
															'contact-sync'
														)
													),
											},
											rep.status === 'disabled'
												? {
														label: __(
															'Enable access',
															'contact-sync'
														),
														icon: 'check',
														onClick: () =>
															action(
																() =>
																	put(
																		`/reps/${ rep.id }`,
																		{
																			status: 'active',
																		}
																	),
																__(
																	'Access enabled',
																	'contact-sync'
																)
															),
												  }
												: {
														label: __(
															'Disable access',
															'contact-sync'
														),
														icon: 'lock',
														onClick: () =>
															action(
																() =>
																	put(
																		`/reps/${ rep.id }`,
																		{
																			status: 'disabled',
																		}
																	),
																__(
																	'Access disabled',
																	'contact-sync'
																)
															),
												  },
											{ separator: true },
											{
												label: __(
													'Delete',
													'contact-sync'
												),
												icon: 'trash',
												danger: true,
												onClick: () => remove( rep ),
											},
										] }
									/>
								</div>
							),
						},
					] }
					empty={
						<EmptyState
							icon="users"
							title={
								search || agency || status
									? __( 'No reps found', 'contact-sync' )
									: __( 'No reps yet', 'contact-sync' )
							}
							description={ __(
								'Reps appear here when they sign up with an agency email or when you invite them.',
								'contact-sync'
							) }
						/>
					}
				/>
				<Pagination
					page={ page }
					pages={ data?.pages || 1 }
					total={ data?.total || 0 }
					perPage={ PER_PAGE }
					onChange={ setPage }
				/>
			</Card>
			{ editing && agencies && (
				<RepModal
					rep={ editing === 'new' ? null : editing }
					agencies={ agencies }
					onClose={ () => setEditing( null ) }
					onSaved={ ( saved, created ) => {
						setEditing( null );
						toast(
							created
								? __( 'Invitation sent', 'contact-sync' )
								: __( 'Rep updated', 'contact-sync' )
						);
						reload( true );
					} }
				/>
			) }
		</>
	);
}
