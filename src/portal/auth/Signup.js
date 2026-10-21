import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { post } from '../../shared/api';
import Icon from '../../shared/icons';
import { Alert, Button, Field, Input, PasswordInput } from '../../shared/ui';
import { Link } from '../router';
import AuthLayout from './AuthLayout';

export function PasswordStrength( { value } ) {
	const checks = [
		{
			ok: value.length >= 8,
			label: __( 'At least 8 characters', 'contact-sync' ),
		},
		{
			ok: /[A-Za-z]/.test( value ) && /[0-9]/.test( value ),
			label: __( 'Letters and numbers', 'contact-sync' ),
		},
	];
	return (
		<ul className="cs-pw-checks">
			{ checks.map( ( check ) => (
				<li key={ check.label } className={ check.ok ? 'is-ok' : '' }>
					<Icon
						name={ check.ok ? 'checkCircle' : 'clock' }
						size={ 14 }
					/>
					{ check.label }
				</li>
			) ) }
		</ul>
	);
}

export default function Signup() {
	const [ form, setForm ] = useState( {
		first_name: '',
		last_name: '',
		email: '',
		password: '',
	} );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ done, setDone ] = useState( '' );
	const set = ( key ) => ( e ) =>
		setForm( { ...form, [ key ]: e.target.value } );
	const strong =
		form.password.length >= 8 &&
		/[A-Za-z]/.test( form.password ) &&
		/[0-9]/.test( form.password );

	const submit = async ( event ) => {
		event.preventDefault();
		setLoading( true );
		setError( null );
		try {
			const result = await post( '/auth/signup', form );
			setDone( result.message );
		} catch ( err ) {
			setError( err );
		}
		setLoading( false );
	};

	if ( done ) {
		return (
			<AuthLayout title={ __( 'Check your inbox', 'contact-sync' ) }>
				<div className="cs-auth__success">
					<span className="cs-auth__success-icon">
						<Icon name="mail" size={ 24 } />
					</span>
					<p>
						{ __(
							'We sent a verification link to',
							'contact-sync'
						) }{ ' ' }
						<strong>{ form.email }</strong>.{ ' ' }
						{ __(
							'Click the link to activate your account. It expires in 48 hours.',
							'contact-sync'
						) }
					</p>
					<Link
						to="login"
						className="cs-btn cs-btn--secondary cs-btn--md cs-btn--block"
					>
						{ __( 'Back to sign in', 'contact-sync' ) }
					</Link>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title={ __( 'Create your account', 'contact-sync' ) }
			subtitle={ __(
				'Use your agency work email. Only approved partner domains can sign up.',
				'contact-sync'
			) }
			footer={
				<>
					{ __( 'Already have an account?', 'contact-sync' ) }{ ' ' }
					<Link to="login">{ __( 'Sign in', 'contact-sync' ) }</Link>
				</>
			}
		>
			<form className="cs-stack" onSubmit={ submit } noValidate>
				{ error && <Alert tone="danger">{ error.message }</Alert> }
				<div className="cs-two-col">
					<Field
						label={ __( 'First name', 'contact-sync' ) }
						htmlFor="cs-su-first"
					>
						<Input
							id="cs-su-first"
							autoComplete="given-name"
							value={ form.first_name }
							onChange={ set( 'first_name' ) }
							required
						/>
					</Field>
					<Field
						label={ __( 'Last name', 'contact-sync' ) }
						htmlFor="cs-su-last"
					>
						<Input
							id="cs-su-last"
							autoComplete="family-name"
							value={ form.last_name }
							onChange={ set( 'last_name' ) }
							required
						/>
					</Field>
				</div>
				<Field
					label={ __( 'Work email', 'contact-sync' ) }
					htmlFor="cs-su-email"
					help={ __(
						'Your agency is detected automatically from your email domain.',
						'contact-sync'
					) }
				>
					<Input
						id="cs-su-email"
						type="email"
						icon="mail"
						autoComplete="email"
						placeholder="name@agency.com"
						value={ form.email }
						onChange={ set( 'email' ) }
						required
					/>
				</Field>
				<Field
					label={ __( 'Password', 'contact-sync' ) }
					htmlFor="cs-su-password"
				>
					<PasswordInput
						id="cs-su-password"
						icon="lock"
						autoComplete="new-password"
						value={ form.password }
						onChange={ set( 'password' ) }
						required
					/>
					<PasswordStrength value={ form.password } />
				</Field>
				<Button
					type="submit"
					variant="primary"
					size="lg"
					block
					loading={ loading }
					disabled={
						! form.first_name ||
						! form.last_name ||
						! form.email ||
						! strong
					}
				>
					{ __( 'Create account', 'contact-sync' ) }
				</Button>
			</form>
		</AuthLayout>
	);
}
