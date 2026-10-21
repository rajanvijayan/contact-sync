import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { post } from '../../shared/api';
import Icon from '../../shared/icons';
import { Alert, Button, Field, Input } from '../../shared/ui';
import { Link } from '../router';
import AuthLayout from './AuthLayout';

export default function Forgot() {
	const [ email, setEmail ] = useState( '' );
	const [ loading, setLoading ] = useState( false );
	const [ done, setDone ] = useState( '' );
	const [ error, setError ] = useState( null );

	const submit = async ( event ) => {
		event.preventDefault();
		setLoading( true );
		setError( null );
		try {
			setDone( ( await post( '/auth/forgot', { email } ) ).message );
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
					<p>{ done }</p>
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
			title={ __( 'Forgot your password?', 'contact-sync' ) }
			subtitle={ __(
				'Enter your email and we will send you a link to reset it.',
				'contact-sync'
			) }
			footer={
				<Link to="login">
					{ __( 'Back to sign in', 'contact-sync' ) }
				</Link>
			}
		>
			<form className="cs-stack" onSubmit={ submit }>
				{ error && <Alert tone="danger">{ error.message }</Alert> }
				<Field
					label={ __( 'Email', 'contact-sync' ) }
					htmlFor="cs-forgot-email"
				>
					<Input
						id="cs-forgot-email"
						type="email"
						icon="mail"
						value={ email }
						onChange={ ( e ) => setEmail( e.target.value ) }
						required
					/>
				</Field>
				<Button
					type="submit"
					variant="primary"
					size="lg"
					block
					loading={ loading }
					disabled={ ! email }
				>
					{ __( 'Send reset link', 'contact-sync' ) }
				</Button>
			</form>
		</AuthLayout>
	);
}
