import { createRoot } from '@wordpress/element';
import { setCrmConnected } from '../shared/format';
import { UIProvider } from '../shared/ui';
import config from './config';
import AdminApp from './AdminApp';
import './admin.scss';

setCrmConnected( config.crmConnected );

const mount = document.getElementById( 'contact-sync-admin' );
if ( mount ) {
	if ( config.branding?.primary_color ) {
		mount.style.setProperty( '--cs-brand', config.branding.primary_color );
	}
	createRoot( mount ).render(
		<UIProvider>
			<AdminApp />
		</UIProvider>
	);
}
