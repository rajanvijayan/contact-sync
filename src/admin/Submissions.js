import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { del, downloadFile, get, post } from '../shared/api';
import Icon from '../shared/icons';
import { formatDate, timeAgo } from '../shared/format';
import { useFetch, useInterval } from '../shared/hooks';
import {
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

function DetailDrawer( { id, onClose, onChanged } ) {
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

	const remove = async () => {
		if (
			! ( await confirm( {
				title: __( 'Delete submission?', 'contact-sync' ),
				message: __(
					'This removes it from this site only. Records already in Dynamics 365 are not affected.',
					'contact-sync'
				),
				danger: true,
				confirmLabel: __( 'Delete', 'contact-sync' ),
			} ) )
		) {
			return;
		}
		await del( `/submissions/${ id }` );
		toast( __( 'Submission deleted', 'contact-sync' ) );
		onChanged();
		onClose();
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
							{ __( 'Delete', 'contact-sync' ) }
						</Button>
						<div className="cs-grow" />
						{ item.status !== 'synced' && (
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
	const { data: agencies } = useFetch( '/agencies' );
	const { data, loading, reload } = useFetch( '/submissions', {
		...filters,
		page,
		per_page: PER_PAGE,
	} );
	const { toast, confirm } = useUI();
	const set = ( key ) => ( value ) =>
		setFilters( ( f ) => ( { ...f, [ key ]: value } ) );

	useEffect( () => {
		setPage( 1 );
		setSelected( [] );
	}, [ filters ] );

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

	const bulkDelete = async () => {
		const ok = await confirm( {
			title: sprintf(
				/* translators: %d: count */ _n(
					'Delete %d submission?',
					'Delete %d submissions?',
					selected.length,
					'contact-sync'
				),
				selected.length
			),
			message: __(
				'Records already in Dynamics 365 are not affected.',
				'contact-sync'
			),
			danger: true,
			confirmLabel: __( 'Delete', 'contact-sync' ),
		} );
		if ( ! ok ) {
			return;
		}
		await Promise.all(
			selected.map( ( id ) => del( `/submissions/${ id }` ) )
		);
		toast( __( 'Submissions deleted', 'contact-sync' ) );
		setSelected( [] );
		reload( true );
	};

	const exportCsv = async () => {
		setExporting( true );
		try {
			const file = await get( '/submissions/export', filters );
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

	return (
		<>
			<PageHeader
				title={ __( 'Submissions', 'contact-sync' ) }
				description={ __(
					'Every lead submitted by reps, with its Dynamics 365 sync status.',
					'contact-sync'
				) }
				actions={
					<Button
						icon="download"
						onClick={ exportCsv }
						loading={ exporting }
					>
						{ __( 'Export CSV', 'contact-sync' ) }
					</Button>
				}
			/>
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
						<Button size="sm" icon="refresh" onClick={ bulkRetry }>
							{ __( 'Retry sync', 'contact-sync' ) }
						</Button>
						<Button
							size="sm"
							variant="danger-ghost"
							icon="trash"
							onClick={ bulkDelete }
						>
							{ __( 'Delete', 'contact-sync' ) }
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
							title={
								hasFilters
									? __(
											'No matching submissions',
											'contact-sync'
									  )
									: __( 'No submissions yet', 'contact-sync' )
							}
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
			/>
		</>
	);
}
