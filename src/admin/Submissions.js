import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { del, downloadFile, get, post } from '../shared/api';
import Icon from '../shared/icons';
import { formatDate, timeAgo } from '../shared/format';
import { useFetch, useInterval } from '../shared/hooks';
import {
	Alert,
	Badge,
	Button,
	Card,
	Drawer,
	EmptyState,
	Input,
	PageHeader,
	Pagination,
	SearchInput,
	Segmented,
	Select,
	Spinner,
	StatusBadge,
	Table,
	cx,
	useUI,
} from '../shared/ui';
import { SubmissionDetails } from '../portal/app/SubmissionDrawer';
import { leadName } from './Dashboard';
import { hashParams } from './router';

const PER_PAGE = 25;

function SyncLog( { logs } ) {
	if ( ! logs?.length ) {
		return (
			<p className="cs-muted">
				{ __( 'No sync attempts yet.', 'contact-sync' ) }
			</p>
		);
	}
	return (
		<ol className="cs-timeline">
			{ logs.map( ( log ) => {
				const ok = log.http_status && log.http_status < 300;
				return (
					<li key={ log.id } className="cs-timeline__item">
						<span
							className={ cx(
								'cs-timeline__dot',
								ok ? 'is-success' : 'is-danger',
								log.action === 'find_lead' && 'is-warning'
							) }
						/>
						<div className="cs-timeline__head">
							<span>
								{ sprintf(
									/* translators: %d: attempt */ __(
										'Attempt %d',
										'contact-sync'
									),
									log.attempt
								) }
								{ log.http_status && (
									<span className="cs-muted">
										{ ' ' }
										· HTTP { log.http_status }
									</span>
								) }
							</span>
							<span className="cs-timeline__meta">
								{ formatDate( log.created_at ) }
							</span>
						</div>
						<p className="cs-timeline__msg">{ log.message }</p>
						{ ( log.request_body || log.response_body ) && (
							<details className="cs-details">
								<summary>
									{ __(
										'Technical details',
										'contact-sync'
									) }
								</summary>
								{ log.request_body && (
									<>
										<p className="cs-section-title">
											{ __(
												'Payload sent',
												'contact-sync'
											) }
										</p>
										<pre className="cs-code">
											{ log.request_body }
										</pre>
									</>
								) }
								{ log.response_body && (
									<>
										<p className="cs-section-title">
											{ __( 'Response', 'contact-sync' ) }
										</p>
										<pre className="cs-code">
											{ log.response_body }
										</pre>
									</>
								) }
							</details>
						) }
					</li>
				);
			} ) }
		</ol>
	);
}

function DetailDrawer( { id, onClose, onChanged, onOpen, softDelete } ) {
	const [ item, setItem ] = useState( null );
	const [ busy, setBusy ] = useState( false );
	const { toast, confirm } = useUI();

	const load = () =>
		get( `/submissions/${ id }` )
			.then( setItem )
			.catch( ( err ) => toast( err.message, 'danger' ) );
	useEffect( () => {
		setItem( null );
		if ( id ) {
			load();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ id ] );
	useInterval(
		load,
		4000,
		!! item && [ 'queued', 'syncing' ].includes( item.status )
	);

	const retry = async () => {
		setBusy( true );
		try {
			await post( '/submissions/retry', { ids: [ id ] } );
			toast( __( 'Lead re-queued', 'contact-sync' ) );
			await load();
			onChanged();
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setBusy( false );
	};

	const decide = async ( decision ) => {
		setBusy( true );
		try {
			await post( '/submissions/review', { ids: [ id ], decision } );
			toast(
				decision === 'approve'
					? __( 'Lead approved and queued', 'contact-sync' )
					: __( 'Lead rejected as duplicate', 'contact-sync' )
			);
			await load();
			onChanged();
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setBusy( false );
	};

	const trashed = !! item?.deleted_at;
	const toTrash = softDelete && ! trashed;

	const remove = async () => {
		if (
			! toTrash &&
			! ( await confirm( {
				title: __( 'Delete permanently?', 'contact-sync' ),
				message: __(
					'This removes it from this site for good. Records already in Dynamics 365 are not affected.',
					'contact-sync'
				),
				danger: true,
				confirmLabel: __( 'Delete permanently', 'contact-sync' ),
			} ) )
		) {
			return;
		}
		try {
			await del( `/submissions/${ id }` );
			toast(
				toTrash
					? __( 'Moved to the trash', 'contact-sync' )
					: __( 'Submission deleted', 'contact-sync' )
			);
			onChanged();
			onClose();
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	const restore = async () => {
		setBusy( true );
		try {
			await post( '/submissions/restore', { ids: [ id ] } );
			toast( __( 'Lead restored', 'contact-sync' ) );
			await load();
			onChanged();
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setBusy( false );
	};

	return (
		<Drawer
			open={ !! id }
			onClose={ onClose }
			width={ 640 }
			title={ item ? leadName( item ) : __( 'Loading…', 'contact-sync' ) }
			subtitle={
				item && (
					<>
						<StatusBadge status={ item.status } />
						<span>#{ item.id }</span>
						<span>·</span>
						<span>
							{ item.form.title } v{ item.form.version }
						</span>
					</>
				)
			}
			footer={
				item && (
					<>
						<Button
							variant="danger-ghost"
							icon="trash"
							onClick={ remove }
						>
							{ toTrash
								? __( 'Move to trash', 'contact-sync' )
								: __( 'Delete permanently', 'contact-sync' ) }
						</Button>
						<div className="cs-grow" />
						{ trashed && (
							<Button
								variant="primary"
								icon="undo"
								loading={ busy }
								onClick={ restore }
							>
								{ __( 'Restore', 'contact-sync' ) }
							</Button>
						) }
						{ ! trashed && item.status === 'review' && (
							<>
								<Button
									icon="x"
									disabled={ busy }
									onClick={ () => decide( 'reject' ) }
								>
									{ __( 'Reject', 'contact-sync' ) }
								</Button>
								<Button
									variant="primary"
									icon="check"
									loading={ busy }
									onClick={ () => decide( 'approve' ) }
								>
									{ __( 'Approve and send', 'contact-sync' ) }
								</Button>
							</>
						) }
						{ ! trashed &&
							! [ 'synced', 'review' ].includes(
								item.status
							) && (
								<Button
									variant="primary"
									icon="refresh"
									loading={ busy }
									onClick={ retry }
								>
									{ __( 'Retry sync', 'contact-sync' ) }
								</Button>
							) }
					</>
				)
			}
		>
			{ ! item ? (
				<div className="cs-boot">
					<Spinner />
				</div>
			) : (
				<>
					{ trashed && (
						<div className="cs-mb">
							<Alert
								tone="info"
								title={ __( 'In the trash', 'contact-sync' ) }
							>
								{ sprintf(
									/* translators: 1: date, 2: admin name */
									__(
										'Moved to the trash %1$s by %2$s. It is hidden from reps, reports and sync until restored.',
										'contact-sync'
									),
									formatDate( item.deleted_at ),
									item.deleted_by ||
										__( 'an administrator', 'contact-sync' )
								) }
							</Alert>
						</div>
					) }
					{ ! trashed &&
						item.status === 'review' &&
						item.duplicate_of && (
							<div className="cs-mb">
								<Alert
									tone="warning"
									title={ __(
										'Possible duplicate',
										'contact-sync'
									) }
									action={
										<Button
											size="sm"
											onClick={ () =>
												onOpen( item.duplicate_of )
											}
										>
											{ sprintf(
												/* translators: %d: submission ID */ __(
													'Open #%d',
													'contact-sync'
												),
												item.duplicate_of
											) }
										</Button>
									}
								>
									{ __(
										'A lead with the same email was submitted earlier. Approve to send this one to Dynamics 365 anyway, or reject it to keep it out.',
										'contact-sync'
									) }
								</Alert>
							</div>
						) }
					<SubmissionDetails item={ item } admin />
					<h3 className="cs-section-title">
						{ __( 'Sync history', 'contact-sync' ) }
					</h3>
					<SyncLog logs={ item.logs } />
				</>
			) }
		</Drawer>
	);
}

export default function Submissions() {
	const params = hashParams();
	const [ filters, setFilters ] = useState( {
		status: params.get( 'status' ) || '',
		agency_id: params.get( 'agency_id' ) || '',
		source: '',
		search: '',
		date_from: '',
		date_to: '',
	} );
	const [ page, setPage ] = useState( 1 );
	const [ selected, setSelected ] = useState( [] );
	const [ openId, setOpenId ] = useState(
		params.get( 'open' ) ? Number( params.get( 'open' ) ) : null
	);
	const [ exporting, setExporting ] = useState( false );
	const [ trashView, setTrashView ] = useState(
		params.get( 'trash' ) === '1'
	);
	const { data: agencies } = useFetch( '/agencies' );
	const { data, loading, reload } = useFetch( '/submissions', {
		...filters,
		trashed: trashView ? 1 : '',
		page,
		per_page: PER_PAGE,
	} );
	const softDelete = !! data?.soft_delete;
	const { toast, confirm } = useUI();
	const set = ( key ) => ( value ) =>
		setFilters( ( f ) => ( { ...f, [ key ]: value } ) );

	useEffect( () => {
		setPage( 1 );
		setSelected( [] );
	}, [ filters, trashView ] );

	useInterval(
		() => reload( true ),
		6000,
		!! data?.items?.some( ( i ) =>
			[ 'queued', 'syncing' ].includes( i.status )
		)
	);

	const bulkRetry = async () => {
		try {
			const res = await post( '/submissions/retry', { ids: selected } );
			toast(
				sprintf(
					/* translators: %d: count */ _n(
						'%d lead re-queued',
						'%d leads re-queued',
						res.queued,
						'contact-sync'
					),
					res.queued
				)
			);
			setSelected( [] );
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	const bulkReview = async ( decision ) => {
		try {
			const res = await post( '/submissions/review', {
				ids: selected,
				decision,
			} );
			const message =
				decision === 'approve'
					? sprintf(
							/* translators: %d: count */ _n(
								'%d lead approved and queued',
								'%d leads approved and queued',
								res.updated,
								'contact-sync'
							),
							res.updated
					  )
					: sprintf(
							/* translators: %d: count */ _n(
								'%d lead rejected as duplicate',
								'%d leads rejected as duplicates',
								res.updated,
								'contact-sync'
							),
							res.updated
					  );
			toast( message );
			setSelected( [] );
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	const toTrash = softDelete && ! trashView;

	const bulkDelete = async () => {
		const ok = await confirm( {
			title: toTrash
				? sprintf(
						/* translators: %d: count */ _n(
							'Move %d submission to the trash?',
							'Move %d submissions to the trash?',
							selected.length,
							'contact-sync'
						),
						selected.length
				  )
				: sprintf(
						/* translators: %d: count */ _n(
							'Permanently delete %d submission?',
							'Permanently delete %d submissions?',
							selected.length,
							'contact-sync'
						),
						selected.length
				  ),
			message: toTrash
				? __( 'You can restore them from the trash.', 'contact-sync' )
				: __(
						'This cannot be undone. Records already in Dynamics 365 are not affected.',
						'contact-sync'
				  ),
			danger: ! toTrash,
			confirmLabel: toTrash
				? __( 'Move to trash', 'contact-sync' )
				: __( 'Delete permanently', 'contact-sync' ),
		} );
		if ( ! ok ) {
			return;
		}
		try {
			await Promise.all(
				selected.map( ( id ) => del( `/submissions/${ id }` ) )
			);
			toast(
				toTrash
					? __( 'Moved to the trash', 'contact-sync' )
					: __( 'Submissions deleted', 'contact-sync' )
			);
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setSelected( [] );
		reload( true );
	};

	const bulkRestore = async () => {
		try {
			const res = await post( '/submissions/restore', {
				ids: selected,
			} );
			toast(
				sprintf(
					/* translators: %d: count */ _n(
						'%d lead restored',
						'%d leads restored',
						res.restored,
						'contact-sync'
					),
					res.restored
				)
			);
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setSelected( [] );
		reload( true );
	};

	const emptyTrash = async () => {
		const ok = await confirm( {
			title: __( 'Empty the trash?', 'contact-sync' ),
			message: __(
				'Every lead in the trash is deleted permanently. This cannot be undone.',
				'contact-sync'
			),
			danger: true,
			confirmLabel: __( 'Empty trash', 'contact-sync' ),
		} );
		if ( ! ok ) {
			return;
		}
		try {
			const res = await post( '/submissions/empty-trash' );
			toast(
				sprintf(
					/* translators: %d: count */ _n(
						'%d lead deleted permanently',
						'%d leads deleted permanently',
						res.deleted,
						'contact-sync'
					),
					res.deleted
				)
			);
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		reload( true );
	};

	const exportCsv = async () => {
		setExporting( true );
		try {
			const file = await get( '/submissions/export', {
				...filters,
				trashed: trashView ? 1 : '',
			} );
			downloadFile( file.filename, file.content );
			toast(
				sprintf(
					/* translators: %d: count */ __(
						'Exported %d rows',
						'contact-sync'
					),
					file.count
				)
			);
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setExporting( false );
	};

	const hasFilters = Object.values( filters ).some( Boolean );
	let emptyTitle = __( 'No submissions yet', 'contact-sync' );
	if ( hasFilters ) {
		emptyTitle = __( 'No matching submissions', 'contact-sync' );
	} else if ( trashView ) {
		emptyTitle = __( 'The trash is empty', 'contact-sync' );
	}

	return (
		<>
			<PageHeader
				title={
					trashView
						? __( 'Trash', 'contact-sync' )
						: __( 'Submissions', 'contact-sync' )
				}
				description={
					trashView
						? __(
								'Deleted leads. Restore them, or delete them permanently.',
								'contact-sync'
						  )
						: __(
								'Every lead submitted by reps, with its Dynamics 365 sync status.',
								'contact-sync'
						  )
				}
				actions={
					<div className="cs-row">
						{ trashView ? (
							<>
								<Button
									icon="arrowLeft"
									onClick={ () => setTrashView( false ) }
								>
									{ __(
										'Back to submissions',
										'contact-sync'
									) }
								</Button>
								<Button
									variant="danger-ghost"
									icon="trash"
									disabled={ ! data?.trashed }
									onClick={ emptyTrash }
								>
									{ __( 'Empty trash', 'contact-sync' ) }
								</Button>
							</>
						) : (
							( softDelete || data?.trashed > 0 ) && (
								<Button
									icon="trash"
									onClick={ () => setTrashView( true ) }
								>
									{ sprintf(
										/* translators: %d: number of leads in the trash */ __(
											'Trash (%d)',
											'contact-sync'
										),
										data?.trashed || 0
									) }
								</Button>
							)
						) }
						<Button
							icon="download"
							onClick={ exportCsv }
							loading={ exporting }
						>
							{ __( 'Export CSV', 'contact-sync' ) }
						</Button>
					</div>
				}
			/>
			{ trashView && data?.trash_days > 0 && (
				<div className="cs-mb">
					<Alert tone="info">
						{ sprintf(
							/* translators: %d: days */ _n(
								'Leads are deleted permanently %d day after they are moved to the trash.',
								'Leads are deleted permanently %d days after they are moved to the trash.',
								data.trash_days,
								'contact-sync'
							),
							data.trash_days
						) }
					</Alert>
				</div>
			) }
			<Card padded={ false }>
				<div className="cs-toolbar">
					<SearchInput
						value={ filters.search }
						onChange={ set( 'search' ) }
						placeholder={ __(
							'Search leads or lead ID…',
							'contact-sync'
						) }
					/>
					<Segmented
						size="sm"
						value={ filters.status }
						onChange={ set( 'status' ) }
						options={ [
							{ value: '', label: __( 'All', 'contact-sync' ) },
							{
								value: 'synced',
								label: __( 'Synced', 'contact-sync' ),
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
				</div>
				<div className="cs-toolbar cs-toolbar--secondary">
					<Select
						value={ filters.agency_id }
						onChange={ ( e ) =>
							set( 'agency_id' )( e.target.value )
						}
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
					<Select
						value={ filters.source }
						onChange={ ( e ) => set( 'source' )( e.target.value ) }
						options={ [
							{
								value: '',
								label: __( 'Any source', 'contact-sync' ),
							},
							{
								value: 'form',
								label: __( 'Lead form', 'contact-sync' ),
							},
							{
								value: 'import',
								label: __( 'Bulk upload', 'contact-sync' ),
							},
						] }
					/>
					<div className="cs-date-range">
						<Input
							type="date"
							value={ filters.date_from }
							onChange={ ( e ) =>
								set( 'date_from' )( e.target.value )
							}
							aria-label={ __( 'From date', 'contact-sync' ) }
						/>
						<span className="cs-muted">–</span>
						<Input
							type="date"
							value={ filters.date_to }
							onChange={ ( e ) =>
								set( 'date_to' )( e.target.value )
							}
							aria-label={ __( 'To date', 'contact-sync' ) }
						/>
					</div>
					{ hasFilters && (
						<Button
							size="sm"
							variant="ghost"
							icon="x"
							onClick={ () =>
								setFilters( {
									status: '',
									agency_id: '',
									source: '',
									search: '',
									date_from: '',
									date_to: '',
								} )
							}
						>
							{ __( 'Clear filters', 'contact-sync' ) }
						</Button>
					) }
				</div>
				{ selected.length > 0 && (
					<div className="cs-bulkbar">
						<span>
							{ sprintf(
								/* translators: %d: count */ _n(
									'%d selected',
									'%d selected',
									selected.length,
									'contact-sync'
								),
								selected.length
							) }
						</span>
						{ trashView && (
							<Button
								size="sm"
								icon="undo"
								onClick={ bulkRestore }
							>
								{ __( 'Restore', 'contact-sync' ) }
							</Button>
						) }
						{ ! trashView && filters.status === 'review' && (
							<>
								<Button
									size="sm"
									icon="check"
									onClick={ () => bulkReview( 'approve' ) }
								>
									{ __( 'Approve and send', 'contact-sync' ) }
								</Button>
								<Button
									size="sm"
									icon="x"
									onClick={ () => bulkReview( 'reject' ) }
								>
									{ __( 'Reject', 'contact-sync' ) }
								</Button>
							</>
						) }
						{ ! trashView && filters.status !== 'review' && (
							<Button
								size="sm"
								icon="refresh"
								onClick={ bulkRetry }
							>
								{ __( 'Retry sync', 'contact-sync' ) }
							</Button>
						) }
						<Button
							size="sm"
							variant="danger-ghost"
							icon="trash"
							onClick={ bulkDelete }
						>
							{ toTrash
								? __( 'Move to trash', 'contact-sync' )
								: __( 'Delete permanently', 'contact-sync' ) }
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={ () => setSelected( [] ) }
						>
							{ __( 'Clear', 'contact-sync' ) }
						</Button>
					</div>
				) }
				<Table
					rows={ data?.items }
					loading={ loading }
					selectable
					selected={ selected }
					onSelect={ setSelected }
					onRowClick={ ( item ) => setOpenId( item.id ) }
					columns={ [
						{
							key: 'lead',
							label: __( 'Lead', 'contact-sync' ),
							render: ( item ) => (
								<div className="cs-cell-primary__text">
									<strong>{ leadName( item ) }</strong>
									<span>
										{ [
											item.summary?.company,
											item.summary?.email,
										]
											.filter( Boolean )
											.join( ' · ' ) }
									</span>
								</div>
							),
						},
						{
							key: 'rep',
							label: __( 'Rep / agency', 'contact-sync' ),
							render: ( item ) => (
								<div className="cs-cell-primary__text">
									<strong className="cs-weight-normal">
										{ item.rep.name }
									</strong>
									<span>
										{ item.agency?.name ||
											__(
												'Independent',
												'contact-sync'
											) }
									</span>
								</div>
							),
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
										? sprintf(
												/* translators: %d: batch */ __(
													'Bulk #%d',
													'contact-sync'
												),
												item.batch_id
										  )
										: __( 'Form', 'contact-sync' ) }
								</span>
							),
						},
						{
							key: 'status',
							label: __( 'Status', 'contact-sync' ),
							render: ( item ) => (
								<div className="cs-status-cell">
									<StatusBadge status={ item.status } />
									{ item.status === 'failed' &&
										item.last_error && (
											<span
												className="cs-status-cell__err"
												title={ item.last_error }
											>
												{ item.last_error }
											</span>
										) }
									{ item.status === 'queued' &&
										item.attempts > 0 && (
											<Badge tone="warning">
												{ sprintf(
													/* translators: %d: attempts */ __(
														'retry %d',
														'contact-sync'
													),
													item.attempts
												) }
											</Badge>
										) }
								</div>
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
					] }
					empty={
						<EmptyState
							title={ emptyTitle }
							description={
								hasFilters
									? __(
											'Try adjusting the filters.',
											'contact-sync'
									  )
									: __(
											'Leads submitted through the portal will appear here.',
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
			<DetailDrawer
				id={ openId }
				onClose={ () => setOpenId( null ) }
				onChanged={ () => reload( true ) }
				onOpen={ setOpenId }
				softDelete={ softDelete }
			/>
		</>
	);
}
