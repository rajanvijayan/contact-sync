import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { get, post } from '../../shared/api';
import FormRenderer, {
	initialValues,
	validateClient,
} from '../../shared/FormRenderer';
import Icon from '../../shared/icons';
import { isCrmConnected } from '../../shared/format';
import { useInterval } from '../../shared/hooks';
import {
	Alert,
	Button,
	Card,
	EmptyState,
	PageHeader,
	StatusBadge,
} from '../../shared/ui';
import { Link } from '../router';
import { usePortal } from './context';

const FINAL = [ 'synced', 'failed', 'duplicate', 'review' ];

function SubmittedPanel( { submission, message, onAnother } ) {
	const [ item, setItem ] = useState( submission );
	const [ polls, setPolls ] = useState( 0 );
	const polling =
		isCrmConnected() && ! FINAL.includes( item.status ) && polls < 40;

	useInterval(
		() => {
			setPolls( ( n ) => n + 1 );
			get( `/portal/submissions/${ item.id }` )
				.then( setItem )
				.catch( () => {} );
		},
		3000,
		polling
	);

	const info = {
		queued: isCrmConnected()
			? __(
					'Your lead is queued and will be delivered to the sales team in a moment.',
					'contact-sync'
			  )
			: __(
					'Your lead is saved and will be delivered to the sales team shortly.',
					'contact-sync'
			  ),
		syncing: __(
			'Delivering your lead to the sales team…',
			'contact-sync'
		),
		synced: __(
			'Your lead has been delivered and the sales team has been notified.',
			'contact-sync'
		),
		duplicate: __(
			'This contact is already an open lead with the sales team, so no duplicate was created.',
			'contact-sync'
		),
		review: __(
			'A lead with this email was submitted before, so this one is held until an administrator approves it.',
			'contact-sync'
		),
		failed: __(
			'We could not deliver this lead automatically. Our team has been alerted and will follow up.',
			'contact-sync'
		),
	};

	return (
		<Card>
			<div className="cs-submitted">
				<span className="cs-submitted__icon">
					<Icon name="check" size={ 28 } />
				</span>
				<h2>{ __( 'Lead submitted', 'contact-sync' ) }</h2>
				<p className="cs-muted">{ message }</p>
				<div className="cs-submitted__status">
					<StatusBadge status={ item.status } />
					<span>{ info[ item.status ] }</span>
				</div>
				<div className="cs-row cs-row--center">
					<Button variant="primary" icon="plus" onClick={ onAnother }>
						{ __( 'Submit another lead', 'contact-sync' ) }
					</Button>
					<Link
						to="app/submissions"
						className="cs-btn cs-btn--secondary cs-btn--md"
					>
						{ __( 'View my submissions', 'contact-sync' ) }
					</Link>
				</div>
			</div>
		</Card>
	);
}

export default function NewLead() {
	const { me, reload } = usePortal();
	const form = me.form;
	const [ values, setValues ] = useState( () =>
		form ? initialValues( form.schema ) : {}
	);
	const [ errors, setErrors ] = useState( {} );
	const [ submitting, setSubmitting ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ submitted, setSubmitted ] = useState( null );

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

	const onChange = ( key, value ) => {
		setValues( ( current ) => ( { ...current, [ key ]: value } ) );
		if ( errors[ key ] ) {
			setErrors( ( current ) => {
				const next = { ...current };
				delete next[ key ];
				return next;
			} );
		}
	};

	const submit = async ( event ) => {
		event.preventDefault();
		setError( null );
		const clientErrors = validateClient( form.schema, values );
		if ( Object.keys( clientErrors ).length ) {
			setErrors( clientErrors );
			document
				.getElementById(
					`cs-lead-${ Object.keys( clientErrors )[ 0 ] }`
				)
				?.focus();
			return;
		}
		setSubmitting( true );
		try {
			const result = await post( '/portal/submissions', { values } );
			setSubmitted( result );
			reload();
			window.scrollTo( { top: 0, behavior: 'smooth' } );
		} catch ( err ) {
			setErrors( err.errors || {} );
			setError( err );
		}
		setSubmitting( false );
	};

	const reset = () => {
		setValues( initialValues( form.schema ) );
		setErrors( {} );
		setSubmitted( null );
	};

	return (
		<div className="cs-narrow">
			<PageHeader
				title={ __( 'New lead', 'contact-sync' ) }
				description={ __(
					'Share the details of a potential customer with the sales team.',
					'contact-sync'
				) }
			/>
			{ submitted ? (
				<SubmittedPanel
					submission={ submitted }
					message={ form.schema.settings?.successMessage }
					onAnother={ reset }
				/>
			) : (
				<Card>
					<form onSubmit={ submit } noValidate>
						<div className="cs-submitter">
							<Icon
								name={ me.user.agency ? 'building' : 'user' }
								size={ 16 }
							/>
							<span>
								{ __( 'Submitting as', 'contact-sync' ) }{ ' ' }
								<strong>{ me.user.name }</strong>
								{ ' · ' }
								{ me.user.agency
									? me.user.agency.name
									: __( 'Independent rep', 'contact-sync' ) }
							</span>
							<span
								className="cs-submitter__lock"
								title={ __(
									'Set automatically from your account',
									'contact-sync'
								) }
							>
								<Icon name="lock" size={ 14 } />
							</span>
						</div>
						{ error &&
							! Object.keys( error.errors || {} ).length && (
								<div className="cs-mb">
									<Alert tone="danger">
										{ error.message }
									</Alert>
								</div>
							) }
						<FormRenderer
							schema={ form.schema }
							values={ values }
							onChange={ onChange }
							errors={ errors }
							idPrefix="cs-lead"
						/>
						<div className="cs-form-actions">
							<Button onClick={ reset } variant="ghost">
								{ __( 'Clear form', 'contact-sync' ) }
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="lg"
								icon="send"
								loading={ submitting }
							>
								{ form.schema.settings?.submitLabel ||
									__( 'Submit lead', 'contact-sync' ) }
							</Button>
						</div>
					</form>
				</Card>
			) }
		</div>
	);
}
