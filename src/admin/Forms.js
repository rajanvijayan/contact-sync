import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { del, post, put } from '../shared/api';
import { formatDate } from '../shared/format';
import { useFetch } from '../shared/hooks';
import {
	Alert,
	Badge,
	Button,
	Card,
	EmptyState,
	Field,
	IconButton,
	Input,
	Menu,
	Modal,
	PageHeader,
	Table,
	useUI,
} from '../shared/ui';
import Icon from '../shared/icons';
import { go } from './router';

export default function Forms() {
	const { data, loading, reload } = useFetch( '/forms' );
	const { toast, confirm } = useUI();
	const [ creating, setCreating ] = useState( false );
	const [ title, setTitle ] = useState( '' );
	const [ error, setError ] = useState( null );

	const create = async ( event ) => {
		event.preventDefault();
		try {
			const form = await post( '/forms', { title } );
			go( `forms/${ form.id }` );
		} catch ( err ) {
			setError( err );
		}
	};

	const run = async ( fn, message ) => {
		try {
			await fn();
			toast( message );
			reload( true );
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
	};

	return (
		<>
			<PageHeader
				title={ __( 'Forms', 'contact-sync' ) }
				description={ __(
					'Design the lead form reps fill in. The form marked “Live” is used in the portal and for bulk uploads.',
					'contact-sync'
				) }
				actions={
					<Button
						variant="primary"
						icon="plus"
						onClick={ () => setCreating( true ) }
					>
						{ __( 'New form', 'contact-sync' ) }
					</Button>
				}
			/>
			<Card padded={ false }>
				<Table
					rows={ data }
					loading={ loading }
					onRowClick={ ( f ) => go( `forms/${ f.id }` ) }
					columns={ [
						{
							key: 'title',
							label: __( 'Form', 'contact-sync' ),
							render: ( f ) => (
								<div className="cs-cell-primary">
									<span className="cs-card__icon">
										<Icon name="form" size={ 18 } />
									</span>
									<div className="cs-cell-primary__text">
										<strong>{ f.title }</strong>
										<span>
											{ sprintf(
												/* translators: 1: fields, 2: version */ __(
													'%1$d fields · version %2$d',
													'contact-sync'
												),
												f.field_count,
												f.version
											) }
										</span>
									</div>
								</div>
							),
						},
						{
							key: 'status',
							label: __( 'Status', 'contact-sync' ),
							render: ( f ) => {
								if ( f.is_default ) {
									return (
										<Badge tone="success" dot>
											{ __( 'Live', 'contact-sync' ) }
										</Badge>
									);
								}
								return f.status === 'archived' ? (
									<Badge>
										{ __( 'Archived', 'contact-sync' ) }
									</Badge>
								) : (
									<Badge tone="neutral">
										{ __( 'Draft', 'contact-sync' ) }
									</Badge>
								);
							},
						},
						{
							key: 'subs',
							label: __( 'Submissions', 'contact-sync' ),
							render: ( f ) => f.submissions,
						},
						{
							key: 'updated',
							label: __( 'Last updated', 'contact-sync' ),
							render: ( f ) => (
								<span className="cs-muted">
									{ formatDate( f.updated_at ) }
								</span>
							),
						},
						{
							key: 'actions',
							label: '',
							align: 'right',
							width: 60,
							render: ( f ) => (
								// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
								<div onClick={ ( e ) => e.stopPropagation() }>
									<Menu
										trigger={ ( { toggle } ) => (
											<IconButton
												icon="more"
												label={ __(
													'Actions',
													'contact-sync'
												) }
												onClick={ toggle }
											/>
										) }
										items={ [
											{
												label: __(
													'Edit',
													'contact-sync'
												),
												icon: 'edit',
												onClick: () =>
													go( `forms/${ f.id }` ),
											},
											! f.is_default && {
												label: __(
													'Make live in portal',
													'contact-sync'
												),
												icon: 'checkCircle',
												onClick: async () => {
													const ok = await confirm( {
														title: __(
															'Switch the live form?',
															'contact-sync'
														),
														message: __(
															'Reps will immediately see this form, and the CSV template will change to match it.',
															'contact-sync'
														),
														confirmLabel: __(
															'Make live',
															'contact-sync'
														),
													} );
													if ( ok ) {
														run(
															() =>
																put(
																	`/forms/${ f.id }`,
																	{
																		is_default: true,
																	}
																),
															__(
																'Form is now live',
																'contact-sync'
															)
														);
													}
												},
											},
											{
												label: __(
													'Duplicate',
													'contact-sync'
												),
												icon: 'copy',
												onClick: () =>
													run(
														() =>
															post(
																`/forms/${ f.id }/duplicate`
															),
														__(
															'Form duplicated',
															'contact-sync'
														)
													),
											},
											! f.is_default && {
												separator: true,
											},
											! f.is_default && {
												label: f.submissions
													? __(
															'Archive',
															'contact-sync'
													  )
													: __(
															'Delete',
															'contact-sync'
													  ),
												icon: 'trash',
												danger: true,
												onClick: async () => {
													const ok = await confirm( {
														title: f.submissions
															? __(
																	'Archive form?',
																	'contact-sync'
															  )
															: __(
																	'Delete form?',
																	'contact-sync'
															  ),
														message: f.submissions
															? __(
																	'This form has submissions, so it will be archived to keep their history.',
																	'contact-sync'
															  )
															: __(
																	'This cannot be undone.',
																	'contact-sync'
															  ),
														danger: true,
														confirmLabel:
															f.submissions
																? __(
																		'Archive',
																		'contact-sync'
																  )
																: __(
																		'Delete',
																		'contact-sync'
																  ),
													} );
													if ( ok ) {
														run(
															() =>
																del(
																	`/forms/${ f.id }`
																),
															__(
																'Done',
																'contact-sync'
															)
														);
													}
												},
											},
										] }
									/>
								</div>
							),
						},
					] }
					empty={
						<EmptyState
							icon="form"
							title={ __( 'No forms yet', 'contact-sync' ) }
							action={
								<Button
									variant="primary"
									icon="plus"
									onClick={ () => setCreating( true ) }
								>
									{ __( 'New form', 'contact-sync' ) }
								</Button>
							}
						/>
					}
				/>
			</Card>
			<Modal
				open={ creating }
				onClose={ () => setCreating( false ) }
				icon="form"
				title={ __( 'New form', 'contact-sync' ) }
				size="sm"
				footer={
					<>
						<Button onClick={ () => setCreating( false ) }>
							{ __( 'Cancel', 'contact-sync' ) }
						</Button>
						<Button
							variant="primary"
							type="submit"
							form="cs-new-form"
							disabled={ ! title.trim() }
						>
							{ __( 'Create and edit', 'contact-sync' ) }
						</Button>
					</>
				}
			>
				<form id="cs-new-form" className="cs-stack" onSubmit={ create }>
					{ error && <Alert tone="danger">{ error.message }</Alert> }
					<Field
						label={ __( 'Form name', 'contact-sync' ) }
						htmlFor="cs-new-form-title"
						help={ __(
							'Only visible to administrators.',
							'contact-sync'
						) }
					>
						<Input
							id="cs-new-form-title"
							value={ title }
							onChange={ ( e ) => setTitle( e.target.value ) }
						/>
					</Field>
				</form>
			</Modal>
		</>
	);
}
