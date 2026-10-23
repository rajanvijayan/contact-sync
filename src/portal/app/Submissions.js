import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import { formatDate, timeAgo } from '../../shared/format';
import { useFetch, useInterval } from '../../shared/hooks';
import {
	Badge,
	Card,
	EmptyState,
	IconButton,
	PageHeader,
	Pagination,
	SearchInput,
	Segmented,
	StatusBadge,
	Table,
} from '../../shared/ui';
import { Link, navigate, query } from '../router';
import { leadName } from './Dashboard';
import SubmissionDrawer from './SubmissionDrawer';

const PER_PAGE = 20;

export default function Submissions( { scope } ) {
	const batch = query().get( 'batch' ) || '';
	const [ status, setStatus ] = useState( '' );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ open, setOpen ] = useState( null );

	useEffect( () => setPage( 1 ), [ status, search, scope, batch ] );

	const { data, loading, reload } = useFetch( '/portal/submissions', {
		scope,
		status,
		search,
		batch_id: batch,
		page,
		per_page: PER_PAGE,
	} );

	const pending = data?.items?.some( ( item ) =>
		[ 'queued', 'syncing' ].includes( item.status )
	);
	useInterval( () => reload( true ), 5000, !! pending );

	const agency = scope === 'agency';

	return (
		<>
			<PageHeader
				title={
					agency
						? __( 'Agency leads', 'contact-sync' )
						: __( 'My submissions', 'contact-sync' )
				}
				description={
					agency
						? __(
								'Every lead submitted by reps in your agency.',
								'contact-sync'
						  )
						: __(
								'Track the delivery status of every lead you have submitted.',
								'contact-sync'
						  )
				}
				actions={
					<Link
						to="app/new"
						className="cs-btn cs-btn--primary cs-btn--md"
					>
						<Icon name="plus" size={ 16 } />
						<span>{ __( 'New lead', 'contact-sync' ) }</span>
					</Link>
				}
			/>
			<Card padded={ false }>
				<div className="cs-toolbar">
					<SearchInput
						value={ search }
						onChange={ setSearch }
						placeholder={ __(
							'Search name, email, company…',
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
								value: 'synced',
								label: __( 'Delivered', 'contact-sync' ),
							},
							{
								value: 'queued',
								label: __( 'Queued', 'contact-sync' ),
							},
							{
								value: 'failed',
								label: __( 'Failed', 'contact-sync' ),
							},
							{
								value: 'review',
								label: __( 'In review', 'contact-sync' ),
							},
							{
								value: 'duplicate',
								label: __( 'Duplicate', 'contact-sync' ),
							},
						] }
					/>
					{ batch && (
						<Badge tone="brand">
							{ sprintf(
								/* translators: %s: import batch ID */ __(
									'Import #%s',
									'contact-sync'
								),
								batch
							) }
							<IconButton
								icon="x"
								label={ __( 'Clear filter', 'contact-sync' ) }
								className="cs-badge__clear"
								onClick={ () =>
									navigate(
										agency
											? 'app/agency'
											: 'app/submissions'
									)
								}
							/>
						</Badge>
					) }
				</div>
				<Table
					rows={ data?.items }
					loading={ loading }
					onRowClick={ setOpen }
					columns={ [
						{
							key: 'lead',
							label: __( 'Lead', 'contact-sync' ),
							render: ( item ) => (
								<div className="cs-cell-primary__text">
									<strong>{ leadName( item ) }</strong>
									<span>{ item.summary?.email }</span>
								</div>
							),
						},
						{
							key: 'company',
							label: __( 'Company', 'contact-sync' ),
							render: ( item ) =>
								item.summary?.company || (
									<span className="cs-muted">—</span>
								),
						},
						agency && {
							key: 'rep',
							label: __( 'Rep', 'contact-sync' ),
							render: ( item ) => item.rep.name,
						},
						{
							key: 'source',
							label: __( 'Source', 'contact-sync' ),
							render: ( item ) => (
								<span className="cs-source">
									<Icon
										name={
											item.source === 'import'
												? 'upload'
												: 'form'
										}
										size={ 14 }
									/>
									{ item.source === 'import'
										? __( 'Bulk', 'contact-sync' )
										: __( 'Form', 'contact-sync' ) }
								</span>
							),
						},
						{
							key: 'status',
							label: __( 'Status', 'contact-sync' ),
							render: ( item ) => (
								<StatusBadge status={ item.status } />
							),
						},
						{
							key: 'created',
							label: __( 'Submitted', 'contact-sync' ),
							render: ( item ) => (
								<span
									className="cs-muted"
									title={ formatDate( item.created_at ) }
								>
									{ timeAgo( item.created_at ) }
								</span>
							),
						},
					].filter( Boolean ) }
					empty={
						<EmptyState
							title={
								search || status || batch
									? __( 'No matching leads', 'contact-sync' )
									: __( 'No leads yet', 'contact-sync' )
							}
							description={
								search || status || batch
									? __(
											'Try a different search or filter.',
											'contact-sync'
									  )
									: __(
											'Leads you submit will appear here with their delivery status.',
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
			<SubmissionDrawer item={ open } onClose={ () => setOpen( null ) } />
		</>
	);
}
