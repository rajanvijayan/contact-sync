import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { downloadFile, get } from '../../shared/api';
import { isInputField } from '../../shared/FormRenderer';
import { OPERATORS } from '../../shared/conditions';
import Icon from '../../shared/icons';
import { useFetch } from '../../shared/hooks';
import {
	Alert,
	Badge,
	Button,
	Card,
	EmptyState,
	PageHeader,
	Table,
} from '../../shared/ui';
import { Link } from '../router';
import { usePortal } from './context';

const TYPE_LABELS = {
	text: __( 'Text', 'contact-sync' ),
	email: __( 'Email', 'contact-sync' ),
	phone: __( 'Phone', 'contact-sync' ),
	number: __( 'Number', 'contact-sync' ),
	textarea: __( 'Long text', 'contact-sync' ),
	select: __( 'Dropdown', 'contact-sync' ),
	radio: __( 'Single choice', 'contact-sync' ),
	checkboxes: __( 'Multiple choice', 'contact-sync' ),
	checkbox: __( 'Yes / No', 'contact-sync' ),
	date: __( 'Date', 'contact-sync' ),
	url: __( 'Website', 'contact-sync' ),
};

function accepted( field, fields ) {
	switch ( field.type ) {
		case 'select':
		case 'radio':
			return (
				__( 'One of:', 'contact-sync' ) +
				field.options.map( ( o ) => o.label ).join( ', ' )
			);
		case 'checkboxes':
			return (
				__( 'Any of (separate with ;):', 'contact-sync' ) +
				field.options.map( ( o ) => o.label ).join( ', ' )
			);
		case 'checkbox':
			return __( 'yes / no', 'contact-sync' );
		case 'date':
			return __( 'YYYY–MM–DD (e.g. 2026–03–31)', 'contact-sync' );
		case 'email':
			return __( 'A valid email address', 'contact-sync' );
		case 'number':
			return __( 'A number', 'contact-sync' );
		default: {
			if ( field.conditions?.enabled ) {
				const rule = field.conditions.rules[ 0 ];
				const source = fields.find( ( f ) => f.key === rule.field );
				return `${ __( 'Only when', 'contact-sync' ) } ${
					source?.label || rule.field
				} ${ OPERATORS[ rule.operator ] } ${ rule.value }`.trim();
			}
			return field.help || '';
		}
	}
}

export default function Templates() {
	const { me } = usePortal();
	const form = me.form;
	const { data, loading, error } = useFetch(
		form ? '/portal/sample-csv' : null
	);
	const [ downloading, setDownloading ] = useState( false );

	if ( ! form ) {
		return (
			<Card>
				<EmptyState
					icon="form"
					title={ __( 'No lead form available', 'contact-sync' ) }
				/>
			</Card>
		);
	}

	const fields = form.schema.fields.filter(
		( f ) => isInputField( f ) && f.type !== 'hidden'
	);

	const download = async () => {
		setDownloading( true );
		try {
			const file = data || ( await get( '/portal/sample-csv' ) );
			downloadFile( file.filename, file.content );
		} finally {
			setDownloading( false );
		}
	};

	return (
		<>
			<PageHeader
				title={ __( 'CSV template', 'contact-sync' ) }
				description={ __(
					'Use this template to prepare leads for bulk upload. It always matches the current lead form.',
					'contact-sync'
				) }
				actions={
					<>
						<Button
							variant="primary"
							icon="download"
							onClick={ download }
							loading={ downloading }
						>
							{ __( 'Download template', 'contact-sync' ) }
						</Button>
						<Link
							to="app/bulk"
							className="cs-btn cs-btn--secondary cs-btn--md"
						>
							<Icon name="upload" size={ 16 } />
							<span>
								{ __( 'Go to bulk upload', 'contact-sync' ) }
							</span>
						</Link>
					</>
				}
			/>
			{ error && <Alert tone="danger">{ error.message }</Alert> }

			<div className="cs-steps-guide cs-mb">
				{ [
					[
						'download',
						__( 'Download', 'contact-sync' ),
						__(
							'Get the template with the correct column headers and two example rows.',
							'contact-sync'
						),
					],
					[
						'edit',
						__( 'Fill in', 'contact-sync' ),
						__(
							'Replace the examples with your leads. Keep the header row as it is.',
							'contact-sync'
						),
					],
					[
						'upload',
						__( 'Upload', 'contact-sync' ),
						__(
							'Save as CSV (UTF-8) and upload it. You can review every row first.',
							'contact-sync'
						),
					],
				].map( ( [ icon, title, text ], index ) => (
					<div key={ title } className="cs-steps-guide__item">
						<span className="cs-steps-guide__num">
							{ index + 1 }
						</span>
						<div>
							<strong>
								<Icon name={ icon } size={ 16 } /> { title }
							</strong>
							<p>{ text }</p>
						</div>
					</div>
				) ) }
			</div>

			<Card
				title={ __( 'Preview', 'contact-sync' ) }
				description={ __(
					'The first rows of the template file.',
					'contact-sync'
				) }
				padded={ false }
				className="cs-mb"
			>
				<div className="cs-csv-preview">
					<Table
						rowKey="i"
						loading={ loading }
						skeletonRows={ 2 }
						rows={ data?.preview?.rows.map( ( row, i ) => ( {
							i,
							row,
						} ) ) }
						columns={ (
							data?.preview?.headers ||
							fields.map( ( f ) => f.key )
						).map( ( header, col ) => ( {
							key: header,
							label: <span className="cs-mono">{ header }</span>,
							render: ( r ) => (
								<span className="cs-nowrap">
									{ r.row[ col ] || (
										<span className="cs-muted">—</span>
									) }
								</span>
							),
						} ) ) }
					/>
				</div>
			</Card>

			<Card
				title={ __( 'Column reference', 'contact-sync' ) }
				padded={ false }
			>
				<Table
					rowKey="key"
					rows={ fields }
					columns={ [
						{
							key: 'key',
							label: __( 'Column', 'contact-sync' ),
							render: ( f ) => <code>{ f.key }</code>,
						},
						{
							key: 'label',
							label: __( 'Field', 'contact-sync' ),
							render: ( f ) => f.label,
						},
						{
							key: 'type',
							label: __( 'Type', 'contact-sync' ),
							render: ( f ) => TYPE_LABELS[ f.type ] || f.type,
						},
						{
							key: 'required',
							label: __( 'Required', 'contact-sync' ),
							render: ( f ) =>
								f.required ? (
									<Badge
										tone={
											f.conditions?.enabled
												? 'warning'
												: 'danger'
										}
									>
										{ f.conditions?.enabled
											? __(
													'Conditional',
													'contact-sync'
											  )
											: __( 'Required', 'contact-sync' ) }
									</Badge>
								) : (
									<span className="cs-muted">
										{ __( 'Optional', 'contact-sync' ) }
									</span>
								),
						},
						{
							key: 'accepted',
							label: __( 'Accepted values', 'contact-sync' ),
							render: ( f ) => (
								<span className="cs-muted">
									{ accepted( f, fields ) }
								</span>
							),
						},
					] }
				/>
			</Card>
		</>
	);
}
