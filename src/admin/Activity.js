import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { formatDate, timeAgo } from '../shared/format';
import { useFetch } from '../shared/hooks';
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Input,
	PageHeader,
	Pagination,
	SearchInput,
	Select,
	Table,
} from '../shared/ui';
import { go } from './router';

const PER_PAGE = 25;

const TYPES = [
	{ value: '', label: __( 'Everything', 'contact-sync' ) },
	{ value: 'submission', label: __( 'Leads', 'contact-sync' ) },
	{ value: 'rep', label: __( 'Reps', 'contact-sync' ) },
	{ value: 'agency', label: __( 'Agencies', 'contact-sync' ) },
	{ value: 'form', label: __( 'Forms', 'contact-sync' ) },
	{ value: 'settings', label: __( 'Settings', 'contact-sync' ) },
	{ value: 'system', label: __( 'Automatic', 'contact-sync' ) },
];

const TONES = {
	deleted: 'danger',
	trashed: 'warning',
	emptied: 'danger',
	disabled: 'warning',
	rejected: 'warning',
	restored: 'success',
	enabled: 'success',
	approved: 'success',
	published: 'success',
};

/**
 * Readable label for an action name, e.g. submission_trashed → "Submission trashed".
 *
 * @param {string} action Action.
 * @return {string} Label.
 */
const actionLabel = ( action ) => {
	const text = action.replace( /_/g, ' ' );
	return text.charAt( 0 ).toUpperCase() + text.slice( 1 );
};

const actionTone = ( action ) =>
	TONES[ action.split( '_' ).pop() ] || 'neutral';

/**
 * Admin route for the object an entry is about, when it still has a page.
 *
 * @param {Object} entry Log entry.
 * @return {string|null} Route.
 */
const objectRoute = ( entry ) => {
	if ( ! entry.object_id || entry.action.endsWith( '_deleted' ) ) {
		return null;
	}
	switch ( entry.object_type ) {
		case 'submission':
			return `submissions?open=${ entry.object_id }`;
		case 'form':
			return `forms/${ entry.object_id }`;
		case 'agency':
			return 'agencies';
		case 'rep':
			return 'reps';
		default:
			return null;
	}
};

export default function Activity() {
	const [ filters, setFilters ] = useState( {
		object_type: '',
		search: '',
		date_from: '',
		date_to: '',
	} );
	const [ page, setPage ] = useState( 1 );
	const { data, loading } = useFetch( '/activity', {
		...filters,
		page,
		per_page: PER_PAGE,
	} );
	const set = ( key ) => ( value ) =>
		setFilters( ( f ) => ( { ...f, [ key ]: value } ) );

	useEffect( () => setPage( 1 ), [ filters ] );

	const hasFilters = Object.values( filters ).some( Boolean );

	return (
		<>
			<PageHeader
				title={ __( 'Activity log', 'contact-sync' ) }
				description={ __(
					'Who changed what in Contact Sync: deleted and restored leads, duplicate decisions, rep and agency changes, form updates and settings. Retention is set under Settings › Data & logs.',
					'contact-sync'
				) }
			/>
			<Card padded={ false }>
				<div className="cs-toolbar">
					<SearchInput
						value={ filters.search }
						onChange={ set( 'search' ) }
						placeholder={ __(
							'Search details or people…',
							'contact-sync'
						) }
					/>
					<Select
						value={ filters.object_type }
						onChange={ ( e ) =>
							set( 'object_type' )( e.target.value )
						}
						options={ TYPES }
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
									object_type: '',
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
				<Table
					rows={ data?.items }
					loading={ loading }
					onRowClick={ ( entry ) => {
						const route = objectRoute( entry );
						if ( route ) {
							go( route );
						}
					} }
					columns={ [
						{
							key: 'when',
							label: __( 'When', 'contact-sync' ),
							width: 170,
							render: ( entry ) => (
								<div className="cs-cell-primary__text">
									<strong className="cs-weight-normal">
										{ timeAgo( entry.created_at ) }
									</strong>
									<span>
										{ formatDate( entry.created_at ) }
									</span>
								</div>
							),
						},
						{
							key: 'who',
							label: __( 'Who', 'contact-sync' ),
							width: 180,
							render: ( entry ) =>
								entry.user ? (
									entry.user.name
								) : (
									<span className="cs-muted">
										{ __( 'System', 'contact-sync' ) }
									</span>
								),
						},
						{
							key: 'action',
							label: __( 'Action', 'contact-sync' ),
							width: 200,
							render: ( entry ) => (
								<Badge tone={ actionTone( entry.action ) }>
									{ actionLabel( entry.action ) }
								</Badge>
							),
						},
						{
							key: 'message',
							label: __( 'Details', 'contact-sync' ),
							render: ( entry ) => (
								<span
									className="cs-truncate"
									title={ entry.message }
								>
									{ entry.message }
								</span>
							),
						},
					] }
					empty={
						<EmptyState
							icon="list"
							title={
								hasFilters
									? __(
											'No matching activity',
											'contact-sync'
									  )
									: __( 'No activity yet', 'contact-sync' )
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
