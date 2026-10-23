import { useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import Papa from 'papaparse';
import { downloadFile, get, post } from '../../shared/api';
import { applyMapping, autoMap, toCsv } from '../../shared/csv';
import { isInputField } from '../../shared/FormRenderer';
import Icon from '../../shared/icons';
import { formatDate } from '../../shared/format';
import { useFetch, useInterval } from '../../shared/hooks';
import {
	Alert,
	Badge,
	Button,
	Card,
	EmptyState,
	PageHeader,
	Progress,
	Segmented,
	Select,
	Steps,
	Table,
	cx,
} from '../../shared/ui';
import config from '../config';
import { Link, navigate } from '../router';
import { usePortal } from './context';

const STEPS = [
	__( 'Upload file', 'contact-sync' ),
	__( 'Map columns', 'contact-sync' ),
	__( 'Review', 'contact-sync' ),
	__( 'Import', 'contact-sync' ),
];
const PREVIEW_LIMIT = 200;
const POLL_MS = 3000;
// Stop polling delivery progress after five minutes; sync carries on in the background.
const POLL_LIMIT = 100;

function Dropzone( { onFile, error } ) {
	const input = useRef();
	const [ over, setOver ] = useState( false );
	const limits = config.limits || {};
	return (
		<div
			className={ cx( 'cs-dropzone', over && 'is-over' ) }
			onDragOver={ ( e ) => {
				e.preventDefault();
				setOver( true );
			} }
			onDragLeave={ () => setOver( false ) }
			onDrop={ ( e ) => {
				e.preventDefault();
				setOver( false );
				if ( e.dataTransfer.files[ 0 ] ) {
					onFile( e.dataTransfer.files[ 0 ] );
				}
			} }
		>
			<span className="cs-dropzone__icon">
				<Icon name="upload" size={ 24 } />
			</span>
			<p className="cs-dropzone__title">
				<button
					type="button"
					className="cs-dropzone__browse"
					onClick={ () => input.current.click() }
				>
					{ __( 'Click to upload', 'contact-sync' ) }
				</button>{ ' ' }
				{ __( 'or drag and drop', 'contact-sync' ) }
			</p>
			<p className="cs-dropzone__hint">
				{ sprintf(
					/* translators: 1: max rows, 2: max size in KB */
					__(
						'CSV file, up to %1$s rows and %2$s KB',
						'contact-sync'
					),
					limits.maxRows,
					limits.maxKb
				) }
			</p>
			<input
				ref={ input }
				type="file"
				accept=".csv,text/csv"
				hidden
				onChange={ ( e ) => {
					if ( e.target.files[ 0 ] ) {
						onFile( e.target.files[ 0 ] );
					}
					e.target.value = '';
				} }
			/>
			{ error && (
				<div className="cs-dropzone__error">
					<Alert tone="danger">{ error }</Alert>
				</div>
			) }
		</div>
	);
}

function RecentImports() {
	const { data, loading } = useFetch( '/portal/imports' );
	if ( loading || ! data?.length ) {
		return null;
	}
	return (
		<Card
			title={ __( 'Recent imports', 'contact-sync' ) }
			padded={ false }
			className="cs-mt"
		>
			<Table
				rows={ data }
				onRowClick={ ( batch ) =>
					navigate( `app/submissions?batch=${ batch.id }` )
				}
				columns={ [
					{
						key: 'file',
						label: __( 'File', 'contact-sync' ),
						render: ( b ) => (
							<div className="cs-cell-primary">
								<Icon name="file" size={ 18 } />
								<div className="cs-cell-primary__text">
									<strong>
										{ b.filename ||
											__( 'Upload', 'contact-sync' ) }
									</strong>
									<span>{ formatDate( b.created_at ) }</span>
								</div>
							</div>
						),
					},
					{
						key: 'total',
						label: __( 'Rows', 'contact-sync' ),
						render: ( b ) => b.total,
					},
					{
						key: 'synced',
						label: __( 'Delivered', 'contact-sync' ),
						render: ( b ) => b.counts.synced + b.counts.duplicate,
					},
					{
						key: 'failed',
						label: __( 'Failed', 'contact-sync' ),
						render: ( b ) =>
							b.counts.failed ? (
								<Badge tone="danger">{ b.counts.failed }</Badge>
							) : (
								0
							),
					},
					{
						key: 'status',
						label: __( 'Status', 'contact-sync' ),
						render: ( b ) => {
							if ( b.complete ) {
								return (
									<Badge tone="success" dot>
										{ __( 'Complete', 'contact-sync' ) }
									</Badge>
								);
							}
							if ( b.held ) {
								return (
									<Badge tone="warning" dot>
										{ __(
											'Awaiting connection',
											'contact-sync'
										) }
									</Badge>
								);
							}
							return (
								<Badge tone="info" dot className="is-pulsing">
									{ __( 'Processing', 'contact-sync' ) }
								</Badge>
							);
						},
					},
				] }
			/>
		</Card>
	);
}

function ImportProgress( { result, onReset } ) {
	const [ batch, setBatch ] = useState( result.batch );
	const [ polls, setPolls ] = useState( 0 );
	const timedOut = polls >= POLL_LIMIT;
	const delivering = ! batch.complete && ! batch.held && ! timedOut;
	useInterval(
		() => {
			setPolls( ( n ) => n + 1 );
			get( `/portal/imports/${ batch.id }` )
				.then( setBatch )
				.catch( () => {} );
		},
		POLL_MS,
		delivering
	);
	const c = batch.counts;
	const done = c.synced + c.failed + c.duplicate;

	return (
		<Card>
			<div className="cs-import-done">
				<span className="cs-submitted__icon">
					<Icon name="check" size={ 28 } />
				</span>
				<h2>{ __( 'Import complete', 'contact-sync' ) }</h2>
				<p className="cs-muted">
					{ sprintf(
						/* translators: %d: number of leads */
						_n(
							'%d lead was added to your submissions.',
							'%d leads were added to your submissions.',
							result.imported,
							'contact-sync'
						),
						result.imported
					) }
				</p>
				<div className="cs-import-done__progress">
					<Progress
						value={ done }
						max={ batch.total }
						tone={ batch.complete ? 'success' : 'brand' }
					/>
					<span className="cs-muted">
						{ sprintf(
							/* translators: 1: processed, 2: total */
							__( '%1$d of %2$d processed', 'contact-sync' ),
							done,
							batch.total
						) }
					</span>
				</div>
				{ batch.held && (
					<Alert tone="info">
						{ __(
							'Your leads are saved. They will be delivered to Dynamics 365 automatically once your administrator connects or resumes the CRM sync.',
							'contact-sync'
						) }
					</Alert>
				) }
				{ timedOut && ! batch.complete && ! batch.held && (
					<Alert tone="info">
						{ __(
							'Delivery is continuing in the background. You can track each lead on the Submissions page.',
							'contact-sync'
						) }
					</Alert>
				) }
				<div className="cs-import-stats">
					<div>
						<strong>{ c.synced }</strong>
						<span>{ __( 'Delivered', 'contact-sync' ) }</span>
					</div>
					<div>
						<strong>{ c.duplicate }</strong>
						<span>{ __( 'Duplicates', 'contact-sync' ) }</span>
					</div>
					<div>
						<strong>{ c.queued + c.syncing }</strong>
						<span>{ __( 'Pending', 'contact-sync' ) }</span>
					</div>
					<div className={ c.failed ? 'is-danger' : '' }>
						<strong>{ c.failed }</strong>
						<span>{ __( 'Failed', 'contact-sync' ) }</span>
					</div>
				</div>
				{ result.rejected.length > 0 && (
					<Alert tone="warning">
						{ sprintf(
							/* translators: %d: rows */
							_n(
								'%d row was rejected by the server and not imported.',
								'%d rows were rejected by the server and not imported.',
								result.rejected.length,
								'contact-sync'
							),
							result.rejected.length
						) }
					</Alert>
				) }
				<div className="cs-row cs-row--center">
					<Button variant="primary" icon="upload" onClick={ onReset }>
						{ __( 'Upload another file', 'contact-sync' ) }
					</Button>
					<Link
						to={ `app/submissions?batch=${ batch.id }` }
						className="cs-btn cs-btn--secondary cs-btn--md"
					>
						{ __( 'View these leads', 'contact-sync' ) }
					</Link>
				</div>
			</div>
		</Card>
	);
}

export default function BulkUpload() {
	const { me, reload } = usePortal();
	const form = me.form;
	const fields = useMemo(
		() =>
			form
				? form.schema.fields.filter(
						( f ) => isInputField( f ) && f.type !== 'hidden'
				  )
				: [],
		[ form ]
	);

	const [ step, setStep ] = useState( 0 );
	const [ file, setFile ] = useState( null );
	const [ fileError, setFileError ] = useState( '' );
	const [ headers, setHeaders ] = useState( [] );
	const [ rows, setRows ] = useState( [] );
	const [ mapping, setMapping ] = useState( {} );
	const [ report, setReport ] = useState( null );
	const [ filter, setFilter ] = useState( 'all' );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ result, setResult ] = useState( null );

	if ( ! form ) {
		return (
			<Card>
				<EmptyState
					icon="form"
					title={ __( 'No lead form available', 'contact-sync' ) }
					description={ __(
						'Your administrator has not published a lead form yet.',
						'contact-sync'
					) }
				/>
			</Card>
		);
	}

	const reset = () => {
		setStep( 0 );
		setFile( null );
		setHeaders( [] );
		setRows( [] );
		setReport( null );
		setResult( null );
		setError( null );
	};

	const onFile = ( selected ) => {
		setFileError( '' );
		const limits = config.limits || {};
		if ( ! /\.csv$/i.test( selected.name ) ) {
			setFileError(
				__(
					'Please choose a .csv file. In Excel use File › Save As › CSV UTF-8.',
					'contact-sync'
				)
			);
			return;
		}
		if ( selected.size > limits.maxKb * 1024 ) {
			setFileError(
				sprintf(
					/* translators: %s: KB */
					__(
						'The file is larger than %s KB. Split it into smaller files.',
						'contact-sync'
					),
					limits.maxKb
				)
			);
			return;
		}
		Papa.parse( selected, {
			skipEmptyLines: 'greedy',
			complete: ( parsed ) => {
				const [ head = [], ...data ] = parsed.data;
				if ( ! head.length || ! data.length ) {
					setFileError(
						__(
							'The file needs a header row and at least one data row.',
							'contact-sync'
						)
					);
					return;
				}
				if ( data.length > limits.maxRows ) {
					setFileError(
						sprintf(
							/* translators: 1: rows in file, 2: limit */
							__(
								'The file has %1$d rows; the limit is %2$d. Split it and try again.',
								'contact-sync'
							),
							data.length,
							limits.maxRows
						)
					);
					return;
				}
				const cleanHead = head.map( ( h ) =>
					String( h )
						.replace( /^\uFEFF/, '' )
						.trim()
				);
				setFile( selected );
				setHeaders( cleanHead );
				setRows( data );
				setMapping( autoMap( cleanHead, fields ) );
				setStep( 1 );
			},
			error: () =>
				setFileError(
					__( 'The file could not be read.', 'contact-sync' )
				),
		} );
	};

	const mapped = () => applyMapping( rows, mapping );

	const review = async () => {
		setBusy( true );
		setError( null );
		try {
			const res = await post( '/portal/imports/validate', {
				rows: mapped(),
			} );
			setReport( res.rows );
			setFilter(
				res.rows.some( ( r ) => Object.keys( r.errors ).length )
					? 'errors'
					: 'all'
			);
			setStep( 2 );
		} catch ( err ) {
			setError( err );
		}
		setBusy( false );
	};

	const runImport = async () => {
		setBusy( true );
		setError( null );
		const data = mapped();
		const valid = report
			.filter( ( r ) => ! Object.keys( r.errors ).length )
			.map( ( r ) => data[ r.index ] );
		try {
			const res = await post( '/portal/imports', {
				rows: valid,
				filename: file.name,
			} );
			setResult( res );
			setStep( 3 );
			reload();
		} catch ( err ) {
			setError( err );
		}
		setBusy( false );
	};

	const downloadErrors = () => {
		const invalid = report.filter(
			( r ) => Object.keys( r.errors ).length
		);
		const labels = Object.fromEntries(
			fields.map( ( f ) => [ f.key, f.label || f.key ] )
		);
		downloadFile(
			`errors-${ file.name }`,
			toCsv(
				[
					__( 'Row', 'contact-sync' ),
					...headers,
					__( 'Errors', 'contact-sync' ),
				],
				invalid.map( ( r ) => [
					r.index + 2,
					...rows[ r.index ],
					Object.entries( r.errors )
						.map(
							( [ key, msg ] ) =>
								`${ labels[ key ] || key }: ${ msg }`
						)
						.join( ' | ' ),
				] )
			)
		);
	};

	const unmappedRequired = fields.filter(
		( f ) =>
			f.required &&
			! f.conditions?.enabled &&
			( mapping[ f.key ] ?? -1 ) < 0
	);
	const invalidCount = report
		? report.filter( ( r ) => Object.keys( r.errors ).length ).length
		: 0;
	const validCount = report ? report.length - invalidCount : 0;
	const data = report ? mapped() : [];
	const previewRows = report
		? report
				.filter(
					( r ) => filter === 'all' || Object.keys( r.errors ).length
				)
				.slice( 0, PREVIEW_LIMIT )
		: [];
	const previewFields = fields
		.filter( ( f ) => ( mapping[ f.key ] ?? -1 ) >= 0 )
		.slice( 0, 5 );

	return (
		<>
			<PageHeader
				title={ __( 'Bulk upload', 'contact-sync' ) }
				description={ __(
					'Import many leads at once from a CSV file. Every row is checked before anything is sent.',
					'contact-sync'
				) }
				actions={
					<Link
						to="app/template"
						className="cs-btn cs-btn--secondary cs-btn--md"
					>
						<Icon name="download" size={ 16 } />
						<span>{ __( 'CSV template', 'contact-sync' ) }</span>
					</Link>
				}
			/>
			<Steps steps={ STEPS } current={ step } />
			{ error && (
				<div className="cs-mb">
					<Alert tone="danger">{ error.message }</Alert>
				</div>
			) }

			{ step === 0 && (
				<>
					<Card>
						<Dropzone onFile={ onFile } error={ fileError } />
						<div className="cs-upload-tips">
							<div>
								<Icon name="file" size={ 16 } />
								<span>
									{ __( 'Start from the', 'contact-sync' ) }{ ' ' }
									<Link to="app/template">
										{ __( 'CSV template', 'contact-sync' ) }
									</Link>{ ' ' }
									{ __(
										'so your columns match the lead form.',
										'contact-sync'
									) }
								</span>
							</div>
							<div>
								<Icon name="columns" size={ 16 } />
								<span>
									{ __(
										'Different column names? You can match them to fields in the next step.',
										'contact-sync'
									) }
								</span>
							</div>
							<div>
								<Icon name="shield" size={ 16 } />
								<span>
									{ __(
										'Nothing is sent until you review and confirm.',
										'contact-sync'
									) }
								</span>
							</div>
						</div>
					</Card>
					<RecentImports />
				</>
			) }

			{ step === 1 && (
				<Card
					title={ __( 'Match your columns', 'contact-sync' ) }
					description={ sprintf(
						/* translators: 1: file name, 2: rows */
						_n(
							'%1$s · %2$d row',
							'%1$s · %2$d rows',
							rows.length,
							'contact-sync'
						),
						file.name,
						rows.length
					) }
					padded={ false }
					footer={
						<>
							<Button onClick={ reset }>
								{ __( 'Choose another file', 'contact-sync' ) }
							</Button>
							<Button
								variant="primary"
								iconRight="arrowRight"
								onClick={ review }
								loading={ busy }
							>
								{ __( 'Review rows', 'contact-sync' ) }
							</Button>
						</>
					}
				>
					{ unmappedRequired.length > 0 && (
						<div className="cs-card-inset">
							<Alert tone="warning">
								{ sprintf(
									/* translators: %s: field labels */
									__(
										'Required fields without a column: %s. Rows will fail validation unless you map them.',
										'contact-sync'
									),
									unmappedRequired
										.map( ( f ) => f.label )
										.join( ', ' )
								) }
							</Alert>
						</div>
					) }
					<Table
						rowKey="key"
						rows={ fields }
						columns={ [
							{
								key: 'field',
								label: __( 'Form field', 'contact-sync' ),
								render: ( f ) => (
									<div className="cs-cell-primary__text">
										<strong>
											{ f.label || f.key }{ ' ' }
											{ f.required && (
												<span className="cs-field__req">
													*
												</span>
											) }
										</strong>
										<span className="cs-mono">
											{ f.key }
										</span>
									</div>
								),
							},
							{
								key: 'column',
								label: __( 'CSV column', 'contact-sync' ),
								width: '38%',
								render: ( f ) => (
									<Select
										value={ mapping[ f.key ] ?? -1 }
										onChange={ ( e ) =>
											setMapping( {
												...mapping,
												[ f.key ]: Number(
													e.target.value
												),
											} )
										}
										options={ [
											{
												value: -1,
												label: __(
													'— Not mapped —',
													'contact-sync'
												),
											},
											...headers.map( ( h, i ) => ( {
												value: i,
												label:
													h ||
													sprintf(
														/* translators: %d: column */ __(
															'Column %d',
															'contact-sync'
														),
														i + 1
													),
											} ) ),
										] }
									/>
								),
							},
							{
								key: 'sample',
								label: __( 'First row value', 'contact-sync' ),
								render: ( f ) =>
									mapping[ f.key ] >= 0 ? (
										<span className="cs-truncate">
											{ rows[ 0 ][ mapping[ f.key ] ] ||
												'—' }
										</span>
									) : (
										<span className="cs-muted">—</span>
									),
							},
						] }
					/>
				</Card>
			) }

			{ step === 2 && report && (
				<Card
					padded={ false }
					title={ __( 'Review', 'contact-sync' ) }
					description={ __(
						'Rows with errors will be skipped. Fix them in your spreadsheet and upload them again later.',
						'contact-sync'
					) }
					actions={
						invalidCount > 0 && (
							<Button
								size="sm"
								icon="download"
								onClick={ downloadErrors }
							>
								{ __(
									'Download rows with errors',
									'contact-sync'
								) }
							</Button>
						)
					}
					footer={
						<>
							<Button
								onClick={ () => setStep( 1 ) }
								icon="arrowLeft"
							>
								{ __( 'Back', 'contact-sync' ) }
							</Button>
							<Button
								variant="primary"
								icon="upload"
								onClick={ runImport }
								loading={ busy }
								disabled={ ! validCount }
							>
								{ sprintf(
									/* translators: %d: rows */
									_n(
										'Import %d lead',
										'Import %d leads',
										validCount,
										'contact-sync'
									),
									validCount
								) }
							</Button>
						</>
					}
				>
					<div className="cs-review-summary">
						<div className="cs-review-summary__item is-success">
							<Icon name="checkCircle" size={ 20 } />
							<div>
								<strong>{ validCount }</strong>
								<span>
									{ __( 'Ready to import', 'contact-sync' ) }
								</span>
							</div>
						</div>
						<div
							className={ cx(
								'cs-review-summary__item',
								invalidCount && 'is-danger'
							) }
						>
							<Icon name="xCircle" size={ 20 } />
							<div>
								<strong>{ invalidCount }</strong>
								<span>
									{ __( 'With errors', 'contact-sync' ) }
								</span>
							</div>
						</div>
						<div className="cs-review-summary__filter">
							<Segmented
								size="sm"
								value={ filter }
								onChange={ setFilter }
								options={ [
									{
										value: 'all',
										label: __( 'All rows', 'contact-sync' ),
										count: report.length,
									},
									{
										value: 'errors',
										label: __( 'Errors', 'contact-sync' ),
										count: invalidCount,
									},
								] }
							/>
						</div>
					</div>
					<Table
						rowKey="index"
						rows={ previewRows }
						columns={ [
							{
								key: 'row',
								label: '#',
								width: 56,
								render: ( r ) => (
									<span className="cs-muted">
										{ r.index + 2 }
									</span>
								),
							},
							{
								key: 'status',
								label: __( 'Status', 'contact-sync' ),
								width: 110,
								render: ( r ) =>
									Object.keys( r.errors ).length ? (
										<Badge tone="danger" icon="x">
											{ __( 'Error', 'contact-sync' ) }
										</Badge>
									) : (
										<Badge tone="success" icon="check">
											{ __( 'Valid', 'contact-sync' ) }
										</Badge>
									),
							},
							...previewFields.map( ( f ) => ( {
								key: f.key,
								label: f.label || f.key,
								render: ( r ) => (
									<span
										className={ cx(
											'cs-truncate',
											r.errors[ f.key ] && 'cs-cell-error'
										) }
										title={ r.errors[ f.key ] || '' }
									>
										{ data[ r.index ][ f.key ] || '—' }
									</span>
								),
							} ) ),
							{
								key: 'errors',
								label: __( 'Issues', 'contact-sync' ),
								render: ( r ) => (
									<ul className="cs-issue-list">
										{ Object.entries( r.errors ).map(
											( [ key, msg ] ) => (
												<li key={ key }>
													<strong>
														{ fields.find(
															( f ) =>
																f.key === key
														)?.label || key }
														:
													</strong>{ ' ' }
													{ msg }
												</li>
											)
										) }
									</ul>
								),
							},
						] }
						empty={
							<EmptyState
								compact
								icon="checkCircle"
								title={ __(
									'No errors found',
									'contact-sync'
								) }
								description={ __(
									'Every row is ready to import.',
									'contact-sync'
								) }
							/>
						}
					/>
					{ report.length > PREVIEW_LIMIT && filter === 'all' && (
						<p className="cs-table-note">
							{ sprintf(
								/* translators: %d: rows shown */
								__(
									'Showing the first %d rows.',
									'contact-sync'
								),
								PREVIEW_LIMIT
							) }
						</p>
					) }
				</Card>
			) }

			{ step === 3 && result && (
				<ImportProgress result={ result } onReset={ reset } />
			) }
		</>
	);
}
