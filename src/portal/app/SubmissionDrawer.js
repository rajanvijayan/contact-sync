import { __ } from '@wordpress/i18n';
import Icon from '../../shared/icons';
import { displayValue, formatDate, isCrmConnected } from '../../shared/format';
import { Alert, Badge, CopyButton, Drawer, StatusBadge } from '../../shared/ui';
import { leadName } from './Dashboard';

export function SubmissionDetails( { item, admin = false } ) {
	const awaiting =
		! isCrmConnected() && [ 'queued', 'failed' ].includes( item.status );
	return (
		<>
			{ awaiting && (
				<div className="cs-mb">
					<Alert
						tone="info"
						title={ __( 'Awaiting connection', 'contact-sync' ) }
					>
						{ __(
							'This lead is saved and will be sent to Dynamics 365 automatically once the connection is set up.',
							'contact-sync'
						) }
					</Alert>
				</div>
			) }
			{ ! awaiting && item.status === 'failed' && item.last_error && (
				<div className="cs-mb">
					<Alert
						tone="danger"
						title={ __( 'Delivery failed', 'contact-sync' ) }
					>
						{ admin
							? item.last_error
							: __(
									'This lead could not be delivered automatically. The admin team has been notified and will follow up.',
									'contact-sync'
							  ) }
					</Alert>
				</div>
			) }
			{ item.status === 'duplicate' && (
				<div className="cs-mb">
					<Alert tone="warning">
						{ __(
							'An open lead with this email already existed in Dynamics 365, so no new record was created.',
							'contact-sync'
						) }
					</Alert>
				</div>
			) }
			<h3 className="cs-section-title">
				{ __( 'Lead details', 'contact-sync' ) }
			</h3>
			<dl className="cs-dl">
				{ Object.entries( item.labels ).map( ( [ key, label ] ) =>
					item.values[ key ] === undefined ? null : (
						<div className="cs-dl__row" key={ key }>
							<dt>{ label }</dt>
							<dd>
								{ item.display?.[ key ] ||
									displayValue( item.values[ key ] ) }
							</dd>
						</div>
					)
				) }
			</dl>
			<h3 className="cs-section-title">
				{ __( 'Submission', 'contact-sync' ) }
			</h3>
			<dl className="cs-dl">
				<div className="cs-dl__row">
					<dt>{ __( 'Submitted by', 'contact-sync' ) }</dt>
					<dd>
						{ item.rep.name }
						{ item.rep.email && (
							<span className="cs-muted">
								{ ' ' }
								· { item.rep.email }
							</span>
						) }
					</dd>
				</div>
				<div className="cs-dl__row">
					<dt>{ __( 'Agency', 'contact-sync' ) }</dt>
					<dd>
						{ item.agency
							? item.agency.name
							: __( 'Independent', 'contact-sync' ) }
					</dd>
				</div>
				<div className="cs-dl__row">
					<dt>{ __( 'Submitted', 'contact-sync' ) }</dt>
					<dd>{ formatDate( item.created_at ) }</dd>
				</div>
				<div className="cs-dl__row">
					<dt>{ __( 'Source', 'contact-sync' ) }</dt>
					<dd>
						{ item.source === 'import'
							? __( 'Bulk upload', 'contact-sync' )
							: __( 'Lead form', 'contact-sync' ) }
					</dd>
				</div>
				{ item.synced_at && (
					<div className="cs-dl__row">
						<dt>{ __( 'Delivered', 'contact-sync' ) }</dt>
						<dd>{ formatDate( item.synced_at ) }</dd>
					</div>
				) }
				{ item.crm_lead_id && (
					<div className="cs-dl__row">
						<dt>{ __( 'Dynamics lead ID', 'contact-sync' ) }</dt>
						<dd className="cs-dl__copy">
							<span className="cs-mono">
								{ item.crm_lead_id }
							</span>
							<CopyButton value={ item.crm_lead_id } />
						</dd>
					</div>
				) }
			</dl>
		</>
	);
}

export default function SubmissionDrawer( { item, onClose } ) {
	return (
		<Drawer
			open={ !! item }
			onClose={ onClose }
			title={ item ? leadName( item ) : '' }
			subtitle={
				item && (
					<>
						<StatusBadge status={ item.status } />
						{ item.summary?.company && (
							<Badge>
								<Icon name="building" size={ 12 } />{ ' ' }
								{ item.summary.company }
							</Badge>
						) }
						<span>#{ item.id }</span>
					</>
				)
			}
		>
			{ item && <SubmissionDetails item={ item } /> }
		</Drawer>
	);
}
