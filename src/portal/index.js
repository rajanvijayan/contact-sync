import { createRoot, useEffect } from '@wordpress/element';
import { setCrmConnected, enablePortalLabels } from '../shared/format';
import { UIProvider } from '../shared/ui';
import config from './config';
import { usePath } from './router';
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

enablePortalLabels();
setCrmConnected( config.deliveryActive );

/**
 * Pick the screen from the current path so in-app links between the sign-in
 * screens swap the view instead of only changing the URL.
 */
function Root() {
	const route = usePath().split( '/' )[ 0 ] || config.route;
	const crossesAuth = ( route === 'app' ) !== ( config.route === 'app' );
	useEffect( () => {
		// The app and the sign-in screens are gated server side; let it decide.
		if ( crossesAuth ) {
			window.location.reload();
		}
	}, [ crossesAuth ] );
	if ( crossesAuth ) {
		return null;
	}
	const Screen = SCREENS[ route ] || SCREENS[ config.route ] || Login;
	return <Screen />;
}

const mount = document.getElementById( 'contact-sync-portal' );
if ( mount ) {
	createRoot( mount ).render(
		<UIProvider>
			<Root />
		</UIProvider>
	);
}
