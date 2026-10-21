import { useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { downloadFile, get } from '../shared/api';
import BarChart from '../shared/BarChart';
import Icon from '../shared/icons';
import { formatNumber, isCrmConnected } from '../shared/format';
import { useFetch } from '../shared/hooks';
import {
	Button,
	Card,
	EmptyState,
	Input,
	Menu,
	PageHeader,
	Segmented,
	Select,
	Skeleton,
	Table,
	cx,
	useUI,
} from '../shared/ui';
import { go } from './router';

/* Dates ------------------------------------------------------------------ */

const pad = ( n ) => String( n ).padStart( 2, '0' );
const iso = ( d ) =>
	`${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad( d.getDate() ) }`;
const parse = ( value ) => new Date( `${ value }T00:00:00` );
const addDays = ( d, n ) =>
	new Date( d.getFullYear(), d.getMonth(), d.getDate() + n );
const daysBetween = ( from, to ) =>
	Math.round( ( parse( to ) - parse( from ) ) / 86400000 ) + 1;

const PRESETS = [
	{ value: '7d', label: __( 'Last 7 days', 'contact-sync' ) },
	{ value: '30d', label: __( 'Last 30 days', 'contact-sync' ) },
	{ value: '90d', label: __( 'Last 90 days', 'contact-sync' ) },
	{ value: 'month', label: __( 'This month', 'contact-sync' ) },
	{ value: 'last_month', label: __( 'Last month', 'contact-sync' ) },
	{ value: 'quarter', label: __( 'This quarter', 'contact-sync' ) },
	{ value: 'ytd', label: __( 'Year to date', 'contact-sync' ) },
	{ value: '12m', label: __( 'Last 12 months', 'contact-sync' ) },
	{ value: 'custom', label: __( 'Custom range', 'contact-sync' ) },
];

function presetRange( preset ) {
	const today = new Date();
	const y = today.getFullYear();
	const m = today.getMonth();
	const ranges = {
		'7d': [ addDays( today, -6 ), today ],
		'30d': [ addDays( today, -29 ), today ],
		'90d': [ addDays( today, -89 ), today ],
		month: [ new Date( y, m, 1 ), today ],
		last_month: [ new Date( y, m - 1, 1 ), new Date( y, m, 0 ) ],
		quarter: [ new Date( y, m - ( m % 3 ), 1 ), today ],
		ytd: [ new Date( y, 0, 1 ), today ],
		'12m': [ new Date( y, m - 11, 1 ), today ],
	};
	return ranges[ preset ] || ranges[ '30d' ];
}

const autoGroup = ( from, to ) => {
	const days = daysBetween( from, to );
	if ( days > 120 ) {
		return 'month';
	}
	return days > 31 ? 'week' : 'day';
};

function fmt( value, opts ) {
	return parse( value ).toLocaleDateString( undefined, opts );
}

function formatRange( from, to ) {
	const sameYear = from.slice( 0, 4 ) === to.slice( 0, 4 );
	const start = fmt( from, {
		month: 'short',
		day: 'numeric',
		...( sameYear ? {} : { year: 'numeric' } ),
	} );
	const end = fmt( to, { month: 'short', day: 'numeric', year: 'numeric' } );
	return from === to ? end : `${ start } – ${ end }`;
}

function periodLabel( point, group, long = false ) {
	if ( group === 'month' ) {
		return fmt( point.start, {
			month: long ? 'long' : 'short',
			year: long ? 'numeric' : '2-digit',
		} );
	}
	if ( group === 'week' ) {
		return long
			? formatRange( point.start, point.end )
			: fmt( point.start, { month: 'short', day: 'numeric' } );
	}
	return fmt(
		point.start,
		long
			? {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: 'numeric',
			  }
			: { month: 'short', day: 'numeric' }
	);
}

/* Small pieces ----------------------------------------------------------- */

const percent = ( value ) =>
	value === null || value === undefined
		? '—'
		: `${ Number( value ).toLocaleString( undefined, {
				maximumFractionDigits: 1,
		  } ) }%`;

/**
 * Change versus the previous period, as a pill with an arrow and words, so the
 * direction never relies on colour alone.
 *
 * @param {Object}  props
 * @param {number}  props.current  Current value.
 * @param {number}  props.previous Previous value.
 * @param {boolean} props.points   Compare as percentage points (for rates).
 * @param {boolean} props.compact  Hide the "vs previous" suffix.
 */
function Delta( { current, previous, points = false, compact = false } ) {
	if ( current === null || previous === null || previous === undefined ) {
		return <span className="cs-delta is-flat">—</span>;
	}
	if ( ! points && ! previous ) {
		return (
			<span className={ cx( 'cs-delta', current ? 'is-up' : 'is-flat' ) }>
				{ current
					? __( 'New', 'contact-sync' )
					: __( 'No change', 'contact-sync' ) }
			</span>
		);
	}
	const change = points
		? current - previous
		: ( ( current - previous ) / previous ) * 100;
	const rounded = Math.round( change * 10 ) / 10;
	const dir = rounded > 0 ? 'up' : 'down';
	if ( ! rounded ) {
		return (
			<span className="cs-delta is-flat">
				{ __( 'No change', 'contact-sync' ) }
			</span>
		);
	}
	const amount = Math.abs( rounded ).toLocaleString( undefined, {
		maximumFractionDigits: 1,
	} );
	return (
		<span className={ cx( 'cs-delta', `is-${ dir }` ) }>
			<Icon name={ dir === 'up' ? 'trendUp' : 'trendDown' } size={ 14 } />
			{ points
				? sprintf(
						/* translators: %s: percentage points */
						__( '%s pts', 'contact-sync' ),
						amount
				  )
				: `${ amount }%` }
			{ ! compact && (
				<span className="cs-delta__suffix">
					{ __( 'vs prev.', 'contact-sync' ) }
				</span>
			) }
		</span>
	);
}

function Kpi( { label, value, icon, sub, delta, loading } ) {
	return (
		<div className="cs-kpi">
			<div className="cs-kpi__top">
				<span className="cs-kpi__label">{ label }</span>
				<span className="cs-kpi__icon">
					<Icon name={ icon } size={ 16 } />
				</span>
			</div>
			<div className="cs-kpi__value">
				{ loading ? <Skeleton width={ 80 } height={ 34 } /> : value }
			</div>
			<div className="cs-kpi__foot">
				{ loading ? <Skeleton width={ 120 } /> : delta }
				{ ! loading && sub && (
					<span className="cs-kpi__sub">{ sub }</span>
				) }
			</div>
		</div>
	);
}

function Sparkline( { values, width = 96, height = 28 } ) {
	if ( values.length < 2 ) {
		return null;
	}
	const max = Math.max( 1, ...values );
	const step = width / ( values.length - 1 );
	const points = values.map( ( v, i ) => [
		i * step,
		height - 2 - ( v / max ) * ( height - 4 ),
	] );
	const line = points.map( ( [ x, y ] ) => `${ x },${ y }` ).join( ' ' );
	return (
		<svg
			className="cs-spark"
			width={ width }
			height={ height }
			viewBox={ `0 0 ${ width } ${ height }` }
			aria-hidden="true"
		>
			<polygon
				className="cs-spark__area"
				points={ `0,${ height } ${ line } ${ width },${ height }` }
			/>
			<polyline className="cs-spark__line" points={ line } />
		</svg>
	);
}

function ShareBar( { value } ) {
	return (
		<span className="cs-share">
			<span className="cs-share__track">
				<span style={ { width: `${ Math.min( 100, value ) }%` } } />
			</span>
			<span className="cs-share__value">{ percent( value ) }</span>
		</span>
	);
}

function SortLabel( { id, label, sort, onSort } ) {
	const active = sort.key === id;
	return (
		<button
			type="button"
			className={ cx( 'cs-sort', active && 'is-active' ) }
			onClick={ () =>
				onSort( {
					key: id,
					dir: active && sort.dir === 'desc' ? 'asc' : 'desc',
				} )
			}
		>
			{ label }
			<Icon
				name="chevronDown"
				size={ 14 }
				className={ cx(
					'cs-sort__icon',
					active && sort.dir === 'asc' && 'is-asc'
				) }
			/>
		</button>
	);
}

/* Sections --------------------------------------------------------------- */

function Mix( { totals } ) {
	const pendingLabel = isCrmConnected()
		? __( 'Pending', 'contact-sync' )
		: __( 'Awaiting connection', 'contact-sync' );
	const parts = [
		{
			key: 'delivered',
			label: __( 'Delivered to Dynamics', 'contact-sync' ),
			icon: 'checkCircle',
		},
		{
			key: 'duplicate',
			label: __( 'Already in Dynamics', 'contact-sync' ),
			icon: 'copy',
		},
		{ key: 'pending', label: pendingLabel, icon: 'clock' },
		{ key: 'failed', label: __( 'Failed', 'contact-sync' ), icon: 'alert' },
	];
	const total = totals.total || 0;
	return (
		<div className="cs-mix">
			<div
				className="cs-mix__bar"
				role="img"
				aria-label={ __( 'Lead outcome mix', 'contact-sync' ) }
			>
				{ total ? (
					parts
						.filter( ( p ) => totals[ p.key ] > 0 )
						.map( ( p ) => (
							<span
								key={ p.key }
								className={ `is-${ p.key }` }
								style={ {
									flexGrow: totals[ p.key ],
								} }
							/>
						) )
				) : (
					<span className="is-empty" />
				) }
			</div>
			<ul className="cs-mix__legend">
				{ parts.map( ( p ) => (
					<li key={ p.key } className={ `is-${ p.key }` }>
						<span className="cs-mix__swatch">
							<Icon name={ p.icon } size={ 14 } />
						</span>
						<span className="cs-mix__label">{ p.label }</span>
						<strong>{ formatNumber( totals[ p.key ] ) }</strong>
						<span className="cs-mix__pct">
							{ total
								? percent( ( totals[ p.key ] / total ) * 100 )
								: '—' }
						</span>
					</li>
				) ) }
			</ul>
		</div>
	);
}

function Leaderboard( { agencies } ) {
	const top = agencies.filter( ( a ) => a.total > 0 ).slice( 0, 6 );
	const max = Math.max( 1, ...top.map( ( a ) => a.total ) );
	if ( ! top.length ) {
		return (
			<EmptyState
				compact
				icon="building"
				title={ __( 'No agency leads yet', 'contact-sync' ) }
				description={ __(
					'Agencies appear here once their reps submit leads in this period.',
					'contact-sync'
				) }
			/>
		);
	}
	return (
		<ol className="cs-leaders">
			{ top.map( ( agency, index ) => (
				<li key={ agency.id || 'independent' }>
					<span className="cs-leaders__rank">{ index + 1 }</span>
					<div className="cs-leaders__body">
						<div className="cs-leaders__head">
							<span className="cs-leaders__name">
								{ agency.name }
							</span>
							<strong>{ formatNumber( agency.total ) }</strong>
						</div>
						<div className="cs-leaders__track">
							<span
								style={ {
									width: `${ ( agency.total / max ) * 100 }%`,
								} }
							/>
						</div>
						<div className="cs-leaders__meta">
							<span>
								{ sprintf(
									/* translators: %s: share percent */
									__( '%s of all leads', 'contact-sync' ),
									percent( agency.share )
								) }
							</span>
							<Delta
								current={ agency.total }
								previous={ agency.previous }
								compact
							/>
						</div>
					</div>
				</li>
			) ) }
		</ol>
	);
}

/* Page ------------------------------------------------------------------- */

export default function Reports() {
	const { toast } = useUI();
	const [ filters, setFilters ] = useState( () => {
		const [ from, to ] = presetRange( '30d' ).map( iso );
		return { preset: '30d', from, to, group: 'day', agency: '' };
	} );
	const [ sort, setSort ] = useState( { key: 'total', dir: 'desc' } );
	const [ exporting, setExporting ] = useState( null );
	const { data: agencyList } = useFetch( '/agencies' );
	const query = {
		from: filters.from,
		to: filters.to,
		group: filters.group,
		agency: filters.agency,
	};
	const { data: report, loading, error } = useFetch( '/reports', query );

	const choosePreset = ( preset ) => {
		if ( preset === 'custom' ) {
			setFilters( { ...filters, preset } );
			return;
		}
		const [ from, to ] = presetRange( preset ).map( iso );
		setFilters( {
			...filters,
			preset,
			from,
			to,
			group: autoGroup( from, to ),
		} );
	};
	const setDate = ( key ) => ( event ) => {
		const value = event.target.value;
		if ( ! value ) {
			return;
		}
		const next = { ...filters, preset: 'custom', [ key ]: value };
		next.group = autoGroup( next.from, next.to );
		setFilters( next );
	};

	const exportCsv = async ( type ) => {
		setExporting( type );
		try {
			const file = await get( '/reports/export', { ...query, type } );
			downloadFile( file.filename, file.content );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setExporting( null );
	};

	const group = report?.range.group || filters.group;
	const groupNoun = {
		day: __( 'day', 'contact-sync' ),
		week: __( 'week', 'contact-sync' ),
		month: __( 'month', 'contact-sync' ),
	}[ group ];

	const agencyRows = useMemo( () => {
		const rows = ( report?.agencies || [] ).map( ( a ) => ( {
			...a,
			key: a.id || 'independent',
			rate: a.total
				? ( ( a.delivered + a.duplicate ) / a.total ) * 100
				: null,
			change: a.previous
				? ( ( a.total - a.previous ) / a.previous ) * 100
				: null,
		} ) );
		const dir = sort.dir === 'asc' ? 1 : -1;
		return rows.sort( ( a, b ) => {
			const av = a[ sort.key ];
			const bv = b[ sort.key ];
			if ( typeof av === 'string' ) {
				return av.localeCompare( bv ) * dir;
			}
			return ( ( av ?? -Infinity ) - ( bv ?? -Infinity ) ) * dir;
		} );
	}, [ report, sort ] );

	const series = useMemo(
		() =>
			( report?.series || [] ).map( ( p ) => ( {
				...p,
				date: p.start,
			} ) ),
		[ report ]
	);

	const t = report?.totals;
	const p = report?.previous;
	const delivered = t ? t.delivered + t.duplicate : 0;
	const top = report?.agencies.find( ( a ) => a.id && a.total > 0 );

	const headline = t
		? sprintf(
				/* translators: 1: lead count, 2: date range */
				__( '%1$s leads between %2$s', 'contact-sync' ),
				formatNumber( t.total ),
				formatRange( report.range.from, report.range.to )
		  )
		: '';

	const agencyOptions = [
		{ value: '', label: __( 'All agencies', 'contact-sync' ) },
		...( agencyList || [] ).map( ( a ) => ( {
			value: String( a.id ),
			label: a.name,
		} ) ),
		{
			value: 'independent',
			label: __( 'Independent reps', 'contact-sync' ),
		},
	];

	const sortable = ( id, label ) => (
		<SortLabel id={ id } label={ label } sort={ sort } onSort={ setSort } />
	);

	return (
		<div className="cs-reports">
			<PageHeader
				title={ __( 'Reports', 'contact-sync' ) }
				description={ __(
					'Lead volume by agency and period, ready to share with the sales team.',
					'contact-sync'
				) }
				actions={
					<div className="cs-row cs-reports__actions">
						<Button icon="file" onClick={ () => window.print() }>
							{ __( 'Print / PDF', 'contact-sync' ) }
						</Button>
						<Menu
							trigger={ ( { toggle } ) => (
								<Button
									variant="primary"
									icon="download"
									iconRight="chevronDown"
									onClick={ toggle }
									loading={ !! exporting }
									disabled={ ! report }
								>
									{ __( 'Export CSV', 'contact-sync' ) }
								</Button>
							) }
							items={ [
								{
									label: __(
										'Leads by agency',
										'contact-sync'
									),
									icon: 'building',
									onClick: () => exportCsv( 'agencies' ),
								},
								{
									label: sprintf(
										/* translators: %s: day, week or month */
										__( 'Leads by %s', 'contact-sync' ),
										groupNoun
									),
									icon: 'calendar',
									onClick: () => exportCsv( 'periods' ),
								},
								{
									label: sprintf(
										/* translators: %s: day, week or month */
										__(
											'Agency × %s matrix',
											'contact-sync'
										),
										groupNoun
									),
									icon: 'table',
									onClick: () => exportCsv( 'matrix' ),
								},
							] }
						/>
					</div>
				}
			/>

			<div className="cs-reports__filters">
				<div className="cs-reports__filter">
					<span className="cs-reports__filter-label">
						{ __( 'Date range', 'contact-sync' ) }
					</span>
					<Select
						value={ filters.preset }
						options={ PRESETS }
						onChange={ ( e ) => choosePreset( e.target.value ) }
						aria-label={ __( 'Date range', 'contact-sync' ) }
					/>
				</div>
				<div className="cs-reports__filter">
					<span className="cs-reports__filter-label">
						{ __( 'From – to', 'contact-sync' ) }
					</span>
					<div className="cs-date-range">
						<Input
							type="date"
							value={ filters.from }
							max={ filters.to }
							onChange={ setDate( 'from' ) }
							aria-label={ __( 'From date', 'contact-sync' ) }
						/>
						<span className="cs-muted">–</span>
						<Input
							type="date"
							value={ filters.to }
							min={ filters.from }
							onChange={ setDate( 'to' ) }
							aria-label={ __( 'To date', 'contact-sync' ) }
						/>
					</div>
				</div>
				<div className="cs-reports__filter">
					<span className="cs-reports__filter-label">
						{ __( 'Group by', 'contact-sync' ) }
					</span>
					<Segmented
						value={ filters.group }
						onChange={ ( value ) =>
							setFilters( { ...filters, group: value } )
						}
						options={ [
							{
								value: 'day',
								label: __( 'Day', 'contact-sync' ),
							},
							{
								value: 'week',
								label: __( 'Week', 'contact-sync' ),
							},
							{
								value: 'month',
								label: __( 'Month', 'contact-sync' ),
							},
						] }
					/>
				</div>
				<div className="cs-reports__filter">
					<span className="cs-reports__filter-label">
						{ __( 'Agency', 'contact-sync' ) }
					</span>
					<Select
						value={ filters.agency }
						options={ agencyOptions }
						onChange={ ( e ) =>
							setFilters( { ...filters, agency: e.target.value } )
						}
						aria-label={ __( 'Agency', 'contact-sync' ) }
					/>
				</div>
				{ report && (
					<div className="cs-reports__filter cs-reports__compare">
						<span className="cs-reports__filter-label">
							{ __( 'Compared with', 'contact-sync' ) }
						</span>
						<span className="cs-reports__compare-value">
							<Icon name="calendar" size={ 14 } />
							{ formatRange(
								report.range.previous_from,
								report.range.previous_to
							) }
						</span>
					</div>
				) }
			</div>

			{ error && (
				<Card>
					<EmptyState
						icon="alert"
						title={ __(
							'Could not load the report',
							'contact-sync'
						) }
						description={ error.message }
					/>
				</Card>
			) }

			<div className="cs-kpis cs-mb">
				<Kpi
					label={ __( 'Leads', 'contact-sync' ) }
					icon="inbox"
					loading={ ! t }
					value={ t && formatNumber( t.total ) }
					delta={
						t && <Delta current={ t.total } previous={ p.total } />
					}
				/>
				<Kpi
					label={ __( 'Average per day', 'contact-sync' ) }
					icon="chart"
					loading={ ! t }
					value={
						t &&
						t.per_day.toLocaleString( undefined, {
							maximumFractionDigits: 1,
						} )
					}
					delta={
						t && (
							<Delta
								current={ t.per_day }
								previous={ p.per_day }
							/>
						)
					}
				/>
				<Kpi
					label={ __( 'Delivered to Dynamics', 'contact-sync' ) }
					icon="checkCircle"
					loading={ ! t }
					value={ t && percent( t.delivery_rate ) }
					sub={
						t &&
						sprintf(
							/* translators: %s: count */
							__( '%s leads', 'contact-sync' ),
							formatNumber( delivered )
						)
					}
					delta={
						t && (
							<Delta
								current={ t.delivery_rate }
								previous={ p.delivery_rate }
								points
							/>
						)
					}
				/>
				<Kpi
					label={ __( 'Agencies sending', 'contact-sync' ) }
					icon="building"
					loading={ ! t }
					value={
						t &&
						( t.agencies_all
							? sprintf(
									/* translators: 1: sending, 2: total active */
									__( '%1$d of %2$d', 'contact-sync' ),
									t.agencies,
									t.agencies_all
							  )
							: formatNumber( t.agencies ) )
					}
					delta={
						t && (
							<Delta
								current={ t.agencies }
								previous={ p.agencies }
							/>
						)
					}
				/>
				<Kpi
					label={ __( 'Active reps', 'contact-sync' ) }
					icon="users"
					loading={ ! t }
					value={ t && formatNumber( t.reps ) }
					delta={
						t && <Delta current={ t.reps } previous={ p.reps } />
					}
				/>
			</div>

			<div className="cs-grid-3-1 cs-mb">
				<Card
					className="cs-reports__trend"
					title={ __( 'Lead volume', 'contact-sync' ) }
					description={ headline }
					actions={
						report?.peak && (
							<span className="cs-reports__peak">
								<Icon name="zap" size={ 14 } />
								{ sprintf(
									/* translators: 1: period, 2: count */
									__(
										'Peak %1$s · %2$s leads',
										'contact-sync'
									),
									periodLabel( report.peak, group, true ),
									formatNumber( report.peak.total )
								) }
							</span>
						)
					}
				>
					{ report ? (
						<BarChart
							data={ series }
							height={ 260 }
							label={ __( 'Leads', 'contact-sync' ) }
							tick={ ( d ) => periodLabel( d, group ) }
							title={ ( d ) => periodLabel( d, group, true ) }
						/>
					) : (
						<Skeleton height={ 260 } />
					) }
				</Card>
				<Card
					title={ __( 'Outcome', 'contact-sync' ) }
					description={ __(
						'Where this period’s leads ended up.',
						'contact-sync'
					) }
				>
					{ t ? <Mix totals={ t } /> : <Skeleton height={ 180 } /> }
				</Card>
			</div>

			{ ! filters.agency && (
				<div className="cs-grid-3-1 cs-mb">
					<Card
						title={ __( 'Agency performance', 'contact-sync' ) }
						description={
							top &&
							sprintf(
								/* translators: 1: agency, 2: share */
								__(
									'Top agency: %1$s, with %2$s of all leads.',
									'contact-sync'
								),
								top.name,
								percent( top.share )
							)
						}
						padded={ false }
					>
						<Table
							rowKey="key"
							loading={ loading && ! report }
							rows={ agencyRows }
							onRowClick={ ( row ) =>
								go(
									`submissions?agency_id=${
										row.id || 'independent'
									}`
								)
							}
							columns={ [
								{
									key: 'name',
									label: sortable(
										'name',
										__( 'Agency', 'contact-sync' )
									),
									render: ( row ) => (
										<div className="cs-cell-primary__text">
											<strong>{ row.name }</strong>
											<span>
												{ sprintf(
													/* translators: %d: reps */
													__(
														'%d active reps',
														'contact-sync'
													),
													row.reps
												) }
											</span>
										</div>
									),
								},
								{
									key: 'total',
									label: sortable(
										'total',
										__( 'Leads', 'contact-sync' )
									),
									align: 'right',
									render: ( row ) => (
										<strong className="cs-num">
											{ formatNumber( row.total ) }
										</strong>
									),
								},
								{
									key: 'share',
									label: sortable(
										'share',
										__( 'Share', 'contact-sync' )
									),
									render: ( row ) => (
										<ShareBar value={ row.share } />
									),
								},
								{
									key: 'trend',
									label: sprintf(
										/* translators: %s: day, week or month */
										__( 'Trend by %s', 'contact-sync' ),
										groupNoun
									),
									render: ( row ) => (
										<Sparkline values={ row.series } />
									),
								},
								{
									key: 'change',
									label: sortable(
										'change',
										__( 'vs prev.', 'contact-sync' )
									),
									render: ( row ) => (
										<Delta
											current={ row.total }
											previous={ row.previous }
											compact
										/>
									),
								},
								{
									key: 'rate',
									label: sortable(
										'rate',
										__( 'Delivered', 'contact-sync' )
									),
									align: 'right',
									render: ( row ) => (
										<span className="cs-num">
											{ percent( row.rate ) }
										</span>
									),
								},
							] }
							empty={
								<EmptyState
									compact
									icon="building"
									title={ __(
										'No agencies yet',
										'contact-sync'
									) }
								/>
							}
						/>
					</Card>
					<Card
						title={ __( 'Top agencies', 'contact-sync' ) }
						description={ __(
							'Ranked by leads this period.',
							'contact-sync'
						) }
					>
						{ report ? (
							<Leaderboard agencies={ report.agencies } />
						) : (
							<Skeleton height={ 220 } />
						) }
					</Card>
				</div>
			) }

			<Card
				title={ sprintf(
					/* translators: %s: day, week or month */
					__( 'Leads by %s', 'contact-sync' ),
					groupNoun
				) }
				description={ __( 'Most recent first.', 'contact-sync' ) }
				className="cs-reports__periods"
				padded={ false }
			>
				<Table
					rowKey="start"
					loading={ loading && ! report }
					rows={ [ ...series ].reverse() }
					columns={ [
						{
							key: 'period',
							label: __( 'Period', 'contact-sync' ),
							render: ( row ) => (
								<span className="cs-nowrap">
									{ periodLabel( row, group, true ) }
								</span>
							),
						},
						{
							key: 'total',
							label: __( 'Leads', 'contact-sync' ),
							align: 'right',
							render: ( row ) => (
								<strong
									className={ cx(
										'cs-num',
										! row.total && 'cs-muted'
									) }
								>
									{ formatNumber( row.total ) }
								</strong>
							),
						},
						{
							key: 'bar',
							label: '',
							width: '30%',
							render: ( row ) => (
								<span className="cs-share__track cs-share__track--wide">
									<span
										style={ {
											width: `${
												report?.peak
													? ( row.total /
															report.peak
																.total ) *
													  100
													: 0
											}%`,
										} }
									/>
								</span>
							),
						},
						{
							key: 'delivered',
							label: __( 'Delivered', 'contact-sync' ),
							align: 'right',
							render: ( row ) => (
								<span className="cs-num">
									{ formatNumber(
										row.delivered + row.duplicate
									) }
								</span>
							),
						},
						{
							key: 'pending',
							label: isCrmConnected()
								? __( 'Pending', 'contact-sync' )
								: __( 'Awaiting', 'contact-sync' ),
							align: 'right',
							render: ( row ) => (
								<span className="cs-num cs-muted">
									{ formatNumber( row.pending ) }
								</span>
							),
						},
						{
							key: 'failed',
							label: __( 'Failed', 'contact-sync' ),
							align: 'right',
							render: ( row ) => (
								<span
									className={ cx(
										'cs-num',
										row.failed
											? 'cs-text-danger'
											: 'cs-muted'
									) }
								>
									{ formatNumber( row.failed ) }
								</span>
							),
						},
					] }
				/>
			</Card>
			{ report && (
				<p className="cs-reports__note">
					{ sprintf(
						/* translators: %s: timezone */
						__(
							'Dates use the site timezone (%s). Delivered includes leads that already existed in Dynamics.',
							'contact-sync'
						),
						report.range.timezone
					) }
				</p>
			) }
		</div>
	);
}
