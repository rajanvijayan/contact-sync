import { createRoot } from '@wordpress/element';
import { UIProvider } from '../shared/ui';
import config from './config';
import Login from './auth/Login';
import Signup from './auth/Signup';
import Verify from './auth/Verify';
import Forgot from './auth/Forgot';
import Reset from './auth/Reset';
import AppShell from './app/AppShell';
import './portal.scss';

const SCREENS = {
	login: Login,
	signup: Signup,
	verify: Verify,
	'forgot-password': Forgot,
	'reset-password': Reset,
	app: AppShell,
};

const mount = document.getElementById( 'contact-sync-portal' );
if ( mount ) {
	const Screen = SCREENS[ config.route ] || Login;
	createRoot( mount ).render(
		<UIProvider>
			<Screen />
		</UIProvider>
	);
}
