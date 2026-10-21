import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { del, post, put } from '../shared/api';
import Icon from '../shared/icons';
import { formatDate } from '../shared/format';
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
	SearchInput,
	Segmented,
	Switch,
	Table,
	Textarea,
	useUI,
} from '../shared/ui';
import { TagInput, normalizeDomain } from './components';
import { go } from './router';

const EMPTY = {
	name: '',
	domains: [],
	status: 'active',
	crm_account_id: '',
	notes: '',
};

function AgencyModal( { agency, onClose, onSaved } ) {
	const [ form, setForm ] = useState(
		agency
			? {
					...EMPTY,
					...agency,
					crm_account_id: agency.crm_account_id || '',
			  }
			: EMPTY
	);
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );
	const set = ( key, value ) => setForm( { ...form, [ key ]: value } );

	const save = async ( event ) => {
		event.preventDefault();
		setSaving( true );
		setError( null );
		try {
			const payload = {
				name: form.name,
				domains: form.domains,
				status: form.status,
				crm_account_id: form.crm_account_id,
				notes: form.notes,
			};
			const saved = agency
				? await put( `/agencies/${ agency.id }`, payload )
				: await post( '/agencies', payload );
			onSaved( saved, ! agency );
		} catch ( err ) {
			setError( err );
		}
		setSaving( false );
	};

	return (
		<Modal
			open
			onClose={ onClose }
			icon="building"
			title={
				agency
					? __( 'Edit agency', 'contact-sync' )
					: __( 'Add agency', 'contact-sync' )
			}
			description={ __(
				'Reps whose email matches one of the domains can sign up and are linked to this agency automatically.',
				'contact-sync'
			) }
			footer={
				<>
					<Button onClick={ onClose }>
						{ __( 'Cancel', 'contact-sync' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="cs-agency-form"
						loading={ saving }
						disabled={ ! form.name.trim() }
					>
						{ agency
							? __( 'Save changes', 'contact-sync' )
							: __( 'Add agency', 'contact-sync' ) }
					</Button>
				</>
			}
		>
			<form id="cs-agency-form" className="cs-stack" onSubmit={ save }>
				{ error && <Alert tone="danger">{ error.message }</Alert> }
				<Field
					label={ __( 'Agency name', 'contact-sync' ) }
					htmlFor="cs-ag-name"
					required
				>
					<Input
						id="cs-ag-name"
						value={ form.name }
						onChange={ ( e ) => set( 'name', e.target.value ) }
						placeholder={ __(
							'e.g. Northwind Partners',
							'contact-sync'
						) }
					/>
				</Field>
				<Field
					label={ __( 'Email domains', 'contact-sync' ) }
					htmlFor="cs-ag-domains"
					help={ __(
						'Press Enter after each domain, e.g. northwind.com. Leave empty to allow invited reps only.',
						'contact-sync'
					) }
				>
					<TagInput
						id="cs-ag-domains"
						value={ form.domains }
						onChange={ ( v ) => set( 'domains', v ) }
						normalize={ normalizeDomain }
						placeholder="agency.com"
					/>
				</Field>
				<Field
					label={ __( 'Dynamics account ID', 'contact-sync' ) }
					htmlFor="cs-ag-crm"
					optional
					help={ __(
						'For your reference; the GUID of the matching account record.',
						'contact-sync'
					) }
				>
					<Input
						id="cs-ag-crm"
						value={ form.crm_account_id }
						onChange={ ( e ) =>
							set( 'crm_account_id', e.target.value )
						}
						placeholder="00000000-0000-0000-0000-000000000000"
					/>
				</Field>
				<Field
					label={ __( 'Notes', 'contact-sync' ) }
					htmlFor="cs-ag-notes"
					optional
				>
					<Textarea
						id="cs-ag-notes"
						rows={ 3 }
						value={ form.notes }
						onChange={ ( e ) => set( 'notes', e.target.value ) }
					/>
				</Field>
				<Switch
					checked={ form.status === 'active' }
					onChange={ ( on ) =>
						set( 'status', on ? 'active' : 'inactive' )
					}
					label={ __( 'Active', 'contact-sync' ) }
					description={ __(
						'Inactive agencies cannot accept new sign-ups. Existing reps keep access.',
						'contact-sync'
					) }
				/>
			</form>
		</Modal>
	);
}

export default function Agencies() {
	const [ search, setSearch ] = useState( '' );
	const [ status, setStatus ] = useState( '' );
	const [ editing, setEditing ] = useState( null );
	const { data, loading, reload } = useFetch( '/agencies', {
		search,
		status,
	} );
	const { toast, confirm } = useUI();

	const remove = async ( agency ) => {
		const ok = await confirm( {
			title: __( 'Delete agency?', 'contact-sync' ),
			message: sprintf(
				/* translators: 1: agency, 2: rep count */
				_n(
					'“%1$s” will be removed and its %2$d rep will become independent. Submitted leads are kept.',
					'“%1$s” will be removed and its %2$d reps will become independent. Submitted leads are kept.',
					agency.rep_count,
					'contact-sync'
				),
				agency.name,
				agency.rep_count
			),
			confirmLabel: __( 'Delete agency', 'contact-sync' ),
			danger: true,
		} );
		if ( ! ok ) {
			return;
		}
		try {
			await del( `/agencies/${ agency.id }` );
			toast( __( 'Agency deleted', 'contact-sync' ) );
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	return (
		<>
			<PageHeader
				title={ __( 'Agencies', 'contact-sync' ) }
				description={ __(
					'Partner agencies and the email domains their reps sign up with.',
					'contact-sync'
				) }
				actions={
					<Button
						variant="primary"
						icon="plus"
						onClick={ () => setEditing( 'new' ) }
					>
						{ __( 'Add agency', 'contact-sync' ) }
					</Button>
				}
			/>
			<Card padded={ false }>
				<div className="cs-toolbar">
					<SearchInput
						value={ search }
						onChange={ setSearch }
						placeholder={ __( 'Search agencies…', 'contact-sync' ) }
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
								value: 'inactive',
								label: __( 'Inactive', 'contact-sync' ),
							},
						] }
					/>
				</div>
				<Table
					rows={ data }
					loading={ loading }
					onRowClick={ ( a ) => setEditing( a ) }
					columns={ [
						{
							key: 'name',
							label: __( 'Agency', 'contact-sync' ),
							render: ( a ) => (
								<div className="cs-cell-primary">
									<Avatar name={ a.name } size={ 34 } />
									<div className="cs-cell-primary__text">
										<strong>{ a.name }</strong>
										<span>
											{ sprintf(
												/* translators: %s: date */ __(
													'Added %s',
													'contact-sync'
												),
												formatDate(
													a.created_at,
													false
												)
											) }
										</span>
									</div>
								</div>
							),
						},
						{
							key: 'domains',
							label: __( 'Domains', 'contact-sync' ),
							render: ( a ) =>
								a.domains.length ? (
									<div className="cs-chip-list">
										{ a.domains
											.slice( 0, 3 )
											.map( ( d ) => (
												<Badge key={ d }>@{ d }</Badge>
											) ) }
										{ a.domains.length > 3 && (
											<Badge tone="brand">
												+{ a.domains.length - 3 }
											</Badge>
										) }
									</div>
								) : (
									<span className="cs-muted">
										{ __( 'Invite only', 'contact-sync' ) }
									</span>
								),
						},
						{
							key: 'reps',
							label: __( 'Reps', 'contact-sync' ),
							render: ( a ) => (
								<button
									type="button"
									className="cs-link-btn"
									onClick={ ( e ) => {
										e.stopPropagation();
										go( `reps?agency=${ a.id }` );
									} }
								>
									<Icon name="users" size={ 14 } />{ ' ' }
									{ a.rep_count }
								</button>
							),
						},
						{
							key: 'status',
							label: __( 'Status', 'contact-sync' ),
							render: ( a ) => (
								<Badge
									tone={
										a.status === 'active'
											? 'success'
											: 'neutral'
									}
									dot
								>
									{ a.status === 'active'
										? __( 'Active', 'contact-sync' )
										: __( 'Inactive', 'contact-sync' ) }
								</Badge>
							),
						},
						{
							key: 'actions',
							label: '',
							align: 'right',
							width: 60,
							render: ( a ) => (
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
												onClick: () => setEditing( a ),
											},
											{
												label: __(
													'View reps',
													'contact-sync'
												),
												icon: 'users',
												onClick: () =>
													go(
														`reps?agency=${ a.id }`
													),
											},
											{
												label: __(
													'View submissions',
													'contact-sync'
												),
												icon: 'inbox',
												onClick: () =>
													go(
														`submissions?agency_id=${ a.id }`
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
												onClick: () => remove( a ),
											},
										] }
									/>
								</div>
							),
						},
					] }
					empty={
						<EmptyState
							icon="building"
							title={
								search || status
									? __( 'No agencies found', 'contact-sync' )
									: __( 'No agencies yet', 'contact-sync' )
							}
							description={ __(
								'Add an agency with its email domain so its reps can sign up.',
								'contact-sync'
							) }
							action={
								! search && (
									<Button
										variant="primary"
										icon="plus"
										onClick={ () => setEditing( 'new' ) }
									>
										{ __( 'Add agency', 'contact-sync' ) }
									</Button>
								)
							}
						/>
					}
				/>
			</Card>
			{ editing && (
				<AgencyModal
					agency={ editing === 'new' ? null : editing }
					onClose={ () => setEditing( null ) }
					onSaved={ ( saved, created ) => {
						setEditing( null );
						toast(
							created
								? __( 'Agency added', 'contact-sync' )
								: __( 'Agency updated', 'contact-sync' )
						);
						reload( true );
					} }
				/>
			) }
		</>
	);
}
