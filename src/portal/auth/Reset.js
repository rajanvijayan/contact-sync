import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { get, post } from '../../shared/api';
import Icon from '../../shared/icons';
import { Alert, Button, Field, PasswordInput, Spinner } from '../../shared/ui';
import { Link, query } from '../router';
import AuthLayout from './AuthLayout';
import { PasswordStrength } from './Signup';

const welcome = ( name ) =>
	name
		? /* translators: %s: first name */ sprintf(
				__( 'Welcome, %s', 'contact-sync' ),
				name
		  )
		: __( 'Welcome', 'contact-sync' );

export default function Reset() {
	const params = query();
	const invite = params.get( 'invite' ) === '1';
	const creds = {
		key: params.get( 'key' ) || '',
		login: params.get( 'login' ) || '',
	};
	const [ check, setCheck ] = useState( { status: 'loading' } );
	const [ password, setPassword ] = useState( '' );
	const [ confirm, setConfirm ] = useState( '' );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ done, setDone ] = useState( '' );

	useEffect( () => {
		get( '/auth/reset', creds )
			.then( ( user ) => setCheck( { status: 'ok', user } ) )
			.catch( ( err ) =>
				setCheck( { status: 'error', message: err.message } )
			);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const strong =
		password.length >= 8 &&
		/[A-Za-z]/.test( password ) &&
		/[0-9]/.test( password );

	const submit = async ( event ) => {
		event.preventDefault();
		if ( password !== confirm ) {
			setError( {
				message: __( 'Passwords do not match.', 'contact-sync' ),
			} );
			return;
		}
		setLoading( true );
		setError( null );
		try {
			setDone(
				( await post( '/auth/reset', { ...creds, password } ) ).message
			);
		} catch ( err ) {
			setError( err );
		}
		setLoading( false );
	};

	if ( check.status === 'loading' ) {
		return (
			<AuthLayout
				title={
					invite
						? __( 'Set up your account', 'contact-sync' )
						: __( 'Reset password', 'contact-sync' )
				}
			>
				<div className="cs-auth__center">
					<Spinner size={ 32 } />
				</div>
			</AuthLayout>
		);
	}

	if ( check.status === 'error' ) {
		return (
			<AuthLayout
				title={ __( 'Link expired', 'contact-sync' ) }
				subtitle={ check.message }
			>
				<Link
					to="forgot-password"
					className="cs-btn cs-btn--primary cs-btn--lg cs-btn--block"
				>
					{ __( 'Request a new link', 'contact-sync' ) }
				</Link>
			</AuthLayout>
		);
	}

	if ( done ) {
		return (
			<AuthLayout title={ __( 'Password saved', 'contact-sync' ) }>
				<div className="cs-auth__success">
					<span className="cs-auth__success-icon is-success">
						<Icon name="check" size={ 24 } />
					</span>
					<p>{ done }</p>
					<Link
						to="login"
						className="cs-btn cs-btn--primary cs-btn--lg cs-btn--block"
					>
						{ __( 'Continue to sign in', 'contact-sync' ) }
					</Link>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title={
				invite
					? welcome( check.user.first_name )
					: __( 'Choose a new password', 'contact-sync' )
			}
			subtitle={
				invite
					? sprintf(
							/* translators: %s: email */
							__(
								'Create a password for %s to finish setting up your account.',
								'contact-sync'
							),
							check.user.email
					  )
					: check.user.email
			}
		>
			<form className="cs-stack" onSubmit={ submit }>
				{ error && <Alert tone="danger">{ error.message }</Alert> }
				<Field
					label={ __( 'New password', 'contact-sync' ) }
					htmlFor="cs-reset-pw"
				>
					<PasswordInput
						id="cs-reset-pw"
						icon="lock"
						autoComplete="new-password"
						value={ password }
						onChange={ ( e ) => setPassword( e.target.value ) }
					/>
					<PasswordStrength value={ password } />
				</Field>
				<Field
					label={ __( 'Confirm password', 'contact-sync' ) }
					htmlFor="cs-reset-pw2"
				>
					<PasswordInput
						id="cs-reset-pw2"
						icon="lock"
						autoComplete="new-password"
						value={ confirm }
						onChange={ ( e ) => setConfirm( e.target.value ) }
					/>
				</Field>
				<Button
					type="submit"
					variant="primary"
					size="lg"
					block
					loading={ loading }
					disabled={ ! strong || ! confirm }
				>
					{ invite
						? __( 'Create password', 'contact-sync' )
						: __( 'Save password', 'contact-sync' ) }
				</Button>
			</form>
		</AuthLayout>
	);
}
