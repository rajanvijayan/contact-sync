import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { post } from '../../shared/api';
import {
	Alert,
	Button,
	Checkbox,
	Field,
	Input,
	PasswordInput,
} from '../../shared/ui';
import { Link, query } from '../router';
import AuthLayout from './AuthLayout';

export default function Login() {
	const params = query();
	const [ email, setEmail ] = useState( '' );
	const [ password, setPassword ] = useState( '' );
	const [ remember, setRemember ] = useState( true );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ notice, setNotice ] = useState(
		params.get( 'loggedout' )
			? __( 'You have been signed out.', 'contact-sync' )
			: ''
	);

	const submit = async ( event ) => {
		event.preventDefault();
		setLoading( true );
		setError( null );
		setNotice( '' );
		try {
			const result = await post( '/auth/login', {
				email,
				password,
				remember,
				redirect_to: params.get( 'redirect_to' ) || '',
			} );
			window.location.assign( result.redirect );
		} catch ( err ) {
			setError( err );
			setLoading( false );
		}
	};

	const resend = async () => {
		try {
			const result = await post( '/auth/resend', { email } );
			setError( null );
			setNotice( result.message );
		} catch ( err ) {
			setError( err );
		}
	};

	return (
		<AuthLayout
			title={ __( 'Welcome back', 'contact-sync' ) }
			subtitle={ __(
				'Sign in to submit and track your leads.',
				'contact-sync'
			) }
			footer={
				<>
					{ __( 'New partner rep?', 'contact-sync' ) }{ ' ' }
					<Link to="signup">
						{ __( 'Create an account', 'contact-sync' ) }
					</Link>
				</>
			}
		>
			<form className="cs-stack" onSubmit={ submit } noValidate>
				{ notice && <Alert tone="success">{ notice }</Alert> }
				{ error && (
					<Alert
						tone={
							error.code === 'cs_pending' ? 'warning' : 'danger'
						}
						action={
							error.code === 'cs_pending' && (
								<Button
									size="sm"
									variant="secondary"
									onClick={ resend }
								>
									{ __( 'Resend link', 'contact-sync' ) }
								</Button>
							)
						}
					>
						{ error.message }
					</Alert>
				) }
				<Field
					label={ __( 'Email', 'contact-sync' ) }
					htmlFor="cs-login-email"
				>
					<Input
						id="cs-login-email"
						type="email"
						icon="mail"
						autoComplete="username"
						placeholder="name@company.com"
						value={ email }
						onChange={ ( e ) => setEmail( e.target.value ) }
						required
					/>
				</Field>
				<Field
					label={ __( 'Password', 'contact-sync' ) }
					htmlFor="cs-login-password"
					action={
						<Link to="forgot-password" className="cs-auth__link">
							{ __( 'Forgot password?', 'contact-sync' ) }
						</Link>
					}
				>
					<PasswordInput
						id="cs-login-password"
						icon="lock"
						autoComplete="current-password"
						value={ password }
						onChange={ ( e ) => setPassword( e.target.value ) }
						required
					/>
				</Field>
				<Checkbox
					label={ __( 'Keep me signed in', 'contact-sync' ) }
					checked={ remember }
					onChange={ setRemember }
				/>
				<Button
					type="submit"
					variant="primary"
					size="lg"
					block
					loading={ loading }
					disabled={ ! email || ! password }
				>
					{ __( 'Sign in', 'contact-sync' ) }
				</Button>
			</form>
		</AuthLayout>
	);
}
