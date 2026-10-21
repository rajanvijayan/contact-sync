import { __, sprintf } from '@wordpress/i18n';
import BarChart from '../../shared/BarChart';
import Icon from '../../shared/icons';
import { formatNumber, timeAgo } from '../../shared/format';
import {
	Alert,
	Card,
	EmptyState,
	PageHeader,
	Stat,
	StatusBadge,
	Table,
} from '../../shared/ui';
import { Link, navigate } from '../router';
import { usePortal } from './context';

function greeting() {
	const hour = new Date().getHours();
	if ( hour < 12 ) {
		return __( 'Good morning', 'contact-sync' );
	}
	if ( hour < 18 ) {
		return __( 'Good afternoon', 'contact-sync' );
	}
	return __( 'Good evening', 'contact-sync' );
}

export function leadName( item ) {
	return (
		item.summary?.name ||
		item.summary?.email ||
		sprintf(
			/* translators: %d: submission ID */ __(
				'Lead #%d',
				'contact-sync'
			),
			item.id
		)
	);
}

export default function Dashboard() {
	const { me } = usePortal();
	const { stats, recent, user, form } = me;
	const attention = stats.by_status.failed;

	const actions = [
		{
			to: 'app/new',
			icon: 'plus',
			title: __( 'Submit a lead', 'contact-sync' ),
			text: __(
				'Fill in the lead form for a single contact.',
				'contact-sync'
			),
		},
		{
			to: 'app/bulk',
			icon: 'upload',
			title: __( 'Bulk upload', 'contact-sync' ),
			text: __(
				'Import many leads at once from a CSV file.',
				'contact-sync'
			),
		},
		{
			to: 'app/template',
			icon: 'download',
			title: __( 'Get the CSV template', 'contact-sync' ),
			text: __(
				'Download a sample file with the right columns.',
				'contact-sync'
			),
		},
	];

	return (
		<>
			<PageHeader
				title={ `${ greeting() }, ${ user.first_name || user.name }` }
				description={
					user.agency
						? sprintf(
								/* translators: %s: agency name */
								__(
									'You are submitting leads on behalf of %s.',
									'contact-sync'
								),
								user.agency.name
						  )
						: __(
								'You are submitting leads as an independent rep.',
								'contact-sync'
						  )
				}
			/>

			{ ! form && (
				<Alert
					tone="warning"
					title={ __( 'No lead form yet', 'contact-sync' ) }
				>
					{ __(
						'Your administrator has not published a lead form. Check back soon.',
						'contact-sync'
					) }
				</Alert>
			) }

			<div className="cs-stat-grid cs-mb">
				<Stat
					label={ __( 'Total leads', 'contact-sync' ) }
					value={ formatNumber( stats.total ) }
					icon="inbox"
				/>
				<Stat
					label={ __( 'Last 7 days', 'contact-sync' ) }
					value={ formatNumber( stats.week ) }
					icon="calendar"
					tone="info"
				/>
				<Stat
					label={ __( 'Delivered to sales', 'contact-sync' ) }
					value={ formatNumber(
						stats.by_status.synced + stats.by_status.duplicate
					) }
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
							: undefined
					}
				/>
				<Stat
					label={ __( 'In progress', 'contact-sync' ) }
					value={ formatNumber(
						stats.by_status.queued + stats.by_status.syncing
					) }
					icon="clock"
					tone="warning"
					hint={
						attention
							? sprintf(
									/* translators: %d: count */ __(
										'%d need attention',
										'contact-sync'
									),
									attention
							  )
							: undefined
					}
				/>
			</div>

			<div className="cs-quick-actions cs-mb">
				{ actions.map( ( action ) => (
					<Link
						key={ action.to }
						to={ action.to }
						className="cs-quick-action"
					>
						<span className="cs-quick-action__icon">
							<Icon name={ action.icon } size={ 20 } />
						</span>
						<span className="cs-quick-action__text">
							<strong>{ action.title }</strong>
							<span>{ action.text }</span>
						</span>
						<Icon
							name="arrowRight"
							size={ 16 }
							className="cs-quick-action__arrow"
						/>
					</Link>
				) ) }
			</div>

			<div className="cs-grid-2">
				<Card
					title={ __( 'Leads submitted', 'contact-sync' ) }
					description={ __( 'Last 14 days', 'contact-sync' ) }
				>
					<BarChart
						data={ stats.series }
						label={ __( 'Leads submitted', 'contact-sync' ) }
					/>
				</Card>
				<Card
					title={ __( 'Recent submissions', 'contact-sync' ) }
					padded={ false }
					actions={
						<Link
							to="app/submissions"
							className="cs-btn cs-btn--ghost cs-btn--sm"
						>
							{ __( 'View all', 'contact-sync' ) }
						</Link>
					}
				>
					<Table
						rows={ recent }
						onRowClick={ () => navigate( 'app/submissions' ) }
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
								title={ __( 'No leads yet', 'contact-sync' ) }
								description={ __(
									'Your submitted leads will appear here.',
									'contact-sync'
								) }
								action={
									<Link
										to="app/new"
										className="cs-btn cs-btn--primary cs-btn--sm"
									>
										{ __(
											'Submit your first lead',
											'contact-sync'
										) }
									</Link>
								}
							/>
						}
					/>
				</Card>
			</div>
		</>
	);
}
