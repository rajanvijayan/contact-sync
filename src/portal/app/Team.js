import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { put } from '../../shared/api';
import { REP_STATUS, ROLES, formatDate } from '../../shared/format';
import { useFetch } from '../../shared/hooks';
import {
	Badge,
	Button,
	Card,
	EmptyState,
	PageHeader,
	Pagination,
	SearchInput,
	Segmented,
	Table,
	useUI,
} from '../../shared/ui';
import { usePortal } from './context';

const PER_PAGE = 20;

/**
 * Why a manager can't toggle this person, or null when they can.
 *
 * @param {Object} rep  Team member.
 * @param {Object} user Signed-in manager.
 * @return {string|null} Reason.
 */
function lockedReason( rep, user ) {
	if ( rep.id === user.id ) {
		return __( 'This is you', 'contact-sync' );
	}
	if ( rep.role !== 'cs_rep' ) {
		return __( 'Managed by an administrator', 'contact-sync' );
	}
	if ( rep.status === 'pending' ) {
		return __( 'Waiting for email verification', 'contact-sync' );
	}
	if ( rep.status === 'disabled' && rep.disabled_by !== 'manager' ) {
		return __( 'Disabled by an administrator', 'contact-sync' );
	}
	return null;
}

export default function Team() {
	const { me } = usePortal();
	const user = me.user;
	const [ status, setStatus ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ busy, setBusy ] = useState( null );
	const { toast, confirm } = useUI();

	useEffect( () => setPage( 1 ), [ status, search ] );

	const { data, loading, reload } = useFetch( '/portal/team', {
		status,
		search,
		page,
		per_page: PER_PAGE,
	} );

	const toggle = async ( rep ) => {
		const disable = rep.status !== 'disabled';
		const ok = await confirm( {
			title: disable
				? sprintf(
						/* translators: %s: rep name */ __(
							'Disable access for %s?',
							'contact-sync'
						),
						rep.name
				  )
				: sprintf(
						/* translators: %s: rep name */ __(
							'Enable access for %s?',
							'contact-sync'
						),
						rep.name
				  ),
			message: disable
				? __(
						'They are signed out right away and can no longer sign in or submit leads. Their earlier leads are kept.',
						'contact-sync'
				  )
				: __(
						'They can sign in and submit leads again.',
						'contact-sync'
				  ),
			danger: disable,
			confirmLabel: disable
				? __( 'Disable access', 'contact-sync' )
				: __( 'Enable access', 'contact-sync' ),
		} );
		if ( ! ok ) {
			return;
		}
		setBusy( rep.id );
		try {
			await put( `/portal/team/${ rep.id }`, {
				status: disable ? 'disabled' : 'active',
			} );
			toast(
				disable
					? __( 'Access disabled', 'contact-sync' )
					: __( 'Access enabled', 'contact-sync' )
			);
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setBusy( null );
	};

	return (
		<>
			<PageHeader
				title={ __( 'Team', 'contact-sync' ) }
				description={ sprintf(
					/* translators: %s: agency name */ __(
						'People at %s. Disable access for anyone who should no longer submit leads.',
						'contact-sync'
					),
					user.agency?.name || ''
				) }
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
								value: 'disabled',
								label: __( 'Disabled', 'contact-sync' ),
							},
						] }
					/>
				</div>
				<Table
					rows={ data?.items }
					loading={ loading }
					columns={ [
						{
							key: 'name',
							label: __( 'Name', 'contact-sync' ),
							render: ( rep ) => (
								<div className="cs-cell-primary__text">
									<strong>{ rep.name }</strong>
									<span>{ rep.email }</span>
								</div>
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
								<span className="cs-muted">
									{ formatDate( rep.registered, false ) }
								</span>
							),
						},
						{
							key: 'actions',
							label: '',
							align: 'right',
							render: ( rep ) => {
								const reason = lockedReason( rep, user );
								if ( reason ) {
									return (
										<span className="cs-muted">
											{ reason }
										</span>
									);
								}
								return rep.status === 'disabled' ? (
									<Button
										size="sm"
										icon="check"
										loading={ busy === rep.id }
										onClick={ () => toggle( rep ) }
									>
										{ __( 'Enable', 'contact-sync' ) }
									</Button>
								) : (
									<Button
										size="sm"
										variant="danger-ghost"
										icon="lock"
										loading={ busy === rep.id }
										onClick={ () => toggle( rep ) }
									>
										{ __( 'Disable', 'contact-sync' ) }
									</Button>
								);
							},
						},
					] }
					empty={
						<EmptyState
							icon="users"
							title={
								search || status
									? __( 'No matching people', 'contact-sync' )
									: __(
											'No one else in your agency yet',
											'contact-sync'
									  )
							}
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
		</>
	);
}
