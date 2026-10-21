import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { post } from '../../shared/api';
import Icon from '../../shared/icons';
import { Alert, Button, Field, Input, Spinner } from '../../shared/ui';
import { Link, query } from '../router';
import AuthLayout from './AuthLayout';

export default function Verify() {
	const [ state, setState ] = useState( { status: 'loading', message: '' } );
	const [ email, setEmail ] = useState( '' );
	const [ resent, setResent ] = useState( '' );

	useEffect( () => {
		const params = query();
		post( '/auth/verify', {
			uid: params.get( 'uid' ),
			token: params.get( 'token' ),
		} )
			.then( ( result ) =>
				setState( { status: 'ok', message: result.message } )
			)
			.catch( ( err ) =>
				setState( { status: 'error', message: err.message } )
			);
	}, [] );

	const resend = async ( event ) => {
		event.preventDefault();
		try {
			const result = await post( '/auth/resend', { email } );
			setResent( result.message );
		} catch ( err ) {
			setResent( err.message );
		}
	};

	if ( state.status === 'loading' ) {
		return (
			<AuthLayout title={ __( 'Verifying your email…', 'contact-sync' ) }>
				<div className="cs-auth__center">
					<Spinner size={ 32 } />
				</div>
			</AuthLayout>
		);
	}

	if ( state.status === 'ok' ) {
		return (
			<AuthLayout title={ __( 'Email confirmed', 'contact-sync' ) }>
				<div className="cs-auth__success">
					<span className="cs-auth__success-icon is-success">
						<Icon name="check" size={ 24 } />
					</span>
					<p>{ state.message }</p>
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
			title={ __( 'Link not valid', 'contact-sync' ) }
			subtitle={ state.message }
		>
			<form className="cs-stack" onSubmit={ resend }>
				{ resent && <Alert tone="success">{ resent }</Alert> }
				<Field
					label={ __( 'Email', 'contact-sync' ) }
					htmlFor="cs-verify-email"
				>
					<Input
						id="cs-verify-email"
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
					disabled={ ! email }
				>
					{ __( 'Send a new link', 'contact-sync' ) }
				</Button>
				<Link
					to="login"
					className="cs-auth__link cs-auth__link--center"
				>
					{ __( 'Back to sign in', 'contact-sync' ) }
				</Link>
			</form>
		</AuthLayout>
	);
}
