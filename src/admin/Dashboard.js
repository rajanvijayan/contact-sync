import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { post } from '../shared/api';
import BarChart, { RankList } from '../shared/BarChart';
import Icon from '../shared/icons';
import { formatNumber, timeAgo } from '../shared/format';
import { useFetch } from '../shared/hooks';
import {
	Alert,
	Button,
	Card,
	EmptyState,
	PageHeader,
	Skeleton,
	Stat,
	StatusBadge,
	Table,
	cx,
	useUI,
} from '../shared/ui';
import { go } from './router';

export const leadName = ( item ) =>
	item.summary?.name ||
	item.summary?.email ||
	sprintf(
		/* translators: %d: ID */ __( 'Lead #%d', 'contact-sync' ),
		item.id
	);

function Checklist( { stats } ) {
	const items = [
		{
			done: stats.configured,
			label: __( 'Connect Dynamics 365', 'contact-sync' ),
			text: __(
				'Add your Azure app credentials and test the connection.',
				'contact-sync'
			),
			to: 'settings',
		},
		{
			done: stats.counts.agencies > 0,
			label: __( 'Add your first agency', 'contact-sync' ),
			text: __(
				'Agencies and their email domains control who can sign up.',
				'contact-sync'
			),
			to: 'agencies',
		},
		{
			done: stats.counts.reps > 0,
			label: __( 'Invite a rep', 'contact-sync' ),
			text: __(
				'Reps on agency domains can sign up themselves; invite independent reps here.',
				'contact-sync'
			),
			to: 'reps',
		},
		{
			done: stats.total > 0,
			label: __( 'Receive your first lead', 'contact-sync' ),
			text: __(
				'Customise the lead form, then submit a test lead from the portal.',
				'contact-sync'
			),
			to: 'forms',
		},
	];
	const remaining = items.filter( ( item ) => ! item.done ).length;
	if ( ! remaining ) {
		return null;
	}
	return (
		<Card
			className="cs-mb"
			icon="sparkle"
			title={ __( 'Finish setting up', 'contact-sync' ) }
			description={ sprintf(
				/* translators: 1: done, 2: total */ __(
					'%1$d of %2$d steps complete',
					'contact-sync'
				),
				items.length - remaining,
				items.length
			) }
		>
			<ol className="cs-checklist">
				{ items.map( ( item ) => (
					<li
						key={ item.label }
						className={ cx(
							'cs-checklist__item',
							item.done && 'is-done'
						) }
					>
						<span className="cs-checklist__mark">
							{ item.done && <Icon name="check" size={ 14 } /> }
						</span>
						<div className="cs-grow">
							<strong>{ item.label }</strong>
							<span>{ item.text }</span>
						</div>
						{ ! item.done && (
							<Button
								size="sm"
								iconRight="arrowRight"
								onClick={ () => go( item.to ) }
							>
								{ __( 'Start', 'contact-sync' ) }
							</Button>
						) }
					</li>
				) ) }
			</ol>
		</Card>
	);
}

export default function Dashboard() {
	const { data: stats, loading, reload } = useFetch( '/stats' );
	const { toast } = useUI();
	const [ retrying, setRetrying ] = useState( false );

	const retryFailed = async () => {
		setRetrying( true );
		try {
			const res = await post( '/submissions/retry', {
				status: 'failed',
			} );
			toast(
				sprintf(
					/* translators: %d: count */ __(
						'%d leads re-queued',
						'contact-sync'
					),
					res.queued
				)
			);
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setRetrying( false );
	};

	if ( loading && ! stats ) {
		return (
			<>
				<PageHeader title={ __( 'Dashboard', 'contact-sync' ) } />
				<div className="cs-stat-grid">
					{ [ 1, 2, 3, 4 ].map( ( i ) => (
						<Stat
							key={ i }
							label={ <Skeleton width={ 90 } /> }
							loading
						/>
					) ) }
				</div>
			</>
		);
	}
	if ( ! stats ) {
		return null;
	}

	const s = stats.by_status;

	return (
		<>
			<PageHeader
				title={ __( 'Dashboard', 'contact-sync' ) }
				description={ __(
					'Lead flow from your reps into Dynamics 365.',
					'contact-sync'
				) }
				actions={
					<Button icon="refresh" onClick={ () => reload() }>
						{ __( 'Refresh', 'contact-sync' ) }
					</Button>
				}
			/>

			<Checklist stats={ stats } />

			{ stats.configured && ! stats.sync_enabled && (
				<div className="cs-mb">
					<Alert
						tone="warning"
						title={ __( 'Sync is paused', 'contact-sync' ) }
						action={
							<Button
								size="sm"
								onClick={ () => go( 'settings' ) }
							>
								{ __( 'Open settings', 'contact-sync' ) }
							</Button>
						}
					>
						{ __(
							'New leads are stored but not sent to Dynamics 365 until you resume sync.',
							'contact-sync'
						) }
					</Alert>
				</div>
			) }
			{ s.failed > 0 && (
				<div className="cs-mb">
					<Alert
						tone="danger"
						title={ sprintf(
							/* translators: %d: count */ __(
								'%d leads failed to sync',
								'contact-sync'
							),
							s.failed
						) }
						action={
							<div className="cs-row">
								<Button
									size="sm"
									onClick={ () =>
										go( 'submissions?status=failed' )
									}
								>
									{ __( 'Review', 'contact-sync' ) }
								</Button>
								<Button
									size="sm"
									variant="primary"
									icon="refresh"
									loading={ retrying }
									onClick={ retryFailed }
								>
									{ __( 'Retry all', 'contact-sync' ) }
								</Button>
							</div>
						}
					>
						{ __(
							'Check the error on each lead, fix the cause (for example a field mapping), then retry.',
							'contact-sync'
						) }
					</Alert>
				</div>
			) }

			<div className="cs-stat-grid cs-mb">
				<Stat
					label={ __( 'Leads today', 'contact-sync' ) }
					value={ formatNumber( stats.today ) }
					icon="inbox"
					hint={ sprintf(
						/* translators: %s: count */ __(
							'%s in the last 7 days',
							'contact-sync'
						),
						formatNumber( stats.week )
					) }
				/>
				<Stat
					label={ __( 'Delivered to Dynamics', 'contact-sync' ) }
					value={ formatNumber( s.synced ) }
					icon="checkCircle"
					tone="success"
					hint={
						stats.success_rate !== null
							? sprintf(
									/* translators: %s: percent */ __(
										'%s%% success rate',
										'contact-sync'
									),
									stats.success_rate
							  )
							: __( 'No results yet', 'contact-sync' )
					}
				/>
				<Stat
					label={ __( 'Waiting', 'contact-sync' ) }
					value={ formatNumber( s.queued + s.syncing ) }
					icon="clock"
					tone="warning"
					hint={ sprintf(
						/* translators: %d: count */ __(
							'%d duplicates skipped',
							'contact-sync'
						),
						s.duplicate
					) }
				/>
				<Stat
					label={ __( 'Active network', 'contact-sync' ) }
					value={ formatNumber( stats.counts.reps ) }
					icon="users"
					tone="info"
					hint={ sprintf(
						/* translators: %d: count */ __(
							'reps across %d agencies',
							'contact-sync'
						),
						stats.counts.agencies
					) }
				/>
			</div>

			<div className="cs-grid-3-1 cs-mb">
				<Card
					title={ __( 'Leads per day', 'contact-sync' ) }
					description={ __( 'Last 30 days', 'contact-sync' ) }
				>
					<BarChart
						data={ stats.series }
						label={ __( 'Leads per day', 'contact-sync' ) }
						height={ 300 }
					/>
				</Card>
				<Card
					title={ __( 'Top agencies', 'contact-sync' ) }
					description={ __( 'Last 30 days', 'contact-sync' ) }
				>
					{ stats.top_agencies.length ? (
						<RankList items={ stats.top_agencies } />
					) : (
						<EmptyState
							compact
							title={ __( 'No data yet', 'contact-sync' ) }
						/>
					) }
					{ stats.top_reps.length > 0 && (
						<>
							<h3 className="cs-section-title cs-mt">
								{ __( 'Top reps', 'contact-sync' ) }
							</h3>
							<RankList items={ stats.top_reps } />
						</>
					) }
				</Card>
			</div>

			<Card
				title={ __( 'Latest submissions', 'contact-sync' ) }
				padded={ false }
				actions={
					<Button
						size="sm"
						variant="ghost"
						onClick={ () => go( 'submissions' ) }
					>
						{ __( 'View all', 'contact-sync' ) }
					</Button>
				}
			>
				<Table
					rows={ stats.recent }
					onRowClick={ ( item ) =>
						go( `submissions?open=${ item.id }` )
					}
					columns={ [
						{
							key: 'lead',
							label: __( 'Lead', 'contact-sync' ),
							render: ( item ) => (
								<div className="cs-cell-primary__text">
									<strong>{ leadName( item ) }</strong>
									<span>
										{ item.summary?.company ||
											item.summary?.email }
									</span>
								</div>
							),
						},
						{
							key: 'rep',
							label: __( 'Rep', 'contact-sync' ),
							render: ( item ) => item.rep.name,
						},
						{
							key: 'agency',
							label: __( 'Agency', 'contact-sync' ),
							render: ( item ) =>
								item.agency?.name || (
									<span className="cs-muted">
										{ __( 'Independent', 'contact-sync' ) }
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
								<span className="cs-muted">
									{ timeAgo( item.created_at ) }
								</span>
							),
						},
					] }
					empty={
						<EmptyState
							compact
							title={ __( 'No submissions yet', 'contact-sync' ) }
							description={ __(
								'Leads submitted through the portal will appear here.',
								'contact-sync'
							) }
						/>
					}
				/>
			</Card>
		</>
	);
}
