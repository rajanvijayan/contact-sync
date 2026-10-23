import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../shared/icons';
import { Alert, cx } from '../shared/ui';
import config from './config';
import { useRoute } from './router';
import Dashboard from './Dashboard';
import Agencies from './Agencies';
import Reps from './Reps';
import Forms from './Forms';
import Builder from './builder/Builder';
import Submissions from './Submissions';
import Reports from './Reports';
import Settings from './Settings';
import Activity from './Activity';

const NAV = [
	{
		id: 'dashboard',
		icon: 'dashboard',
		label: __( 'Dashboard', 'contact-sync' ),
	},
	{
		id: 'submissions',
		icon: 'inbox',
		label: __( 'Submissions', 'contact-sync' ),
	},
	{
		id: 'reports',
		icon: 'chart',
		label: __( 'Reports', 'contact-sync' ),
	},
	{
		id: 'agencies',
		icon: 'building',
		label: __( 'Agencies', 'contact-sync' ),
	},
	{ id: 'reps', icon: 'users', label: __( 'Reps', 'contact-sync' ) },
	{ id: 'forms', icon: 'form', label: __( 'Forms', 'contact-sync' ) },
	{
		id: 'activity',
		icon: 'list',
		label: __( 'Activity', 'contact-sync' ),
	},
	{
		id: 'settings',
		icon: 'settings',
		label: __( 'Settings', 'contact-sync' ),
	},
];

/**
 * Keep the WordPress sidebar submenu highlight in sync with the hash route.
 *
 * @param {string} section Current section.
 */
function syncWpMenu( section ) {
	document
		.querySelectorAll( '#toplevel_page_contact-sync .wp-submenu li' )
		.forEach( ( li ) => {
			const link = li.querySelector( 'a' );
			const active =
				!! link &&
				link.getAttribute( 'href' )?.endsWith( `#/${ section }` );
			li.classList.toggle( 'current', active );
			link?.classList.toggle( 'current', active );
		} );
}

export default function AdminApp() {
	const route = useRoute();
	const [ section, id ] = route.split( '/' );

	useEffect( () => syncWpMenu( section ), [ section ] );

	let page;
	switch ( section ) {
		case 'submissions':
			page = <Submissions />;
			break;
		case 'reports':
			page = <Reports />;
			break;
		case 'agencies':
			page = <Agencies />;
			break;
		case 'reps':
			page = <Reps />;
			break;
		case 'forms':
			page = id ? <Builder id={ Number( id ) } key={ id } /> : <Forms />;
			break;
		case 'settings':
			page = <Settings />;
			break;
		case 'activity':
			page = <Activity />;
			break;
		default:
			page = <Dashboard />;
	}

	const builder = section === 'forms' && id;

	return (
		<div className={ cx( 'cs-admin', builder && 'cs-admin--builder' ) }>
			<header className="cs-admin__bar">
				<div className="cs-admin__brand">
					<span className="cs-admin__mark">
						<Icon name="cloud" size={ 16 } />
					</span>
					<span>{ __( 'Contact Sync', 'contact-sync' ) }</span>
				</div>
				<nav
					className="cs-admin__nav"
					aria-label={ __( 'Contact Sync', 'contact-sync' ) }
				>
					{ NAV.map( ( item ) => (
						<a
							key={ item.id }
							href={ `#/${ item.id }` }
							className={ cx(
								'cs-admin__link',
								section === item.id && 'is-active',
								! section &&
									item.id === 'dashboard' &&
									'is-active'
							) }
						>
							<Icon name={ item.icon } size={ 16 } />
							{ item.label }
						</a>
					) ) }
				</nav>
				<a
					className="cs-btn cs-btn--secondary cs-btn--sm cs-admin__portal"
					href={ config.portalUrl }
					target="_blank"
					rel="noreferrer"
				>
					<Icon name="external" size={ 14 } />
					<span>{ __( 'Open portal', 'contact-sync' ) }</span>
				</a>
			</header>
			<div className="cs-admin__content">
				{ ! config.permalinks && (
					<div className="cs-mb">
						<Alert
							tone="warning"
							title={ __(
								'Pretty permalinks are off',
								'contact-sync'
							) }
						>
							{ __(
								'The rep portal uses addresses like /login and /app. Choose any option other than “Plain” under Settings › Permalinks.',
								'contact-sync'
							) }
						</Alert>
					</div>
				) }
				{ page }
			</div>
		</div>
	);
}
